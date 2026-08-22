/**
 * 지표 신선도 판정 — 순수 함수.
 *
 * 볼트 인수인계 사양서 [[지표 출처·신선도·판정원장]] §1-6·1-7을 사이트로 옮긴 것이다.
 * 이름과 기한표를 **일부러 그쪽과 똑같이** 맞췄다 — 같은 걸 다르게 부르면 두 화면을
 * 나란히 놓고 대조할 수 없다.
 *
 * ## ⚠ 1-6. "갱신이 돌았다"와 "값이 최신이다"는 다른 사실이다
 * 둘은 독립적으로 실패한다.
 *   - 수집이 성공해도 **발표기관이 새 값을 안 냈으면** `asOf`는 그대로다.
 *   - 수집이 실패해도 **이전 값이 그대로 남아** 화면은 멀쩡해 보인다.
 *
 * 그래서 이 모듈은 두 가지를 **따로** 판정한다. 하나로 합치려는 시도를 거부할 것.
 *
 * | 판정 | 기준 | 뜻 | 대응 |
 * |---|---|---|---|
 * | `stale` | `asOf` + 발표주기 규칙 | **값이 낡았다** | 기다리거나(정상 지연) 수동 지표면 새로 조사 |
 * | `stalled` | `fetchedAt` + {@link COLLECTION_STALL_DAYS} | **수집기가 죽었다** | 코드·자격증명을 고친다 |
 *
 * 볼트는 매크로 대시보드에 `stale`만, 버블 모니터에 `stalled`만 걸었다(§6-1).
 * 여기서 둘 다 거는 이유는 사이트가 **두 사고를 다 겪었기** 때문이다 —
 * 2026-08-21 점검에서 "마지막 수집 2026-08-13"(수집 끊김)과 "환율 1,350 vs 1,409.9"
 * (값 낡음)가 같은 날 동시에 나왔다.
 *
 * ## ⚠ 1-7. 기한은 관측 주기가 아니라 **발표 주기**로 잡는다
 * 이걸 틀리면 정상인 계열이 매일 회색으로 뜨고, 그러면 사람이 회색 자체를 무시한다.
 * **오탐 한 건이 미탐 열 건보다 비싸다.**
 *
 * 두 가지 구조적 함정:
 *   1. **일별 관측·주간 발표** — 연준 H.10(DEXKOUS·DEXJPUS·DEXCHUS)은 일별 값을
 *      월요일에 직전 금요일치까지 한 번에 낸다. 관측 주기로 재면 항상 5~7일 뒤진다.
 *   2. **월간 관측의 `asOf`는 기간 시작일** — 7월 CPI가 8월 12일에 나와도 FRED는
 *      `2026-07-01`로 찍는다. 30일로 재면 8월분이 나오기 전에 만료된다.
 *
 * 그래서 주기를 **두 번** 더한다 — 기간이 끝날 때까지 한 번, 다음 발표까지 한 번.
 */

/** 발표 주기. 관측 주기가 아니다(§1-7). */
export type ReleaseFreq = "d" | "w" | "m" | "q";

/** 주기 하나의 길이(일). */
const FREQ_DAYS: Record<ReleaseFreq, number> = { d: 1, w: 7, m: 30, q: 91 };

/**
 * 기본 기한(일) = 주기(기간 종료) + 주기(다음 발표) + 여유 `max(5, 주기/2)`.
 * ⚠ 볼트 `stale_rule`과 **같은 값**이다. 한쪽만 고치지 말 것.
 */
export const STALE_RULE: Record<ReleaseFreq, number> = { d: 7, w: 19, m: 75, q: 228 };

/**
 * 자동 지표의 수집이 끊긴 것으로 보는 일수.
 * 사이트 수집은 주 1회 도는 것을 전제하므로 **14일 = 2회 연속 실패**다.
 * ⚠ 첫 값이다. 오탐이 쌓이면 실제 수집 주기로 조정한다 —
 *    "아무것도 안 뜰 때까지 늘리기"는 과최적화다(볼트 §6 남은 작업 4).
 */
export const COLLECTION_STALL_DAYS = 14;

/** 기본 공식이 정말 볼트 표와 같은지 — 테스트가 이 함수로 대조한다. */
export function defaultStaleDays(freq: ReleaseFreq): number {
  const f = FREQ_DAYS[freq];
  // ⚠ 올림이다. 내림으로 하면 분기가 227이 되어 볼트 표(228)와 하루 어긋난다.
  return f + f + Math.max(5, Math.ceil(f / 2));
}

export type FreshnessInput = {
  /** 마지막 **관측치**의 날짜(YYYY-MM-DD). 없으면 값이 하나도 없다는 뜻. */
  asOf?: string;
  /** 마지막 **수집 성공** 시각(ISO). 수동 지표는 원래 없는 게 정상이다. */
  fetchedAt?: string;
  freq: ReleaseFreq;
  /** 발표지연이 구조적으로 더 긴 계열의 예외. ⚠ 근거(`staleWhy`) 없이 쓰지 않는다. */
  staleDays?: number;
  /** 사람이 채우는 지표인가 */
  manual: boolean;
  now: Date;
};

export type MacroFreshness = {
  asOf?: string;
  fetchedAt?: string;
  /** 이 날짜를 넘기면 낡은 값으로 본다 */
  staleAfter?: string;
  /** 값이 하나도 없다 */
  missing: boolean;
  /** ⚠ 값이 낡았다 */
  stale: boolean;
  /** 기한을 며칠 넘겼나 */
  overdueDays: number;
  /** ⚠ 자동 지표인데 수집이 끊겼다 — `stale`과 다른 사고다 */
  stalled: boolean;
  stalledDays: number;
  /** 자동인데 수집 기록이 아예 없다 — "언제 들어왔는지 모르는 값" */
  neverFetched: boolean;
  manual: boolean;
};

function addDays(date: string, days: number): string {
  const t = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(t)) return date;
  return new Date(t + days * 86_400_000).toISOString().slice(0, 10);
}

function daysBetween(fromIso: string, now: Date): number | null {
  const t = Date.parse(fromIso.length === 10 ? `${fromIso}T00:00:00Z` : fromIso);
  if (Number.isNaN(t)) return null;
  return Math.floor((now.getTime() - t) / 86_400_000);
}

/** 이 계열의 기한 날짜. 예외가 있으면 그게 이긴다. */
export function staleAfter(asOf: string, freq: ReleaseFreq, staleDays?: number): string {
  return addDays(asOf, staleDays ?? STALE_RULE[freq]);
}

/**
 * 지금 이 지표를 믿어도 되는가.
 *
 * ⚠ **값이 없는 것과 낡은 것을 같게 다루지 않는다.** 없는 것은 `missing`이고
 *   낡음 판정 자체가 성립하지 않는다(CLAUDE.md §3).
 */
export function judgeFreshness(input: FreshnessInput): MacroFreshness {
  const base: MacroFreshness = {
    asOf: input.asOf,
    fetchedAt: input.fetchedAt,
    missing: !input.asOf,
    stale: false,
    overdueDays: 0,
    stalled: false,
    stalledDays: 0,
    neverFetched: false,
    manual: input.manual,
  };

  if (input.asOf) {
    const limit = staleAfter(input.asOf, input.freq, input.staleDays);
    const over = daysBetween(limit, input.now);
    base.staleAfter = limit;
    if (over !== null && over > 0) {
      base.stale = true;
      base.overdueDays = over;
    }
  }

  /**
   * ⚠ 수집 끊김은 **자동 지표에만** 묻는다. 수동 지표에 수집 기록이 없는 것은
   *   정상이고, 그걸 경고로 띄우면 진짜 끊긴 자동 지표가 같은 색에 묻힌다
   *   (볼트 §5-2 "'수동'과 '낡음'을 분리한 이유"와 같은 판단이다).
   */
  if (!input.manual) {
    if (!input.fetchedAt) {
      // 값은 있는데 언제 들어왔는지 모른다 — 최신이라고 말할 근거가 없다.
      base.neverFetched = !base.missing;
    } else {
      const since = daysBetween(input.fetchedAt, input.now);
      if (since !== null && since >= COLLECTION_STALL_DAYS) {
        base.stalled = true;
        base.stalledDays = since;
      }
    }
  }

  return base;
}

/**
 * 화면에 붙일 뱃지 한 줄. 문제가 없으면 null — **정상일 때는 조용하다.**
 * ⚠ 늘 떠드는 경고는 곧 무시된다(볼트 §6 판정 원장 카드와 같은 규칙).
 */
export function freshnessBadge(f: MacroFreshness): string | null {
  if (f.missing) return null; // '수집 안 됨'은 값 표시 자리가 이미 말한다
  if (f.stalled) return `수집 끊김 ${f.stalledDays}일`;
  if (f.neverFetched) return "수집기록 없음";
  if (f.stale) return f.manual ? `수동·기한초과 ${f.overdueDays}일` : `기한초과 ${f.overdueDays}일`;
  return null;
}

/** 뱃지의 무게 — 색을 고르는 쪽이 이걸 본다. 색 이름을 여기 넣지 않는다(순수 모듈). */
export type FreshnessTone = "stalled" | "stale" | "unknown" | "ok";

export function freshnessTone(f: MacroFreshness): FreshnessTone {
  if (f.stalled) return "stalled";
  if (f.neverFetched) return "unknown";
  if (f.stale) return "stale";
  return "ok";
}

export type MacroHealth = {
  total: number;
  /** 값이 있고 기한 안 */
  ok: number;
  /** 자동 수집이 끊긴 것 */
  stalled: number;
  /** 자동인데 값이 낡은 것 */
  stale: number;
  /** 수동인데 값이 낡은 것 — 대응이 다르다(사람이 새로 조사해야 한다) */
  manualStale: number;
  /** 값이 아예 없는 것 */
  missing: number;
};

export function summarizeHealth(list: MacroFreshness[]): MacroHealth {
  const health: MacroHealth = {
    total: list.length,
    ok: 0,
    stalled: 0,
    stale: 0,
    manualStale: 0,
    missing: 0,
  };

  for (const f of list) {
    if (f.missing) health.missing += 1;
    else if (f.stalled) health.stalled += 1;
    else if (f.stale && f.manual) health.manualStale += 1;
    else if (f.stale) health.stale += 1;
    else health.ok += 1;
  }
  return health;
}

/**
 * 화면 상단 건강도 한 줄. 전부 정상이면 null —
 * ⚠ **정상일 때 침묵하는 것이 이 줄의 값어치다.** 늘 무언가 떠 있으면 아무도 안 읽는다.
 */
export function healthNotice(h: MacroHealth): string | null {
  const bits: string[] = [];
  if (h.stalled > 0) bits.push(`수집 끊김 ${h.stalled}건`);
  if (h.stale > 0) bits.push(`기한초과 ${h.stale}건`);
  if (h.manualStale > 0) bits.push(`수동 갱신 필요 ${h.manualStale}건`);
  if (h.missing > 0) bits.push(`수집 안 됨 ${h.missing}건`);
  if (bits.length === 0) return null;
  return `${h.total}개 중 ${bits.join(" · ")}`;
}

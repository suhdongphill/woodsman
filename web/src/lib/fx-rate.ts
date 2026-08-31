/**
 * 원/달러 환율을 **무엇으로 쓸지** 정한다 — 순수 판단 모듈.
 *
 * ## 왜 있나 (2026-08-31)
 * 달러 종목을 원화로 환산하는 환율이 `SiteConfig`의 **수기 입력값**이었다.
 * 사람이 고치지 않으면 영원히 그대로라, 운영본이 **1,350원**으로 굳어 있었다 —
 * 실제 환율이 1,368~1,414 사이를 오가는 동안 내내 그랬다.
 *
 * ⚠ 이건 화면 하나의 문제가 아니다. 이 값은 `lib/allocation.ts`가 **비중과 평가액**을
 *    만드는 데 쓴다. 틀린 환율은 「성장 버킷 32%」 같은 **틀린 사실**을 만들어 낸다.
 *    (2026-08-02에 환산을 아예 빼먹어 성장 버킷이 0.1%로 나온 적이 있다 — 같은 자리다.)
 *
 * ## ⚠ 값이 아니라 **기준일이 있는 값**을 쓴다
 * 수기값의 진짜 문제는 틀린 것보다 **언제 기준인지 아무도 모른다**는 것이다.
 * 수집값은 낡아도 날짜가 붙어 있어서 낡았다고 말할 수 있다. 그래서
 * **수집값이 낡았어도 수집값을 쓰고, 낡았다는 사실을 화면에 적는다** —
 * 날짜 없는 숫자로 바꿔치기하지 않는다(운영지침 §5).
 *
 * ⚠ 수기 설정값은 **지우지 않았다.** 수집 전이거나 수집이 죽었을 때의 마지막 안전망이고,
 *    그때는 화면이 **설정값을 쓰는 중이라고 밝힌다**(조용히 떨어지지 않는다 — CLAUDE.md §3).
 */
import { judgeFreshness, type ReleaseFreq } from "./macro/freshness";

/** 이 숫자가 어디서 왔나. */
export type UsdKrwOrigin =
  /** 수집된 관측치 */
  | "COLLECTED"
  /** ⚠ 수집값이 없어서 관리자 설정값으로 떨어졌다 */
  | "SETTING";

export type UsdKrwRate = {
  rate: number;
  /** 관측 기준일(YYYY-MM-DD). 설정값을 쓸 때는 `null` — **없는 날짜를 지어내지 않는다.** */
  asOf: string | null;
  origin: UsdKrwOrigin;
  /** 수집값이 기한을 넘겼나 */
  stale: boolean;
  /** 기한을 며칠 넘겼나 */
  overdueDays: number;
  /**
   * 화면이 **그대로 쓰는** 한 줄. ⚠ 숫자와 기준일을 떼어 놓을 수 없게 여기서 붙인다 —
   * 화면마다 따로 조립하면 어딘가는 날짜를 빠뜨린다.
   */
  caption: string;
};

export type UsdKrwInput = {
  /** 수집된 최신 관측치 */
  collected: { value: number; asOf: string } | null;
  /** 관리자 설정값(`SiteConfig.usdKrwRate`) */
  setting: number;
  /** 발표 주기 — 카탈로그의 값을 그대로 넘긴다 */
  freq: ReleaseFreq;
  /** 카탈로그의 기한 예외(있으면) */
  staleDays?: number;
  now: Date;
};

/** 1,368.5 — 소수 한 자리(카탈로그 `decimals: 1`과 맞춘다). */
function won(n: number): string {
  return `${n.toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}원`;
}

export function resolveUsdKrw(input: UsdKrwInput): UsdKrwRate {
  const { collected, setting, now } = input;

  // ⚠ 수집값이 없다. 설정값을 쓰되 **그렇다고 말한다.** 조용히 떨어지지 않는다.
  if (!collected) {
    return {
      rate: setting,
      asOf: null,
      origin: "SETTING",
      stale: false,
      overdueDays: 0,
      caption: `1달러 = ${won(setting)} · ⚠ 환율을 아직 수집하지 못해 관리자 설정값을 씁니다`,
    };
  }

  const fresh = judgeFreshness({
    asOf: collected.asOf,
    freq: input.freq,
    staleDays: input.staleDays,
    manual: false,
    now,
  });

  return {
    rate: collected.value,
    asOf: collected.asOf,
    origin: "COLLECTED",
    stale: fresh.stale,
    overdueDays: fresh.overdueDays,
    caption: fresh.stale
      ? // ⚠ 낡았어도 이 값을 쓴다. 대신 며칠 밀렸는지를 숫자로 말한다 —
        //   "최신이 아닐 수 있습니다" 같은 말은 아무 정보도 주지 않는다.
        `1달러 = ${won(collected.value)} · ${collected.asOf} 기준 · ⚠ ${fresh.overdueDays}일 밀렸습니다`
      : `1달러 = ${won(collected.value)} · ${collected.asOf} 기준`,
  };
}

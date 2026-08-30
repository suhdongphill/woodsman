/**
 * 주도주 섹터 판단 — 순수 모듈.
 *
 * ## 무엇에 답하나
 * **"지금 돈은 어느 섹터로 흐르고 있나."**
 *
 * 두 가지로 답한다.
 * - **52주 위치** — 1년 고가에 얼마나 가까운가(0~100).
 * - **상대강도** — 같은 기간 시장(SPY)보다 얼마나 앞섰나(%p).
 *
 * ## ⚠ 이름을 정확히 붙인다
 * 이것은 **자금 유입 통계가 아니다.** 진짜 자금유입은 설정주식수·AUM 변화인데 무료로
 * 신뢰성 있게 얻을 길이 없다. 여기서 재는 것은 **가격이 만든 결과**다.
 * "자금이 들어왔다"가 아니라 **"시장보다 앞섰다"** 라고 적는다.
 *
 * ## ⚠ 값이 모자라면 판정하지 않는다
 * 시계열이 짧으면 52주 고가가 고가가 아니다. 최소 개수를 못 채우면 `null`을 돌려주고,
 * 화면은 그 자리를 "아직 판정할 수 없음"으로 적는다.
 */

/** 52주 ≈ 영업일 252일. 이보다 짧으면 "1년 고가"라고 부를 수 없다. */
export const YEAR_TRADING_DAYS = 252;

/** 판정에 필요한 최소 점 수. ⚠ 낮추면 숫자는 나오지만 그 숫자가 거짓이 된다. */
export const MIN_POINTS = 60;

/** 주도주로 부르는 기준 — 신고가에 가깝고(≥85) 시장을 앞선다(>0). */
export const LEADER_POSITION = 85;

export type PricePoint = { date: string; value: number };

export type SectorStrength = {
  key: string;
  name: string;
  /** 52주 고가 대비 위치(0~100). 100이면 신고가 */
  position: number;
  /** 기간 수익률(%) */
  changePct: number;
  /** 시장 대비 초과 수익(%p). 기준이 없으면 undefined */
  relative?: number;
  /** 이 값들의 기준일 */
  asOf: string;
  /** ⚠ 신고가 근처 + 시장을 앞섬 */
  leading: boolean;
};

/** 최근 N개만 남긴다. 날짜 오름차순 가정을 하지 않고 여기서 세운다. */
function recent(points: PricePoint[], days: number): PricePoint[] {
  return [...points].sort((a, b) => a.date.localeCompare(b.date)).slice(-days);
}

/**
 * 52주 고가 대비 위치(0~100).
 * ⚠ 고가와 저가가 같으면(값이 하나뿐이거나 평평하면) 나눌 수 없다 — `null`.
 */
export function positionInRange(points: PricePoint[]): number | null {
  const window = recent(points, YEAR_TRADING_DAYS);
  if (window.length < MIN_POINTS) return null;

  const values = window.map((p) => p.value);
  const high = Math.max(...values);
  const low = Math.min(...values);
  const last = values[values.length - 1];
  if (high === low) return null;

  return ((last - low) / (high - low)) * 100;
}

/** 기간 수익률(%). 시작값이 0 이하면 비율이 성립하지 않는다. */
export function periodChangePct(points: PricePoint[], days: number): number | null {
  const window = recent(points, days);
  if (window.length < 2) return null;

  const first = window[0].value;
  const last = window[window.length - 1].value;
  if (first <= 0) return null;

  return ((last - first) / first) * 100;
}

/**
 * 섹터 하나의 강도.
 *
 * @param benchmark 시장 기준(SPY) 시계열. 없으면 상대강도를 내지 않는다 —
 *                  ⚠ 기준 없이 "강하다"고 말하지 않는다.
 */
export function sectorStrength(
  input: { key: string; name: string; points: PricePoint[] },
  benchmark: PricePoint[] | undefined,
  windowDays = YEAR_TRADING_DAYS,
): SectorStrength | null {
  const position = positionInRange(input.points);
  const changePct = periodChangePct(input.points, windowDays);
  if (position === null || changePct === null) return null;

  const sorted = recent(input.points, windowDays);
  const asOf = sorted[sorted.length - 1].date;

  const benchChange = benchmark ? periodChangePct(benchmark, windowDays) : null;
  const relative = benchChange === null ? undefined : changePct - benchChange;

  return {
    key: input.key,
    name: input.name,
    position,
    changePct,
    relative,
    asOf,
    // ⚠ 상대강도를 모르면 주도주라고 부르지 않는다. 기준 없는 강함은 없다.
    leading: position >= LEADER_POSITION && (relative ?? -1) > 0,
  };
}

/** 강한 순서 — 상대강도 우선, 없으면 52주 위치. */
export function rankByStrength(items: SectorStrength[]): SectorStrength[] {
  return [...items].sort((a, b) => {
    const ar = a.relative ?? Number.NEGATIVE_INFINITY;
    const br = b.relative ?? Number.NEGATIVE_INFINITY;
    if (ar !== br) return br - ar;
    return b.position - a.position;
  });
}

/**
 * 한 줄 결론 — 방문자가 **가져갈 문장**이다.
 * ⚠ 만들 수 없으면 `null`. 없는 결론을 지어내지 않는다.
 */
export function leadersLede(items: SectorStrength[]): string | null {
  if (items.length === 0) return null;

  const leaders = rankByStrength(items).filter((s) => s.leading);
  if (leaders.length === 0) {
    const top = rankByStrength(items)[0];
    if (top.relative === undefined) return null;
    return `지금 뚜렷한 주도 섹터는 없습니다. 그중 ${top.name}이 시장 대비 ${fmtPct(top.relative)} 앞섭니다.`;
  }

  const names = leaders.slice(0, 2).map((s) => s.name).join(" · ");
  return `${names}이(가) 앞서고 있습니다 — 1년 고가 근처이면서 시장보다 강합니다.`;
}

function fmtPct(v: number): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%p`;
}

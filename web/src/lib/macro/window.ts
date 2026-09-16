/**
 * 화면 한 번에 **계열당 몇 점을 읽어야 하는가.**
 *
 * ## 왜 이 파일이 생겼나 (2026-09-16)
 * 홈·허브·관리자는 전체 시계열이 아니라 계열당 최근 N점만 읽는다(`loadRecentPoints`).
 * 그 N이 **14로 고정**돼 있었는데, 14점으로는 낼 수 없는 값이 넷 있었다 —
 * 주간 계열의 전년비(1년 전 짝이 14주 안에 없다)와 20일 실현변동성(창이 안 찬다).
 * 네 지표(`bank_credit_yoy` · `deposits_yoy` · `sofr_rvol` · `ust10y_rvol`)가
 * 관리자 화면에 **「미수집」으로만 떠 있었다.** 원자료는 다 쌓여 있었는데도.
 *
 * ⚠ 그래서 필요량을 **숫자로 적어 두지 않고 카탈로그에서 계산한다.** 지표를 새로 붙이는 사람이
 *   로더의 상수를 같이 고쳐야 한다는 걸 기억할 필요가 없어야 한다 — 기억에 기대면 같은 종류로 또 막힌다.
 * ⚠ 요구는 **파생 자신이 아니라 성분 계열에** 붙는다. 파생은 DB에 자기 행이 없다(`derived.ts`).
 */
import type { MacroDerived, MacroIndicator, MacroTransform } from "./types";
import type { ReleaseFreq } from "./freshness";

/**
 * 변환이 과거를 필요로 하지 않을 때의 창.
 * "지금 값 + 직전 대비 변화"에 둘이면 되지만, 휴장·결측으로 앞이 비는 계열이 있어 넉넉히 둔다.
 */
export const BASE_POINTS = 14;

/**
 * 한 해에 몇 점이 쌓이나. ⚠ 달력이 아니라 **발표 횟수**다(일간은 영업일).
 * 전년비는 1년 전 짝을 찾아야 하므로 이만큼이 창 안에 들어와야 한다.
 */
const POINTS_PER_YEAR: Record<ReleaseFreq, number> = { d: 264, w: 54, m: 13, q: 5 };

/** 이 지표가 **자기 계열에서** 값을 내는 데 필요한 점 수. */
export function pointsForTransform(transform: MacroTransform, freq: ReleaseFreq): number {
  // ⚠ 전년비만 과거를 멀리 본다. mom·momdiff는 바로 앞 점이면 되고, level* 은 한 점이면 된다.
  if (transform === "yoy") return POINTS_PER_YEAR[freq] + 2;
  return BASE_POINTS;
}

/** 파생이 **성분에게** 요구하는 점 수. */
export function pointsForDerived(spec: MacroDerived): number {
  /**
   * ⚠ 실현변동성은 창이 다 차기 전에는 값을 내지 않는다(`realizedVolBp` — 짧은 창의 표준편차는
   *   과장되거나 0이 된다). 변화 `window`개를 만들려면 점이 `window + 1`개 있어야 하고,
   *   휴장으로 한 칸이 끊기면(gap > carryDays) 창을 처음부터 다시 채우므로 한 점을 더 둔다.
   */
  if (spec.op === "realizedVolBp") return (spec.window ?? 0) + 2;
  return BASE_POINTS;
}

/**
 * 계열 키별 최소 필요 점수.
 *
 * 한 계열이 여러 쓰임을 가지면(예: `sofr`는 그 자체로도 보이고 `sofr_rvol`의 성분이기도 하다)
 * **가장 많이 요구하는 쪽**을 따른다.
 */
export function pointsNeededBySeries(
  indicators: readonly MacroIndicator[],
): Map<string, number> {
  const need = new Map<string, number>();
  const bump = (key: string, n: number) => {
    need.set(key, Math.max(need.get(key) ?? BASE_POINTS, n));
  };

  for (const indicator of indicators) {
    if (indicator.derived) {
      const n = pointsForDerived(indicator.derived);
      for (const key of indicator.derived.from) bump(key, n);
      continue;
    }
    bump(indicator.key, pointsForTransform(indicator.transform, indicator.freq));
  }
  return need;
}

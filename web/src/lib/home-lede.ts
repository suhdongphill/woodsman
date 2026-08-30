/**
 * 첫 화면의 한 줄 — **지금 어떤 바람이 부는가**. 순수 모듈.
 *
 * ## 왜 있나
 * 홈이 콘텐츠로 열린다면, 첫 화면은 **오늘의 상태를 한 줄로** 말할 수 있어야 한다.
 * "일기예보를 보고 우산을 챙기듯" 읽는 자리이므로, 들어오자마자 **오늘의 하늘**이 보여야 한다.
 *
 * ## ⚠ 규칙 — 없으면 지어내지 않는다
 * 값이 없을 때 그럴듯한 문장을 만들면 **없는 사실이 생긴다.** 이 프로젝트에서 가장 크게
 * 데인 부류다(빈 칸을 0으로 만들지 않는다 · 화면이 하지 않는 일을 한다고 적지 않는다).
 * 그래서 이 함수는 **`null`을 돌려주는 것을 부끄러워하지 않는다** — 화면은 그때 한 줄을 뺀다.
 */

export type LedeSummary = {
  /** 배지에 쓰는 짧은 말 — 예: "침체 신호 안정" */
  label: string;
  /** 경고로 켜진 지표 수 */
  alerts: number;
  /** 판정에 쓴 지표 수 */
  total: number;
};

export type LedeInput = {
  /** 수집된 값이 하나도 없나 */
  empty: boolean;
  summary: LedeSummary;
  /** 전체에서 가장 최근 기준일 */
  asOf?: string;
};

/**
 * 한 줄을 만든다. 만들 수 없으면 `null`.
 *
 * ⚠ **기준일을 함께 낸다.** 날짜 없는 판정은 실시간으로 읽힌다(운영지침 §5).
 * ⚠ 경고가 있으면 **숫자로 말한다.** "주의하세요" 같은 말은 아무 정보도 주지 않는다.
 */
export function macroLede(input: LedeInput): string | null {
  // 값을 하나도 못 받았으면 할 말이 없다. 없는 상태를 문장으로 덮지 않는다.
  if (input.empty) return null;
  // 판정에 쓴 지표가 0개면 등급 자체가 성립하지 않는다.
  if (input.summary.total <= 0) return null;

  /**
   * ⚠ **주어를 붙인다.** 등급만 적으면 독자가 "무엇이 안정?"이라고 되묻는다.
   *    아래 보드에는 「침체 신호 안정」으로 나오는데 첫 줄에서만 주어가 빠져 있었다
   *    (2026-08-30 독자 관점 점검).
   */
  const label = input.summary.label.includes("침체")
    ? input.summary.label
    : `침체 신호 ${input.summary.label}`;
  const parts = [label];
  if (input.summary.alerts > 0) parts.push(`경고 ${input.summary.alerts}개`);
  parts.push(`지표 ${input.summary.total}개 종합`);
  if (input.asOf) parts.push(`${input.asOf} 기준`);

  return parts.join(" · ");
}

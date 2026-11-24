/**
 * 공개 화면에서 쓰는 말 — 순수 모듈(2026-11-15).
 *
 * ## 왜 있나
 * 홈은 「커버리지 71%」라고 쓰고, 같은 숫자를 조류 AI 해설은 「반영률」로 불렀다(`gcrm/commentary.ts` 프롬프트가
 * 「커버리지」를 내부 용어로 금지한다). 독자에게는 같은 숫자가 두 이름으로 보였다.
 * 화면 문구를 이 한 곳에서 꺼내 쓴다 — 말을 바꿀 때 여기만 고치면 된다.
 *
 * ⚠ 코드의 변수명(`coverage`)·관리자 화면·설계 문서의 「커버리지」는 그대로다. **독자에게 보이는 말**만 여기서 정한다.
 */

/** 설계한 지표 가운데 지금 자료가 들어와 점수에 반영된 비율(가중치 기준). 예: 「반영률 71%」 */
export const COVERAGE_LABEL = "반영률";

/** 숫자에 마우스를 올리면 뜨는 설명(title) */
export const COVERAGE_HINT = "설계한 지표 가운데 지금 자료가 들어와 점수에 반영된 비율(가중치 기준)";

/** 「반영률 71%」 — 반올림은 부르는 쪽이 하지 않아도 된다 */
export function coverageText(pct: number): string {
  return `${COVERAGE_LABEL} ${Math.round(pct)}%`;
}

/**
 * ⭐ 공개 화면의 기둥 이름(2026-11-15 운영자 승인 「GCRM 물가 압력」·「포털 물가 압력 점수」).
 * 「엔진 온도」라는 비유보다 무엇을 재는지(근원 물가·임금·에너지·기대인플레) 바로 보이게.
 * ⚠ GCRM 설정의 `nameKo`(`gcrm/config/pillars.ts`)는 **바꾸지 않는다** — 설정 해시에 들어가 축 이력·run 연결이 흔들린다.
 *   공개 문장을 만드는 곳(홈 칩 · AI 해설 사실표)이 이 표로 바꿔 끼운다.
 */
export const PUBLIC_PILLAR_NAMES: Record<string, string> = {
  engine_heat: "물가 압력",
};

export function publicPillarName(code: string, nameKo: string): string {
  return PUBLIC_PILLAR_NAMES[code] ?? nameKo;
}

/**
 * ⭐ 공개 화면의 GCRM 지표 이름(2026-11-24). `gcrm/config/indicators.ts`의 `nameKo`는 설정 해시에 들어가므로 **바꾸지 않고** 여기서 바꿔 끼운다.
 * - term_premium: THREEFYTP10은 Kim–Wright(연준 이사회) 모형인데 설정 이름이 「ACM」이었다(FRED 원문 대조).
 */
export const PUBLIC_INDICATOR_NAMES: Record<string, string> = {
  term_premium: "10년 텀 프리미엄 (Kim–Wright)",
};

export function publicIndicatorName(code: string, nameKo: string): string {
  return PUBLIC_INDICATOR_NAMES[code] ?? nameKo;
}

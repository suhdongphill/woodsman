/**
 * 그날의 분석(외부 보고서 붙여넣기) 점검 — 순수 함수. 통합 계획 S4 설계 3.
 *
 * ## 운영자 결정 (2026-09-14)
 * 점수는 **우리 계산**으로 낸다. 외부 보고서(예: ChatGPT Global Capital Regime Monitor)에서는 **출처 있는 사실과 해석 문장만** 싣고,
 * **산식 없는 점수 · Confidence %는 빼고** 싣는다 — 개발요구서 v2 「산식 없는 점수와 자유 퍼센트는 싣지 않는다」를 지킨다.
 *
 * ## ⚠ 이 함수는 지우지 않는다
 * 찾아서 **줄 번호와 함께 알려 줄 뿐**이다. 「Brent $104.61, -2.81%」 같은 **출처 있는 사실의 퍼센트**까지 기계로 지우면 사실이 사라진다 —
 * 어느 문장을 뺄지는 운영자가 고른다. 저장 화면이 이 결과를 보여 주고 확인을 받는다.
 */

export type GuardFinding = {
  line: number;
  kind: "score_out_of_100" | "confidence" | "percent_table_row" | "score_table_row" | "score_arithmetic";
  text: string;
};

const SCORE_OUT_OF_100 = /\b\d{1,3}\s*\/\s*100\b/;
const CONFIDENCE = /\bconfidence\b|확신도|신뢰도\s*\d/i;
/** 표 한 줄에 퍼센트만 달린 모양 — 「Geopolitical Energy Supply Shock    98%」 · 「ETF Institutional Flow    90%」 */
const PERCENT_TABLE_ROW = /^[^\d$%\-+]{3,80}\s{2,}\d{1,3}%\s*[↑↓→]?\s*$/;
/**
 * 조종석 표의 점수 행 — 「Engine Heat    95    94    ↑    판단」(오늘 · 직전 · 방향).
 * ⚠ 2026-09-14 초안 확인에서 놓쳤다: 「/100」도 「%」도 없어 앞의 셋에 걸리지 않았다.
 */
const SCORE_TABLE_ROW = /^\S[^\d]{1,60}?\s{2,}\d{1,3}\s{2,}\d{1,3}\s{2,}[↑↓→]/;
/**
 * 산식 없는 하위 점수의 가중 계산 — 「0.7 × 63 + 0.3 × 99 ≈ 74」.
 * ⚠ 계수(0.x) × 점수 모양만 본다 — 「$104.61, -2.81%」 같은 사실 숫자는 이 모양이 아니다.
 */
const SCORE_ARITHMETIC = /\b0?\.\d+\s*[×x*]\s*\d{1,3}\b[^\n]*[≈=]\s*\d{1,3}\b/;

export function findUnsourcedScores(body: string): GuardFinding[] {
  const out: GuardFinding[] = [];
  body.split(/\r?\n/).forEach((raw, i) => {
    const text = raw.trim();
    if (!text) return;
    if (SCORE_OUT_OF_100.test(text)) out.push({ line: i + 1, kind: "score_out_of_100", text });
    else if (CONFIDENCE.test(text)) out.push({ line: i + 1, kind: "confidence", text });
    else if (PERCENT_TABLE_ROW.test(raw)) out.push({ line: i + 1, kind: "percent_table_row", text });
    else if (SCORE_TABLE_ROW.test(raw)) out.push({ line: i + 1, kind: "score_table_row", text });
    else if (SCORE_ARITHMETIC.test(text)) out.push({ line: i + 1, kind: "score_arithmetic", text });
  });
  return out;
}

export const GUARD_KIND_LABEL: Record<GuardFinding["kind"], string> = {
  score_out_of_100: "산식 없는 점수(NN/100)",
  confidence: "Confidence · 신뢰도 표기",
  percent_table_row: "퍼센트만 달린 표 줄(경쟁가설·설명력 등)",
  score_table_row: "점수 표 줄(오늘·직전·방향)",
  score_arithmetic: "산식 없는 점수의 가중 계산",
};

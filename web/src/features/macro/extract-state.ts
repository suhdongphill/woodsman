/**
 * 지표값 추출 폼 상태. `"use server"` 파일은 async 함수만 export할 수 있어 여기 둔다.
 * ⚠ 여기에 키·본문 전체를 담지 않는다 — 폼 상태는 브라우저로 내려간다.
 */
export type ExtractState = {
  /** 어느 지표를 대상으로 돌렸나 */
  indicatorKey?: string;
  indicatorName?: string;
  /** 사람이 준 출처 */
  url?: string;
  /** 후보 값 */
  value?: number;
  date?: string;
  quote?: string;
  note?: string;
  /** 누가 답했나 */
  provider?: string;
  model?: string;
  /** 걸렀으면 그 이유 */
  rejected?: string;
  error?: string;
  /** 저장 결과 */
  saved?: string;
};

export const emptyExtractState: ExtractState = {};

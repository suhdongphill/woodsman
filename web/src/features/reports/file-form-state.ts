/** 보고서 파일 폼 상태. `"use server"` 파일은 async 함수만 export할 수 있어 여기 둔다. */
export type ReportFileFormState = {
  error?: string;
  /** 저장된 티커 — 미리보기 링크 */
  savedTicker?: string;
};

export const emptyReportFileFormState: ReportFileFormState = {};

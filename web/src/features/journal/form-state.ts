/**
 * 투자일지 폼 상태.
 * `"use server"` 파일은 async 함수만 export할 수 있어 상수·타입은 여기 둔다.
 */
export type JournalFormState = {
  error?: string;
  /** 저장 성공 시각 — 화면이 "저장됨"을 띄우는 근거 */
  savedAt?: string;
};

export const emptyJournalFormState: JournalFormState = {};

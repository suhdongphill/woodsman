/** 연구 라이브러리 폼 상태. `"use server"` 파일은 async 함수만 export할 수 있어 여기 둔다. */
export type ResearchImportState = {
  error?: string;
  /** 파일 검사 오류 — 하나라도 있으면 아무것도 넣지 않았다 */
  errors?: string[];
  done?: { inserted: number; updated: number; unchanged: number; conflicts: { id: string; withId: string; reason: string }[] };
};

export const emptyResearchImportState: ResearchImportState = {};

export type ResearchVerifyState = { error?: string; savedAt?: string };
export const emptyResearchVerifyState: ResearchVerifyState = {};

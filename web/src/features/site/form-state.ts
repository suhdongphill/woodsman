/**
 * 사이트 기본값 폼 상태.
 * `"use server"` 파일은 async 함수만 export할 수 있어 상수·타입은 여기 둔다.
 */
export type SiteFormState = {
  error?: string;
  savedAt?: string;
};

export const emptySiteFormState: SiteFormState = {};

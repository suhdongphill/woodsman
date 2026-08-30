/** 광고 설정 폼 상태. `"use server"` 파일은 async 함수만 export할 수 있어 여기 둔다. */
export type AdsFormState = {
  error?: string;
  savedAt?: string;
  /** 저장 직후의 노출 여부 — 화면이 "켰다/껐다"를 정확히 말하게 */
  enabled?: boolean;
};

export const emptyAdsFormState: AdsFormState = {};

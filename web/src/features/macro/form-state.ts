/**
 * 거시 지표 화면의 폼 상태.
 * `"use server"` 파일은 async 함수만 export할 수 있어 상수·타입은 여기 둔다.
 */
export type MacroFormState = {
  error?: string;
  /** 저장·수집 성공 시각 */
  savedAt?: string;
  /** 수집 결과 요약 — 관리자 화면이 그대로 보여준다 */
  summary?: string;
  /** 실패한 지표 목록(키: 사유). ⚠ 실패를 숨기지 않는다. */
  failures?: { key: string; error: string }[];
};

export const emptyMacroFormState: MacroFormState = {};

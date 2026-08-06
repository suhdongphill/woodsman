/**
 * 사용자 관리 폼 상태.
 * ⚠ `"use server"` 파일은 async 함수만 export할 수 있어 상수·타입은 여기 둔다.
 */
/** 실패했을 때만 할 말이 있다 — 성공하면 목록에서 그 줄이 사라진다. */
export type UserFormState = { error?: string };

export const emptyUserFormState: UserFormState = {};

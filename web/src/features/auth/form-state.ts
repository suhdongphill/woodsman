/**
 * 폼 상태 타입 · 초기값.
 *
 * `"use server"` 파일은 async 함수 외에는 아무것도 export할 수 없어서
 * (Next.js: invalid-use-server-value) 상수는 여기로 분리한다.
 * 클라이언트 컴포넌트가 안전하게 import할 수 있다.
 */
export type AuthFormState = { error: string | null };

export const emptyAuthFormState: AuthFormState = { error: null };

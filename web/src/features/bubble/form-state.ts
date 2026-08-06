/**
 * 버블 모니터 폼 상태.
 * ⚠ `"use server"` 파일은 **async 함수만** export할 수 있다. 상수·타입은 여기 둔다.
 */
export type BubbleFormState = { error?: string; savedAt?: string };

export const emptyBubbleFormState: BubbleFormState = {};

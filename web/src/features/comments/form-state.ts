/**
 * 댓글 폼 상태.
 * ⚠ `"use server"` 파일은 **async 함수만** export할 수 있어 상수·타입은 여기 둔다
 *   (어기면 액션 호출이 500으로 죽는다 — 두 번 겪었다).
 */
export type CommentFormState = {
  error?: string;
  /** 저장된 뒤 화면에 띄울 안내. 승인제면 "바로 안 보인다"를 말해 줘야 한다. */
  notice?: string;
  savedAt?: string;
};

export const emptyCommentFormState: CommentFormState = {};

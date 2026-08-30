/**
 * 콘텐츠 편집기 폼 상태.
 * `"use server"` 파일은 async 함수만 export할 수 있어 상수·타입은 여기 둔다.
 */
export type PostFormState = {
  error?: string;
  savedAt?: string;
  /** 새 글이면 저장 후 생긴 id — 화면이 "수정 중"으로 바뀐다 */
  savedId?: string;
  published?: boolean;
  /** 주소가 겹쳐 비켜 저장했을 때의 **실제 주소**. 조용히 바꾸지 않는다는 약속의 자리다. */
  slugAdjusted?: string;
};

export const emptyPostFormState: PostFormState = {};

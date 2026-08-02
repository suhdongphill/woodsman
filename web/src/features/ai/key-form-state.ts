/**
 * 키 등록 폼의 상태 타입.
 *
 * `"use server"` 파일은 async 함수만 export할 수 있어서 상수·타입은 여기 둔다
 * (auth의 form-state.ts와 같은 이유 — 예전에 빌드가 여기서 깨졌다).
 *
 * ⚠ 상태에 **키 값을 담지 않는다.** 폼 상태는 클라이언트로 직렬화돼 내려간다.
 */
export type KeyFormState = {
  /** 방금 저장된 env 변수명 (성공 표시용) */
  savedName?: string;
  error?: string;
};

export const emptyKeyFormState: KeyFormState = {};

/**
 * 버킷 액션의 상태 타입.
 *
 * ⚠ `"use server"` 파일에서 상수·타입을 export하면 액션 호출이 500으로 죽는다.
 *    그래서 여기 둔다(`features/reports/form-state.ts`와 같은 이유).
 */
export type BucketFormState = {
  savedAt?: string;
  error?: string;
  notice?: string;
};

export const emptyBucketFormState: BucketFormState = {};

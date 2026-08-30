/** 릴리스 폼 상태. `"use server"` 파일은 async 함수만 export할 수 있어 여기 둔다. */
export type ReleaseFormState = {
  error?: string;
  savedAt?: string;
};

export const emptyReleaseFormState: ReleaseFormState = {};

/** 무엇을 바꿨나. ⚠ 값을 바꾸면 옛 기록이 미아가 된다 — 더하기만 한다. */
export const RELEASE_KINDS = [
  { value: "LAYOUT", label: "배치" },
  { value: "COPY", label: "문구" },
  { value: "NAV", label: "메뉴" },
  { value: "VISUAL", label: "디자인" },
  { value: "CONTENT", label: "콘텐츠" },
  { value: "FIX", label: "고침" },
] as const;

/** 무엇으로 볼 것인가. ⚠ 1순위 지표가 기본값이다. */
export const RELEASE_METRICS = [
  { value: "TISTORY_CLICK", label: "티스토리로 넘어간 클릭" },
  { value: "VIEWS", label: "조회수" },
] as const;

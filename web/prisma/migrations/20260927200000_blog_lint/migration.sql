-- 블로그 글 편집 검사 결과(2026-09-27 (82)) — 동기화가 글 페이지를 읽을 때 `lib/blog/post-lint.ts`로 검사해 요약 JSON을 남긴다.
-- NULL = 아직 검사 안 함(다시 읽기 전). 관리자 /admin/blog에만 보인다.
ALTER TABLE "BlogEntry" ADD COLUMN "lint" TEXT;

-- 작업별 라우팅 정책 (2026-09-05).
--
-- ⚠ 기본값은 `cheapest` — 아무것도 안 정하면 지금까지와 똑같이 무료 우선으로 돈다.
-- ⚠ `best`로 바꿔도 **월 상한을 넘긴 유료는 후보에서 빠진다.** 모드가 상한을 이기지 않는다.
CREATE TABLE "AiTaskPolicy" (
    "task" TEXT NOT NULL PRIMARY KEY,
    "mode" TEXT NOT NULL DEFAULT 'cheapest',
    "updatedAt" DATETIME NOT NULL
);

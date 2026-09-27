-- 티스토리 블로그 글 목록(2026-09-27) — 홈 「블로그」와 `/blog`가 읽는다. 본문은 저장하지 않는다.
-- ⚠ 자동 수집은 summaryOverride·hidden을 덮지 않는다(운영자가 고친 것이 다음 수집에 사라지면 안 된다).
-- ⚠ likes NULL = 못 읽음(0과 다르다).
CREATE TABLE "BlogEntry" (
    "entryId" INTEGER NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "summaryOverride" TEXT,
    "category" TEXT,
    "thumbnailUrl" TEXT,
    "publishedAt" TEXT NOT NULL,
    "likes" INTEGER,
    "likesAt" TEXT,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "pageFetchedAt" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "BlogEntry_url_key" ON "BlogEntry"("url");
CREATE INDEX "BlogEntry_hidden_publishedAt_idx" ON "BlogEntry"("hidden", "publishedAt");

-- 수집 기록 — 「안 돌았다」와 「새 글이 없었다」를 구분한다.
CREATE TABLE "BlogSync" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trigger" TEXT NOT NULL,
    "startedAt" TEXT NOT NULL,
    "finishedAt" TEXT,
    "found" INTEGER NOT NULL DEFAULT 0,
    "added" INTEGER NOT NULL DEFAULT 0,
    "refreshed" INTEGER NOT NULL DEFAULT 0,
    "likesRead" INTEGER NOT NULL DEFAULT 0,
    "failCount" INTEGER NOT NULL DEFAULT 0,
    "failures" TEXT,
    "error" TEXT
);

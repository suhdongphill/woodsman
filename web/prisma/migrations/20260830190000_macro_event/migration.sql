-- 경제 캘린더 — 시장을 움직이는 일정(실적·지표·중앙은행).
--
-- ⚠ 이 표는 콘텐츠 파이프라인이다: 일정이 다음에 쓸 글을 알려 주고,
--    쓴 글(postSlug)이 다음 일정에서 다시 읽힌다.
-- ⚠ source/externalId는 **자동 수집을 나중에 붙일 자리**다.
--    사람이 고친 자동 항목을 수집기가 덮지 않게 하려면 출처 구분이 먼저 있어야 한다.
-- ⚠ 시각을 모르는 일정은 그 날 정오(UTC)로 넣는다. 자정으로 넣으면 KST에서 하루가 밀린다.
CREATE TABLE "MacroEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "at" DATETIME NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'US',
    "importance" INTEGER NOT NULL DEFAULT 2,
    "note" TEXT,
    "postSlug" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "externalId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 같은 수집원의 같은 일정을 두 번 넣지 않는다.
CREATE UNIQUE INDEX "MacroEvent_source_externalId_key" ON "MacroEvent"("source", "externalId");

-- 화면은 언제나 날짜순으로 읽는다.
CREATE INDEX "MacroEvent_at_idx" ON "MacroEvent"("at");

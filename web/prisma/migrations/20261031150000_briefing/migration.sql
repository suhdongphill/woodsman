-- 오늘의 브리핑(2026-10-31) — 관리자가 올린 원고(md·html)를 규칙으로 걸러(SNS 출처·채널 평가 제거) AI로 다듬은 **공개본**만 둔다.
-- ⚠ 원고 원문은 저장하지 않는다(SNS 출처가 DB에 남지 않게). 원문은 운영자의 briefing/ 폴더에 있다.
-- article = lib/briefing/article.ts `BriefingArticle` JSON. status = DRAFT(미리보기) | PUBLISHED.
CREATE TABLE "Briefing" (
    "date" TEXT NOT NULL PRIMARY KEY,
    "headline" TEXT NOT NULL,
    "article" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "editor" TEXT NOT NULL,
    "editNote" TEXT,
    "sourceName" TEXT,
    "publishedAt" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "Briefing_status_date_idx" ON "Briefing"("status", "date");

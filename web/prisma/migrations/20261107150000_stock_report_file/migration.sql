-- 종목별 보고서 파일·블로그 연결(2026-11-07) — 만들어 둔 보고서 HTML이나 티스토리 글을 종목에 잇는다.
-- html = 저장 전에 허용 목록으로 정화한 본문(lib/report/file.ts). 블로그만 잇는 행은 NULL이다.
-- status = DRAFT(미리보기) | PUBLISHED.
CREATE TABLE "StockReportFile" (
    "ticker" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "html" TEXT,
    "blogUrl" TEXT,
    "sourceName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "StockReportFile_status_publishedAt_idx" ON "StockReportFile"("status", "publishedAt");

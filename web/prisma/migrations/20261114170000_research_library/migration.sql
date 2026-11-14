-- 연구 라이브러리(2026-11-14 · v3) — 관리자 전용. 운영 GCRM 점수·가중치에 쓰는 경로가 없다.
CREATE TABLE "ResearchPaper" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "publishedDate" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "urlNorm" TEXT NOT NULL,
    "doi" TEXT,
    "topic" TEXT,
    "layer" TEXT NOT NULL,
    "horizon" TEXT NOT NULL,
    "fact" TEXT,
    "method" TEXT,
    "limitText" TEXT,
    "interpret" TEXT,
    "hypothesis" TEXT,
    "mapping" TEXT,
    "candidate" TEXT,
    "testPlan" TEXT,
    "counter" TEXT,
    "verifyStatus" TEXT NOT NULL DEFAULT 'CANDIDATE',
    "verifyNote" TEXT,
    "verifyAt" TEXT,
    "registeredAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL
);
CREATE INDEX "ResearchPaper_urlNorm_idx" ON "ResearchPaper"("urlNorm");
CREATE INDEX "ResearchPaper_doi_idx" ON "ResearchPaper"("doi");

CREATE TABLE "ResearchBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "cadence" TEXT,
    "summary" TEXT,
    "importedAt" TEXT NOT NULL
);

CREATE TABLE "ResearchImport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "at" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "baseline" TEXT,
    "notes" TEXT,
    "inserted" INTEGER NOT NULL,
    "updated" INTEGER NOT NULL,
    "unchanged" INTEGER NOT NULL,
    "conflicts" INTEGER NOT NULL,
    "conflictJson" TEXT
);

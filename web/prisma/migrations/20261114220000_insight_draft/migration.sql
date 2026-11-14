-- 인사이트 AI 초안(2026-11-14 · v3) — 운영자 편집·문단 뒤 발행. 추가만 한다.
CREATE TABLE "InsightDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "body" TEXT,
    "input" TEXT NOT NULL,
    "editor" TEXT NOT NULL,
    "problems" TEXT,
    "editedTitle" TEXT,
    "editedMain" TEXT,
    "operatorNote" TEXT,
    "postId" TEXT,
    "decidedAt" TEXT,
    "decidedBy" TEXT
);
CREATE INDEX "InsightDraft_status_createdAt_idx" ON "InsightDraft"("status", "createdAt");

-- GCRM 조류 해설(2026-11-14 · v3) — AI 초안 → 숫자 대조 → 운영자 승인. 추가만 한다.
CREATE TABLE "GcrmNarrative" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "asOf" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "body" TEXT,
    "facts" TEXT NOT NULL,
    "researchIds" TEXT,
    "editor" TEXT NOT NULL,
    "problems" TEXT,
    "createdAt" TEXT NOT NULL,
    "decidedAt" TEXT,
    "decidedBy" TEXT
);
CREATE INDEX "GcrmNarrative_runId_promptVersion_idx" ON "GcrmNarrative"("runId", "promptVersion");
CREATE INDEX "GcrmNarrative_status_asOf_idx" ON "GcrmNarrative"("status", "asOf");

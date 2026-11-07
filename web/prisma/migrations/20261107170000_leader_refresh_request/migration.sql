-- 주도주 최신화 요청(2026-11-07) — 관리자 버튼이 한 줄을 넣고, 볼트 refresh-leaders-on-request.ps1이 집어 돌린다.
-- status = REQUESTED | RUNNING | DONE | FAILED. 시각은 UTC ISO. 계좌 정보 없음.
CREATE TABLE "LeaderRefreshRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestedAt" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "startedAt" TEXT,
    "finishedAt" TEXT,
    "note" TEXT
);
CREATE INDEX "LeaderRefreshRequest_status_requestedAt_idx" ON "LeaderRefreshRequest"("status", "requestedAt");

-- 주도주 모니터(2026-09-25) — 볼트 `_data/leaders.json`·`leaders_fit.json` 의 **읽기 전용 사본**.
-- 볼트 `_scripts/export-portal-leaders.py` 가 굽고 `d1-exec-chunked.mjs` 로 싣는다. 판정(cls·tier)은 볼트가 낸 그대로다.
-- ⚠ 실행(run)마다 행을 쌓는다 — 지난 실행과 비교해 「이번 주 판정 변화」를 보이기 위해서다.
-- ⚠ 볼트는 LeaderRun 을 **맨 마지막에** 넣는다. 화면은 LeaderRun 에 있는 실행만 읽으므로 적재 중인 실행은 보이지 않는다.
CREATE TABLE "LeaderRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "collectedAt" TEXT NOT NULL,
    "meta" TEXT NOT NULL,
    "fit" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "LeaderGroup" (
    "runId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "ord" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "why" TEXT,
    "src" TEXT,
    "rsMedianM3" REAL,
    "breadthHigh" INTEGER,
    "leaders" INTEGER NOT NULL DEFAULT 0,
    "prime" INTEGER NOT NULL DEFAULT 0,
    "supply" TEXT,
    "etf" TEXT,
    PRIMARY KEY ("runId", "groupId")
);

CREATE TABLE "LeaderMember" (
    "runId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "ord" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "mkt" TEXT,
    "cls" TEXT,
    "tier" TEXT,
    "why" TEXT,
    "flag" TEXT,
    "rs3m" REAL,
    "offHigh" REAL,
    "revYoy" REAL,
    "accel" REAL,
    "detail" TEXT,
    PRIMARY KEY ("runId", "groupId", "ticker")
);

CREATE INDEX "LeaderMember_ticker_idx" ON "LeaderMember"("ticker");

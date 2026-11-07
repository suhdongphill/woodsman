-- 계좌 전체 기준 비율(2026-11-07) — 볼트가 계산한 비율만 둔다. 금액 칸이 없다(공개는 비중만).
CREATE TABLE "AccountAllocation" (
    "asOf" TEXT NOT NULL PRIMARY KEY,
    "growthPct" REAL NOT NULL,
    "incomePct" REAL NOT NULL,
    "defensePct" REAL NOT NULL,
    "cashPct" REAL NOT NULL,
    "updatedAt" TEXT NOT NULL
);

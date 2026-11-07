-- 섹터 ETF 월별 유입률(2026-11-07) — 볼트 record-rotation-watch.py가 싣는다. 관리자 화면 전용(공개 금지 — lib/sector-flow.ts).
CREATE TABLE "SectorEtfFlow" (
    "month" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "flowPct" REAL NOT NULL,
    "updatedAt" TEXT NOT NULL,
    PRIMARY KEY ("month", "ticker")
);

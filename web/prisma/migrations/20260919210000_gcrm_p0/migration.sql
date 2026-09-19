-- GCRM v2 — 계산 결과 테이블 (2026-09-19, P0).
--
-- 명세: docs/GCRM_설계점검_v2.md §2-17 · 설정: src/lib/gcrm/config/
--
-- ⚠ 원자료 테이블을 새로 만들지 않는다. 관측은 MacroPoint(L2)·MacroObservation(L1)을 그대로 읽고
--   여기에는 계산 결과만 쌓는다. 같은 지표가 사이트 안에서 두 값을 갖지 않게 하는 유일한 방법이다.
--
-- ⚠ 이 마이그레이션에서 **일부러 뺀 것**이 있다.
--   `prisma migrate diff`가 MacroEvent·PortfolioBucket을 함께 재생성하려 했다. 두 테이블의
--   차이는 **컬럼 순서뿐**이고(timeKnown 등을 ALTER로 붙여 끝에 있다), SQLite에서 컬럼 순서를
--   맞추려면 테이블을 DROP하고 다시 만들어야 한다. 운영 D1에서 그것은 **데이터 삭제**다.
--   GCRM과 무관한 변경이므로 여기에 싣지 않는다(변경은 한 번에 하나씩 — CLAUDE.md §7).
--   드리프트 자체는 남아 있다. 고칠 때는 별도 마이그레이션으로, 백업을 확인하고 한다.
--
-- ⚠ 날짜는 TEXT "YYYY-MM-DD"다. D1에 DATE 타입이 없고, ScoreValue.asOf가 이미 같은 관례다.

-- CreateTable
CREATE TABLE "GcrmRun" (
    "runId" TEXT NOT NULL PRIMARY KEY,
    "asOf" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "configHash" TEXT NOT NULL,
    "gitSha" TEXT,
    "basis" TEXT NOT NULL DEFAULT 'LIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "GcrmIndicatorScore" (
    "runId" TEXT NOT NULL,
    "indicator" TEXT NOT NULL,
    "axis" TEXT NOT NULL,
    "rawValue" REAL,
    "pctRank" REAL,
    "score" REAL,
    "staleness" REAL NOT NULL,
    "evidence" REAL NOT NULL,
    "baseWeight" REAL NOT NULL,
    "effWeight" REAL NOT NULL,
    "status" TEXT NOT NULL,
    "obsCount" INTEGER,
    "obsDate" TEXT,

    PRIMARY KEY ("runId", "indicator", "axis")
);

-- CreateTable
CREATE TABLE "GcrmPillarScore" (
    "runId" TEXT NOT NULL,
    "pillar" TEXT NOT NULL,
    "axis" TEXT NOT NULL,
    "scoreRaw" REAL,
    "scoreOri" REAL,
    "coverage" REAL NOT NULL,
    "confidence" REAL NOT NULL,
    "nUsed" INTEGER NOT NULL,
    "nTotal" INTEGER NOT NULL,
    "status" TEXT NOT NULL,

    PRIMARY KEY ("runId", "pillar", "axis")
);

-- CreateTable
CREATE TABLE "GcrmAxisScore" (
    "runId" TEXT NOT NULL,
    "axis" TEXT NOT NULL,
    "score" REAL,
    "direction" TEXT,
    "coverage" REAL,
    "confidence" REAL,
    "status" TEXT NOT NULL,

    PRIMARY KEY ("runId", "axis")
);

-- CreateTable
CREATE TABLE "GcrmRegimeScore" (
    "runId" TEXT NOT NULL PRIMARY KEY,
    "overall" REAL,
    "rte" REAL,
    "alignment" REAL,
    "proximity" REAL,
    "dirAgreement" REAL,
    "alignmentState" TEXT,
    "acuteWatch" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "GcrmSignal" (
    "signalId" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "stage" INTEGER NOT NULL,
    "firstSeen" TEXT NOT NULL,
    "persistN" INTEGER NOT NULL,
    "channels" TEXT NOT NULL,
    "note" TEXT
);

-- CreateTable
CREATE TABLE "GcrmRegimeState" (
    "asOf" TEXT NOT NULL PRIMARY KEY,
    "regimeCode" TEXT NOT NULL,
    "regimeKo" TEXT NOT NULL,
    "enteredAt" TEXT NOT NULL,
    "dwellDays" INTEGER NOT NULL,
    "prevRegime" TEXT,
    "entryReason" TEXT,
    "runId" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "GcrmRun_asOf_idx" ON "GcrmRun"("asOf");

-- CreateIndex
CREATE INDEX "GcrmRun_configHash_idx" ON "GcrmRun"("configHash");

-- CreateIndex
CREATE INDEX "GcrmIndicatorScore_runId_idx" ON "GcrmIndicatorScore"("runId");

-- CreateIndex
CREATE INDEX "GcrmPillarScore_runId_idx" ON "GcrmPillarScore"("runId");

-- CreateIndex
CREATE INDEX "GcrmSignal_runId_idx" ON "GcrmSignal"("runId");

-- CreateIndex
CREATE INDEX "GcrmSignal_stage_idx" ON "GcrmSignal"("stage");

-- CreateIndex
CREATE INDEX "GcrmRegimeState_regimeCode_idx" ON "GcrmRegimeState"("regimeCode");

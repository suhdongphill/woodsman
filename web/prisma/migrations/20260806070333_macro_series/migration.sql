-- CreateTable
CREATE TABLE "MacroPoint" (
    "seriesKey" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "value" REAL NOT NULL,
    "source" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("seriesKey", "date")
);

-- CreateTable
CREATE TABLE "MacroIngest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "trigger" TEXT NOT NULL DEFAULT 'MANUAL',
    "okCount" INTEGER NOT NULL DEFAULT 0,
    "failCount" INTEGER NOT NULL DEFAULT 0,
    "addedPoints" INTEGER NOT NULL DEFAULT 0,
    "detail" TEXT
);

-- CreateIndex
CREATE INDEX "MacroPoint_seriesKey_date_idx" ON "MacroPoint"("seriesKey", "date");

-- CreateIndex
CREATE INDEX "MacroIngest_startedAt_idx" ON "MacroIngest"("startedAt");

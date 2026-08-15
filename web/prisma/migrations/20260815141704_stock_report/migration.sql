-- CreateTable
CREATE TABLE "StockReport" (
    "ticker" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "industry" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "headline" TEXT NOT NULL,
    "verdictStructural" TEXT,
    "verdictShort" TEXT,
    "revokeIf" TEXT,
    "valuationLimitation" TEXT,
    "nextCheckAt" DATETIME,
    "consensusTarget" REAL,
    "consensusCurrency" TEXT,
    "consensusSource" TEXT,
    "consensusAsOf" DATETIME,
    "consensusUrl" TEXT,
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "StockReportBlock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticker" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "bodyHtml" TEXT NOT NULL DEFAULT '',
    "tag" TEXT,
    "source" TEXT,
    "sourceUrl" TEXT,
    "asOf" DATETIME,
    "lookupHint" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StockReportBlock_ticker_fkey" FOREIGN KEY ("ticker") REFERENCES "StockReport" ("ticker") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StockReportItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticker" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "points" INTEGER,
    "tag" TEXT NOT NULL DEFAULT 'na',
    "evidence" TEXT,
    "source" TEXT,
    "sourceUrl" TEXT,
    "asOf" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StockReportItem_ticker_fkey" FOREIGN KEY ("ticker") REFERENCES "StockReport" ("ticker") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StockChecklistItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticker" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "impact" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "StockChecklistItem_ticker_fkey" FOREIGN KEY ("ticker") REFERENCES "StockReport" ("ticker") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "StockReport_status_idx" ON "StockReport"("status");

-- CreateIndex
CREATE INDEX "StockReport_market_idx" ON "StockReport"("market");

-- CreateIndex
CREATE INDEX "StockReportBlock_ticker_idx" ON "StockReportBlock"("ticker");

-- CreateIndex
CREATE UNIQUE INDEX "StockReportBlock_ticker_sectionKey_key" ON "StockReportBlock"("ticker", "sectionKey");

-- CreateIndex
CREATE INDEX "StockReportItem_ticker_idx" ON "StockReportItem"("ticker");

-- CreateIndex
CREATE UNIQUE INDEX "StockReportItem_ticker_itemKey_key" ON "StockReportItem"("ticker", "itemKey");

-- CreateIndex
CREATE INDEX "StockChecklistItem_ticker_idx" ON "StockChecklistItem"("ticker");

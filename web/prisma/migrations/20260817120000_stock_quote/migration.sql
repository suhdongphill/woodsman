-- CreateTable
CREATE TABLE "StockQuote" (
    "ticker" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "close" REAL NOT NULL,
    "volume" REAL,
    "source" TEXT NOT NULL DEFAULT 'YAHOO',
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("ticker", "date")
);

-- CreateIndex
CREATE INDEX "StockQuote_ticker_date_idx" ON "StockQuote"("ticker", "date");

-- CreateTable
CREATE TABLE "StockQuoteIngest" (
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
CREATE INDEX "StockQuoteIngest_startedAt_idx" ON "StockQuoteIngest"("startedAt");

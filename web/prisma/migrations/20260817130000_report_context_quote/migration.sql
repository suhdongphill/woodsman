-- AlterTable — 시세(§02 히어로 KPI)
ALTER TABLE "StockReportContext" ADD COLUMN "quotePrice" REAL;
ALTER TABLE "StockReportContext" ADD COLUMN "quoteAsOf" DATETIME;
ALTER TABLE "StockReportContext" ADD COLUMN "quoteCurrency" TEXT;
ALTER TABLE "StockReportContext" ADD COLUMN "quoteChangePercent" REAL;
ALTER TABLE "StockReportContext" ADD COLUMN "quoteLow52" REAL;
ALTER TABLE "StockReportContext" ADD COLUMN "quoteHigh52" REAL;
ALTER TABLE "StockReportContext" ADD COLUMN "quotePosition52" REAL;
ALTER TABLE "StockReportContext" ADD COLUMN "quoteRangeSamples" INTEGER;
ALTER TABLE "StockReportContext" ADD COLUMN "quoteVolumeMultiple" REAL;
ALTER TABLE "StockReportContext" ADD COLUMN "quoteCaveat" TEXT;

-- AlterTable — Envelope(§09)
ALTER TABLE "StockReportContext" ADD COLUMN "envMiddle" REAL;
ALTER TABLE "StockReportContext" ADD COLUMN "envUpper" REAL;
ALTER TABLE "StockReportContext" ADD COLUMN "envLower" REAL;
ALTER TABLE "StockReportContext" ADD COLUMN "envPosition" REAL;
ALTER TABLE "StockReportContext" ADD COLUMN "envDeviation" REAL;
ALTER TABLE "StockReportContext" ADD COLUMN "envWeeks" INTEGER;

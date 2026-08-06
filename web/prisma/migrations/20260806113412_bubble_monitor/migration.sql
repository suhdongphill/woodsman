-- CreateTable
CREATE TABLE "BubbleReading" (
    "indicatorKey" TEXT NOT NULL PRIMARY KEY,
    "points" INTEGER NOT NULL,
    "value" TEXT,
    "asOf" DATETIME,
    "note" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BubbleTriggerState" (
    "triggerKey" TEXT NOT NULL PRIMARY KEY,
    "fired" BOOLEAN NOT NULL DEFAULT false,
    "proximity" TEXT NOT NULL DEFAULT 'far',
    "now" TEXT,
    "asOf" DATETIME,
    "updatedAt" DATETIME NOT NULL
);

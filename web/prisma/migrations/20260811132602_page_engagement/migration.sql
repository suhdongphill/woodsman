-- CreateTable
CREATE TABLE "PageEngagement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "path" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "samples" INTEGER NOT NULL DEFAULT 0,
    "dwell0" INTEGER NOT NULL DEFAULT 0,
    "dwell1" INTEGER NOT NULL DEFAULT 0,
    "dwell2" INTEGER NOT NULL DEFAULT 0,
    "dwell3" INTEGER NOT NULL DEFAULT 0,
    "dwell4" INTEGER NOT NULL DEFAULT 0,
    "dwell5" INTEGER NOT NULL DEFAULT 0,
    "dwell6" INTEGER NOT NULL DEFAULT 0,
    "scroll0" INTEGER NOT NULL DEFAULT 0,
    "scroll1" INTEGER NOT NULL DEFAULT 0,
    "scroll2" INTEGER NOT NULL DEFAULT 0,
    "scroll3" INTEGER NOT NULL DEFAULT 0,
    "scroll4" INTEGER NOT NULL DEFAULT 0,
    "reads" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "OutboundSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "path" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "PageEngagement_date_idx" ON "PageEngagement"("date");

-- CreateIndex
CREATE INDEX "PageEngagement_path_idx" ON "PageEngagement"("path");

-- CreateIndex
CREATE UNIQUE INDEX "PageEngagement_path_date_key" ON "PageEngagement"("path", "date");

-- CreateIndex
CREATE INDEX "OutboundSource_date_idx" ON "OutboundSource"("date");

-- CreateIndex
CREATE INDEX "OutboundSource_path_idx" ON "OutboundSource"("path");

-- CreateIndex
CREATE UNIQUE INDEX "OutboundSource_path_target_date_key" ON "OutboundSource"("path", "target", "date");

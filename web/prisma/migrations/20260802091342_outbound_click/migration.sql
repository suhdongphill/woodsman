-- CreateTable
CREATE TABLE "OutboundClick" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "target" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "OutboundClick_date_idx" ON "OutboundClick"("date");

-- CreateIndex
CREATE UNIQUE INDEX "OutboundClick_target_date_key" ON "OutboundClick"("target", "date");

-- CreateTable
CREATE TABLE "AccountSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "principal" REAL NOT NULL,
    "value" REAL NOT NULL,
    "income" REAL NOT NULL DEFAULT 0,
    "memo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "action" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "ticker" TEXT,
    "name" TEXT,
    "shares" REAL,
    "price" REAL,
    "currency" TEXT DEFAULT 'KRW',
    "postSlug" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SiteConfig" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "signupEnabled" BOOLEAN NOT NULL DEFAULT false,
    "communityEnabled" BOOLEAN NOT NULL DEFAULT false,
    "commentsGloballyEnabled" BOOLEAN NOT NULL DEFAULT true,
    "requireLoginToComment" BOOLEAN NOT NULL DEFAULT true,
    "moderationOn" BOOLEAN NOT NULL DEFAULT false,
    "bannedWords" TEXT,
    "heroTitle" TEXT,
    "heroSubtitle" TEXT,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_SiteConfig" ("bannedWords", "commentsGloballyEnabled", "heroSubtitle", "heroTitle", "id", "moderationOn", "requireLoginToComment", "updatedAt") SELECT "bannedWords", "commentsGloballyEnabled", "heroSubtitle", "heroTitle", "id", "moderationOn", "requireLoginToComment", "updatedAt" FROM "SiteConfig";
DROP TABLE "SiteConfig";
ALTER TABLE "new_SiteConfig" RENAME TO "SiteConfig";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "AccountSnapshot_date_key" ON "AccountSnapshot"("date");

-- CreateIndex
CREATE INDEX "AccountSnapshot_date_idx" ON "AccountSnapshot"("date");

-- CreateIndex
CREATE INDEX "JournalEntry_published_date_idx" ON "JournalEntry"("published", "date");

-- CreateIndex
CREATE INDEX "JournalEntry_ticker_idx" ON "JournalEntry"("ticker");

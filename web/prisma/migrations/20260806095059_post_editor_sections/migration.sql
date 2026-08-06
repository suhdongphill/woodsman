-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Post" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "body" TEXT,
    "format" TEXT NOT NULL DEFAULT 'MARKDOWN',
    "bodyHtml" TEXT,
    "section" TEXT NOT NULL DEFAULT 'INSIGHT',
    "thumbnailUrl" TEXT,
    "source" TEXT NOT NULL DEFAULT 'SELF',
    "externalUrl" TEXT,
    "ticker" TEXT,
    "tags" TEXT,
    "commentsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Post" ("bodyHtml", "category", "commentsEnabled", "createdAt", "excerpt", "externalUrl", "id", "published", "publishedAt", "slug", "source", "tags", "thumbnailUrl", "ticker", "title", "type", "updatedAt", "viewCount") SELECT "bodyHtml", "category", "commentsEnabled", "createdAt", "excerpt", "externalUrl", "id", "published", "publishedAt", "slug", "source", "tags", "thumbnailUrl", "ticker", "title", "type", "updatedAt", "viewCount" FROM "Post";
DROP TABLE "Post";
ALTER TABLE "new_Post" RENAME TO "Post";
CREATE UNIQUE INDEX "Post_slug_key" ON "Post"("slug");
CREATE INDEX "Post_published_publishedAt_idx" ON "Post"("published", "publishedAt");
CREATE INDEX "Post_type_idx" ON "Post"("type");
CREATE INDEX "Post_ticker_idx" ON "Post"("ticker");
CREATE INDEX "Post_section_published_publishedAt_idx" ON "Post"("section", "published", "publishedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

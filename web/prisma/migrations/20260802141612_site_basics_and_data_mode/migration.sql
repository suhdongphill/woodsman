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
    "dataMode" TEXT NOT NULL DEFAULT 'PAPER',
    "contactEmail" TEXT,
    "tistoryBlogUrl" TEXT,
    "tistoryFeaturedUrl" TEXT,
    "tistoryRssUrl" TEXT,
    "featuredTitle" TEXT,
    "featuredExcerpt" TEXT,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_SiteConfig" ("bannedWords", "commentsGloballyEnabled", "communityEnabled", "heroSubtitle", "heroTitle", "id", "moderationOn", "requireLoginToComment", "signupEnabled", "updatedAt") SELECT "bannedWords", "commentsGloballyEnabled", "communityEnabled", "heroSubtitle", "heroTitle", "id", "moderationOn", "requireLoginToComment", "signupEnabled", "updatedAt" FROM "SiteConfig";
DROP TABLE "SiteConfig";
ALTER TABLE "new_SiteConfig" RENAME TO "SiteConfig";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

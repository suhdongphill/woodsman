-- 파도(오늘의 기사) — 2026-09-14 · 통합 계획 S3.
--
-- ⚠ 본문을 저장하지 않는다(저작권) — 제목 · 원문 링크 · 날짜 · 기관이 준 한 줄 설명 · 우리 요약만.
-- ⚠ source의 뜻: FED_SPEECH · FED_MONETARY · FED_TESTIMONY · BLS_CPI(수집이 자동으로 넣음) | MANUAL(관리자가 넣음).
--   자동 수집은 **MANUAL 행을 덮지 않는다**(저장 SQL이 막는다) — 운영자가 고친 요약이 다음 수집에 사라지면 안 된다.
-- ⚠ 같은 원문 링크는 한 행이다(url UNIQUE).
CREATE TABLE "MacroNews" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "summary" TEXT,
    "speaker" TEXT,
    "publishedAt" DATETIME NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "MacroNews_url_key" ON "MacroNews"("url");

CREATE INDEX "MacroNews_hidden_publishedAt_idx" ON "MacroNews"("hidden", "publishedAt");

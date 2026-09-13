-- 원자료 불변 저장 L1 (2026-09-13 · Capital Regime Engine R1).
--
-- ⚠ 이 테이블은 **추가만 한다.** 값이 처음 보였을 때와 달라졌을 때만 행이 생긴다.
--   화면이 읽는 최신 1벌은 여전히 "MacroPoint"(L2)다.
-- ⚠ vintageDate의 뜻은 origin마다 다르다(`src/lib/macro/vintage.ts` 머리말):
--   ALFRED = 발표 기관이 낸 날 · INGEST = 우리가 처음 본 날 · MANUAL = 저장한 날 · SEED_L2 = 아래 참고.
-- ⚠ 날짜는 MacroPoint와 같은 형식(정오 UTC ISO)으로 둔다 — 두 층을 날짜로 맞대야 한다.
CREATE TABLE "MacroObservation" (
    "seriesKey" TEXT NOT NULL,
    "observationDate" DATETIME NOT NULL,
    "vintageDate" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "source" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "retrievedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("seriesKey", "observationDate", "vintageDate")
);

CREATE INDEX "MacroObservation_seriesKey_observationDate_idx" ON "MacroObservation"("seriesKey", "observationDate");

-- ⚠ 씨앗: 지금 L2에 있는 값을 L1의 첫 행으로 옮긴다.
--   vintageDate는 L2의 updatedAt 날짜다 — **그 날짜 이전의 이력은 모른다**(R1 이전에 덮어쓴 값은 되살릴 수 없다).
--   그래서 origin을 'SEED_L2'로 따로 표시해, 되살린 이력처럼 읽히지 않게 한다.
INSERT INTO "MacroObservation" ("seriesKey", "observationDate", "vintageDate", "value", "source", "origin", "retrievedAt")
SELECT "seriesKey", "date", substr("updatedAt", 1, 10), "value", "source", 'SEED_L2', "updatedAt"
FROM "MacroPoint";

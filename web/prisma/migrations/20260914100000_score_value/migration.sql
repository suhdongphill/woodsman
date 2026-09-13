-- 점수 계산 결과 (2026-09-14 · Capital Regime Engine · 점수 계산 명세 v1.0).
--
-- ⚠ 점수는 수집이 끝난 뒤 프로그램이 계산해 여기 쌓는다. LLM도 관리자 버튼도 점수를 정하지 않는다.
-- ⚠ basis의 뜻:
--   LIVE       = 그날 수집 직후, **그날 알려진 값**으로 계산했다(이후 수정치가 섞이지 않는다).
--   RECOMPUTED = 나중에 **지금의 값(수정치 포함)**으로 과거 평가일을 계산했다. 방향(4주·13주 전 대비)을 첫날부터 보이려고 둔다.
--   같은 평가일에 LIVE가 있으면 RECOMPUTED가 덮지 않는다(저장 SQL이 막는다).
-- ⚠ value가 NULL이면 **발행하지 않은 점수**다(커버리지 60% 미만). 0점이 아니다.
CREATE TABLE "ScoreValue" (
    "scoreKey" TEXT NOT NULL,
    "asOf" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "basis" TEXT NOT NULL,
    "value" REAL,
    "coverage" REAL NOT NULL,
    "state" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "computedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("scoreKey", "asOf", "modelVersion")
);

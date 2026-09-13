-- 그날의 분석 — 유동성 카드 해석 팝업의 2부 (2026-09-14 · 통합 계획 S4).
--
-- ⚠ 운영자 결정: 점수는 우리 계산으로 낸다. 붙여넣은 외부 보고서에서는 출처 있는 사실과 해석만 싣고,
--   산식 없는 점수 · Confidence %는 뺀다(저장 화면이 `findUnsourcedScores`로 경고 · 자동으로 지우지 않음).
-- ⚠ 본문 저장 경로는 글과 같다: body(마크다운 원본) → lib/markdown → lib/sanitize-html → bodyHtml. bodyHtml에 직접 쓰지 않는다.
-- ⚠ 날짜 하나에 분석 하나(date PK) — 같은 날 다시 저장하면 고친다.
CREATE TABLE "DailyAnalysis" (
    "date" TEXT NOT NULL PRIMARY KEY,
    "oneLine" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "sourceLabel" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

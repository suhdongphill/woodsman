-- 릴리스(배포) 기록. 바꾼 것과 반응을 잇는 고리다.
--
-- 2026-08-30: 홈 재편·UI 개편을 하면서 "효과를 재는 수단이 없다"는 것이 드러났다.
-- 재지 않으면 다음 결정도 감이 된다.
--
-- ⚠ 가설(hypothesis)을 나중에 쓰지 않는다. 결과를 보고 쓴 가설은 항상 맞는다.
-- ⚠ 컬럼명을 commit으로 두지 않는다 — SQLite 예약어라 인용하지 않은 질의가 깨진다.
-- ⚠ 판정 규칙은 src/lib/release-effect.ts(순수 함수 + 테스트)에 있다.
--    표본이 적거나 릴리스가 겹치면 **판정하지 않는다**.
CREATE TABLE "SiteRelease" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "hypothesis" TEXT,
    "metric" TEXT NOT NULL DEFAULT 'TISTORY_CLICK',
    "commitHash" TEXT
);

-- 화면은 언제나 "최근 것부터" 읽는다.
CREATE INDEX "SiteRelease_at_idx" ON "SiteRelease"("at");

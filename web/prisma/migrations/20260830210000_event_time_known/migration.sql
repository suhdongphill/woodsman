-- 일정의 시각을 아는지 여부.
--
-- ⚠ 시각을 모르는 일정은 그 날 정오(UTC)로 저장한다. 그런데 화면이 그 값을 그대로 그리면
--    KST 21:00으로 보여서 **모르는 것을 아는 것처럼 단언**하게 된다(2026-08-30에 실제로 그랬다).
--    이 칸이 false면 화면은 시각을 지우고 날짜만 낸다.
-- ⚠ 기존 행은 true로 둔다 — 지금 들어 있는 것은 사람이 넣은 것이고, 아래에서 정정한다.
ALTER TABLE "MacroEvent" ADD COLUMN "timeKnown" BOOLEAN NOT NULL DEFAULT true;

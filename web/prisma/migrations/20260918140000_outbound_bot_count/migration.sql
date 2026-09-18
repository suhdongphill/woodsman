-- 봇·프리페치 클릭을 따로 담는다.
-- ⚠ 기존 행은 0으로 시작한다 — 9/18 이전 수치에는 봇이 섞여 있고 되돌려 가를 수 없다.
ALTER TABLE "OutboundClick" ADD COLUMN "botCount" INTEGER NOT NULL DEFAULT 0;

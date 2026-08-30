-- 광고(AdSense) 설정을 관리자 화면에서 다룬다.
--
-- ⚠ 퍼블리셔·슬롯 ID는 비밀이 아니다 — HTML에 그대로 실리는 공개값이라 DB에 둔다.
--    AI API 키와는 다르다. 그쪽은 절대 DB에 넣지 않는다.
-- ⚠ 값이 있어도 adsEnabled가 꺼져 있으면 광고를 그리지 않는다.
--    등록과 노출을 나눈 이유: 정착 전에 값만 넣어 두고 싶을 때가 있고,
--    문제가 생기면 재배포 없이 즉시 내려야 한다.
ALTER TABLE "SiteConfig" ADD COLUMN "adsEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SiteConfig" ADD COLUMN "adsenseClientId" TEXT;
ALTER TABLE "SiteConfig" ADD COLUMN "adsenseSlotArticleEnd" TEXT;
ALTER TABLE "SiteConfig" ADD COLUMN "adsenseSlotFeedEnd" TEXT;
ALTER TABLE "SiteConfig" ADD COLUMN "adsenseSlotContentBottom" TEXT;

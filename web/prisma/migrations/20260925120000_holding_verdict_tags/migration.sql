-- 운영 포트폴리오 종목에 볼트 판정 태그를 싣는다(2026-09-25).
-- 원천: 볼트 _data/portfolio-verdicts.json (주도주 모니터와 같은 판정). export-portal-portfolio.py 가 재실행마다 덮어쓴다.
-- ⚠ 사람이 쓰는 칸(공개·분류·논리·목표비중·순서)과 달리 **기계 값**이다. 관리자 화면에서 고치지 않는다.
ALTER TABLE "ModelHolding" ADD COLUMN "layer" TEXT;
ALTER TABLE "ModelHolding" ADD COLUMN "layerName" TEXT;
ALTER TABLE "ModelHolding" ADD COLUMN "leaderClass" TEXT;
ALTER TABLE "ModelHolding" ADD COLUMN "leaderTier" TEXT;
ALTER TABLE "ModelHolding" ADD COLUMN "assetKind" TEXT;
ALTER TABLE "ModelHolding" ADD COLUMN "leverage" REAL;
ALTER TABLE "ModelHolding" ADD COLUMN "verdictFlag" TEXT;
ALTER TABLE "ModelHolding" ADD COLUMN "verdictAsOf" DATETIME;

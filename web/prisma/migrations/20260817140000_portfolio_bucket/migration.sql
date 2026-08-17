-- CreateTable
CREATE TABLE "PortfolioBucket" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "targetPct" REAL NOT NULL DEFAULT 0,
    "color" TEXT NOT NULL DEFAULT '#5b7fa6',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "builtIn" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "PortfolioBucket_sortOrder_idx" ON "PortfolioBucket"("sortOrder");

-- 기본 셋을 심는다.
-- ⚠ 목표 비중은 0으로 둔다. 임의의 숫자(60/25/15)를 심으면 관리자가 정한 적 없는 배분이
--    공개 화면에 "우리 목표"로 뜬다. 0이면 화면이 "아직 목표를 정하지 않았습니다"라고 말한다.
-- ⚠ 이름·색은 기존 화면(components/ui/Badge.tsx)에 있던 값 그대로다 — 배포 순간 화면이 바뀌지 않게.
INSERT INTO "PortfolioBucket" ("key", "name", "description", "targetPct", "color", "sortOrder", "builtIn", "updatedAt")
VALUES
  ('GROWTH',  '성장', '이익 성장으로 자산을 늘리는 자리',   0, '#36a06a', 0, true, CURRENT_TIMESTAMP),
  ('INCOME',  '인컴', '배당·이자로 현금흐름을 만드는 자리', 0, '#c9a657', 1, true, CURRENT_TIMESTAMP),
  ('DEFENSE', '방어', '하락장에서 계좌를 지키는 자리',       0, '#5b7fa6', 2, true, CURRENT_TIMESTAMP);

-- 로그인 시도 기록.
-- 2026-08-17 점검이 "로그인 시도 제한 0층"을 중간 심각도로 잡았다. 판정 규칙은
-- src/lib/login-throttle.ts(순수 함수 + 테스트)에 있고, 이 표는 그 입력만 담는다.
--
-- ⚠ 이메일을 기본키로 쓴다. 계정이 없는 이메일로도 행이 생긴다 —
--    "없는 계정으로 두드리는 것"도 똑같이 세야 방어가 된다.
--    (그래서 이 표에 행이 있다는 것이 계정 존재를 뜻하지 않는다.)
-- ⚠ 성공하면 행을 지운다. 실패 기록을 오래 쌓아 둘 이유가 없고,
--    쌓아 두면 그 자체가 "이 주소를 노렸다"는 정보가 된다.
CREATE TABLE "LoginAttempt" (
    "email" TEXT NOT NULL PRIMARY KEY,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "lastFailedAt" DATETIME NOT NULL
);

-- 오래된 행을 걷어내는 청소용. 창(1시간)을 벗어난 행은 판정에 쓰이지 않는다.
CREATE INDEX "LoginAttempt_lastFailedAt_idx" ON "LoginAttempt"("lastFailedAt");

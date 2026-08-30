-- 관리자 활동 로그.
-- 2026-08-30: 「편집을 눌러도 아무 일이 없다」를 재현으로 반나절 걸려 좁혔다. 이 표가 있었으면
-- "편집 화면 열림"이 하나도 없고 "새 글 저장"만 쌓인 것을 보고 10분에 끝났다.
--
-- ⚠ 로그 쓰기가 실패해도 하던 일은 계속된다(코드 쪽 규칙). 기록하려다 저장을 못 하게 만들면
--    본말이 뒤집힌다.
-- ⚠ summary에 비밀번호·API 키·토큰을 담지 않는다.
CREATE TABLE "AdminLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "summary" TEXT
);

-- 화면은 언제나 "최근 것부터"로 읽는다. 색인이 없으면 매번 전체를 훑는다.
CREATE INDEX "AdminLog_at_idx" ON "AdminLog"("at");

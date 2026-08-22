-- 댓글 신고 기록.
-- 2026-08-17 점검: 신고에 **로그인도 속도 제한도 없었다.** 화면에 보이는 댓글 id를
-- 그대로 다시 보내면 누구나 모든 댓글을 '신고됨'으로 만들 수 있었고, Comment.reported는
-- 참/거짓 한 칸이라 "누가 몇 번 신고했는지"를 셀 방법이 아예 없었다.
--
-- ⚠ (댓글, 사용자)가 기본키다. 두 번째 신고는 DB가 거절한다 — 코드가 잊어도 막힌다.
-- ⚠ 댓글이 지워지면 신고도 같이 사라진다(CASCADE). 남겨 둘 값이 없다.
-- 판정 규칙은 src/lib/comment-throttle.ts(순수 함수 + 테스트)에 있다.
CREATE TABLE "CommentReport" (
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("commentId", "userId"),
    CONSTRAINT "CommentReport_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommentReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 한 사람이 창(1시간) 안에서 몇 건이나 신고했는지 세는 데 쓴다.
CREATE INDEX "CommentReport_userId_createdAt_idx" ON "CommentReport"("userId", "createdAt");

-- 같은 작성자의 최근 댓글로 속도·중복을 판정한다. 없으면 매번 댓글 전체를 훑는다.
CREATE INDEX "Comment_userId_createdAt_idx" ON "Comment"("userId", "createdAt");

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { LockIcon, MessageIcon, AlertIcon } from "@/components/icons";
import { formatDateTime } from "@/lib/format";
import { canSubmitComment, type CommentPolicy } from "@/lib/comments";
import type { Comment, Post } from "@/lib/types";
import { getSiteBasics } from "@/lib/site-settings";
import { CommentForm } from "./CommentForm";
import { reportCommentAction } from "../actions";

/**
 * 댓글 영역.
 *
 * ⚠ 작성 가능 여부는 `lib/comments.canSubmitComment` **하나로만** 판단한다.
 *   화면(폼을 보일지)과 서버 액션(받을지)이 같은 함수를 쓴다 —
 *   같은 판단을 두 번 구현하면 한쪽이 반드시 뒤처진다.
 *
 * 커뮤니티가 닫혀 있으면(`open=false`) 죽은 입력창 대신 안내를 낸다.
 * 코드를 지우지 않고 남겨 두는 이유는 `src/lib/site-policy.ts`에 적어 두었다.
 */
export function CommentSection({
  post,
  comments,
  policy,
  isLoggedIn = false,
  open = true,
  showAuthLinks = true,
}: {
  post: Post;
  comments: Comment[];
  policy: CommentPolicy;
  isLoggedIn?: boolean;
  /** 사이트 정책상 커뮤니티가 열려 있는지 */
  open?: boolean;
  /** 가입을 받는 동안에만 로그인·회원가입 버튼을 보여준다 */
  showAuthLinks?: boolean;
}) {
  const globallyOff = !policy.commentsGloballyEnabled;
  const postLocked = !post.commentsEnabled;
  const canWrite = canSubmitComment({
    // 화면은 발행된 글만 그리지만, 판단은 서버와 **같은 함수**가 한다.
    postPublished: post.published,
    commentsGloballyEnabled: policy.commentsGloballyEnabled,
    postCommentsEnabled: post.commentsEnabled,
    requireLoginToComment: policy.requireLoginToComment,
    isLoggedIn,
  });

  if (!open) return <CommentsClosedNotice />;

  return (
    <section className="mt-12">
      <h2 className="mb-5 flex items-center gap-2 text-base font-semibold text-ink">
        <MessageIcon size={17} />
        댓글
        <span className="tabular-nums text-gold-400">{comments.length}</span>
      </h2>

      {/* 잠금 상태 */}
      {postLocked && (
        <Card className="flex items-center gap-3 text-sm text-muted">
          <LockIcon size={18} />
          🔒 댓글이 잠긴 글입니다.
        </Card>
      )}

      {!postLocked && globallyOff && (
        <Card className="flex items-center gap-3 text-sm text-muted">
          <AlertIcon size={18} />
          현재 사이트 전체 댓글 기능이 꺼져 있습니다.
        </Card>
      )}

      {/* 작성 폼 */}
      {!postLocked && !globallyOff && (
        <>
          {canWrite ? (
            <CommentForm postId={post.id} moderationOn={policy.moderationOn} />
          ) : (
            <Card className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <p className="text-sm text-muted">
                댓글은 로그인한 회원만 작성할 수 있습니다. 열람은 자유롭습니다.
              </p>
              {showAuthLinks && (
                <div className="flex shrink-0 gap-2">
                  <Link
                    href="/login"
                    className="rounded-lg border border-border px-3.5 py-2 text-xs text-ink transition-colors hover:border-gold-600"
                  >
                    로그인
                  </Link>
                  <Link
                    href="/register"
                    className="rounded-lg bg-gold-500 px-3.5 py-2 text-xs font-semibold text-onAccent transition-colors hover:bg-gold-400"
                  >
                    회원가입
                  </Link>
                </div>
              )}
            </Card>
          )}

          {/* 목록 */}
          {comments.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-600">
              아직 댓글이 없습니다. 첫 의견을 남겨보세요.
            </p>
          ) : (
            <ul className="space-y-3">
              {comments.map((c) => (
                <li key={c.id} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-900 text-[11px] font-semibold text-emerald-200">
                      {(c.authorName ?? "?").slice(0, 1)}
                    </span>
                    <span className="text-[13px] font-medium text-ink">
                      {c.authorName ?? "익명"}
                    </span>
                    <span className="text-[11px] text-gray-600">{formatDateTime(c.createdAt)}</span>
                    {/*
                      ⚠ 신고는 **로그인한 사람만** 누른다(2026-08-22). 전에는 누구나 눌렀고,
                      댓글 id가 화면 HTML에 그대로 있어 모든 댓글을 '신고됨'으로 만드는 데
                      비용이 0이었다. 여기서 감추는 것은 안내일 뿐이고, 실제 거절은
                      `reportCommentAction`이 서버에서 다시 한다.
                    */}
                    <div className="ml-auto">
                      {c.reported ? (
                        <span className="text-[11px] text-gray-700">신고됨</span>
                      ) : isLoggedIn ? (
                        <form action={reportCommentAction}>
                          <input type="hidden" name="id" value={c.id} />
                          <button
                            type="submit"
                            className="text-[11px] text-gray-600 transition-colors hover:text-red-400"
                          >
                            신고
                          </button>
                        </form>
                      ) : showAuthLinks ? (
                        <Link
                          href="/login"
                          title="신고는 로그인 후 가능합니다"
                          className="text-[11px] text-gray-600 transition-colors hover:text-red-400"
                        >
                          신고
                        </Link>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-2.5 text-[13.5px] leading-relaxed text-gray-300">{c.body}</p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

/** 커뮤니티를 열기 전까지 보여 주는 안내 — 죽은 입력창을 남겨두지 않는다. */
async function CommentsClosedNotice() {
  const { contactEmail } = await getSiteBasics();
  return (
    <section className="mt-12">
      <Card className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-sm text-muted">
          <LockIcon size={16} />
          댓글은 아직 열지 않았습니다.
        </p>
        <p className="text-[12px] text-gray-500">
          의견·반론은 <span className="text-gold-400">{contactEmail}</span>으로 보내주세요.
        </p>
      </Card>
    </section>
  );
}

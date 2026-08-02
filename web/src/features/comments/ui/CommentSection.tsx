import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { LockIcon, MessageIcon, AlertIcon } from "@/components/icons";
import { formatDateTime } from "@/lib/format";
import type { Comment, Post, SiteConfig } from "@/lib/types";
import { CONTACT_EMAIL } from "@/lib/site-links";

/**
 * 댓글 영역.
 *
 * 노출 규칙은 서버에서 계산한다: commentsGloballyEnabled && post.commentsEnabled
 * (Phase 5에서 실제 서버 액션·모더레이션과 연결)
 *
 * 지금은 커뮤니티 자체가 닫혀 있어(`open=false`) 이 컴포넌트가 렌더되지 않는다.
 * 코드를 지우지 않고 남겨 두는 이유는 `src/lib/site-policy.ts`에 적어 두었다 —
 * 관리자가 설정을 켜면 그대로 살아난다.
 */
export function CommentSection({
  post,
  comments,
  config,
  isLoggedIn = false,
  open = true,
  showAuthLinks = true,
}: {
  post: Post;
  comments: Comment[];
  config: SiteConfig;
  isLoggedIn?: boolean;
  /** 사이트 정책상 커뮤니티가 열려 있는지 */
  open?: boolean;
  /** 가입을 받는 동안에만 로그인·회원가입 버튼을 보여준다 */
  showAuthLinks?: boolean;
}) {
  const globallyOff = !config.commentsGloballyEnabled;
  const postLocked = !post.commentsEnabled;
  const canWrite = !globallyOff && !postLocked && (!config.requireLoginToComment || isLoggedIn);

  if (!open) return <CommentsClosedNotice />;

  return (
    <section className="mt-12">
      <h2 className="flex items-center gap-2 text-base font-semibold text-white mb-5">
        <MessageIcon size={17} />
        댓글
        <span className="text-gold-400 tabular-nums">{comments.length}</span>
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
            <Card className="mb-6">
              <textarea
                rows={3}
                placeholder="근거와 함께 의견을 남겨주세요."
                className="w-full bg-[#12141c] border border-border rounded-xl px-3.5 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors resize-none"
              />
              <div className="flex items-center justify-between mt-3">
                <p className="text-[11px] text-gray-600">
                  {config.moderationOn
                    ? "승인제가 켜져 있어 관리자 승인 후 노출됩니다."
                    : "작성 즉시 노출됩니다."}
                </p>
                <span className="px-4 py-2 text-sm rounded-xl bg-emerald-500 text-white font-medium cursor-pointer hover:bg-emeraldDark transition-colors">
                  등록
                </span>
              </div>
            </Card>
          ) : (
            <Card className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <p className="text-sm text-muted">
                댓글은 로그인한 회원만 작성할 수 있습니다. 열람은 자유롭습니다.
              </p>
              {showAuthLinks && (
                <div className="flex gap-2 shrink-0">
                  <Link
                    href="/login"
                    className="px-3.5 py-2 text-xs rounded-lg border border-border text-ink hover:border-gold-600 transition-colors"
                  >
                    로그인
                  </Link>
                  <Link
                    href="/register"
                    className="px-3.5 py-2 text-xs rounded-lg bg-gold-500 text-[#1a1400] font-semibold hover:bg-gold-400 transition-colors"
                  >
                    회원가입
                  </Link>
                </div>
              )}
            </Card>
          )}

          {/* 목록 */}
          {comments.length === 0 ? (
            <p className="text-sm text-gray-600 py-8 text-center">
              아직 댓글이 없습니다. 첫 의견을 남겨보세요.
            </p>
          ) : (
            <ul className="space-y-3">
              {comments.map((c) => (
                <li key={c.id} className="bg-card border border-border rounded-2xl p-4">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-emerald-900 text-emerald-200 text-[11px] flex items-center justify-center font-semibold shrink-0">
                      {(c.authorName ?? "?").slice(0, 1)}
                    </span>
                    <span className="text-[13px] font-medium text-white">{c.authorName}</span>
                    <span className="text-[11px] text-gray-600">
                      {formatDateTime(c.createdAt)}
                    </span>
                    <button
                      type="button"
                      className="ml-auto text-[11px] text-gray-600 hover:text-red-400 transition-colors"
                    >
                      신고
                    </button>
                  </div>
                  <p className="mt-2.5 text-[13.5px] text-gray-300 leading-relaxed">{c.body}</p>
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
function CommentsClosedNotice() {
  return (
    <section className="mt-12">
      <Card className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-sm text-muted">
          <LockIcon size={16} />
          댓글은 아직 열지 않았습니다.
        </p>
        <p className="text-[12px] text-gray-500">
          의견·반론은 <span className="text-gold-400">{CONTACT_EMAIL}</span>으로 보내주세요.
        </p>
      </Card>
    </section>
  );
}

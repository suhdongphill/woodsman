import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader, AdminShell } from "@/components/layout/AdminPageHeader";
import { Table, Th, Td, Tr } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { CheckIcon, EyeIcon, TrashIcon } from "@/components/icons";
import { formatDateTime, cx } from "@/lib/format";
import { COMMENT_TABS, resolveCommentTab } from "@/lib/comments";
import { loadCommentCounts, loadCommentsForAdmin } from "@/features/comments/repository";
import { moderateCommentAction } from "@/features/comments/actions";
import { SitePolicyForm } from "@/features/site/ui/SitePolicyForm";
import { getSiteFlags } from "@/lib/site-settings";
import type { Comment, CommentStatus } from "@/lib/types";

export const metadata: Metadata = { title: "댓글 · 정책" };

const STATUS_LABEL: Record<CommentStatus, string> = {
  VISIBLE: "노출",
  PENDING: "승인대기",
  HIDDEN: "숨김",
};

const STATUS_TONE: Record<CommentStatus, "emerald" | "warn" | "neutral"> = {
  VISIBLE: "emerald",
  PENDING: "warn",
  HIDDEN: "neutral",
};

/**
 * 댓글 · 정책 관리.
 *
 * ⚠ 이 화면은 오래 **목업**이었다. 승인·숨김·삭제 버튼에 `onClick`이 없어
 *   눌러도 아무 일이 없었고, 숨겼다고 믿은 댓글이 계속 노출됐다.
 *   지금은 D1을 읽고 서버 액션으로 쓴다. 목업으로 되돌리지 말 것.
 */
export default async function AdminCommentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const tab = resolveCommentTab((await searchParams).tab);
  const [flags, counts, comments] = await Promise.all([
    getSiteFlags(),
    loadCommentCounts(),
    loadCommentsForAdmin(tab),
  ]);

  return (
    <AdminShell>
      <AdminPageHeader
        title="댓글 · 정책"
        description="사이트 전체 댓글 정책을 설정하고, 개별 댓글을 승인·숨김·삭제합니다."
      />

      <SitePolicyForm flags={flags} />

      <div className="mb-4 flex flex-wrap gap-2">
        {COMMENT_TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "all" ? "/admin/comments" : `/admin/comments?tab=${t.key}`}
            scroll={false}
            className={cx(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              t.key === tab
                ? "border-gold-500/40 bg-gold-500/15 text-gold-400"
                : "border-border bg-card text-muted hover:border-gold-600/40 hover:text-ink",
            )}
          >
            {t.label}
            <span className="tabular-nums text-gray-500">{counts[t.key]}</span>
          </Link>
        ))}
      </div>

      {comments.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card px-4 py-10 text-center text-sm text-gray-500">
          {tab === "all" ? "아직 댓글이 없습니다." : "이 조건에 해당하는 댓글이 없습니다."}
        </p>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th className="w-24">상태</Th>
              <Th>내용</Th>
              <Th className="w-40">글</Th>
              <Th className="w-32">작성</Th>
              <Th className="w-28 text-right">작업</Th>
            </tr>
          </thead>
          <tbody>
            {comments.map((c) => (
              <Tr key={c.id}>
                <Td>
                  <div className="flex flex-col items-start gap-1">
                    <Badge tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Badge>
                    {c.reported && <Badge tone="danger">신고</Badge>}
                  </div>
                </Td>
                <Td>
                  <p className="line-clamp-2 max-w-[360px] text-[12.5px] text-ink">{c.body}</p>
                  <span className="text-[11px] text-gray-600">{c.authorName ?? "익명"}</span>
                </Td>
                <Td>
                  {c.postSlug ? (
                    <Link
                      href={`/insights/${c.postSlug}`}
                      className="line-clamp-1 text-[12px] text-gray-400 hover:text-gold-400"
                    >
                      {c.postTitle ?? c.postSlug}
                    </Link>
                  ) : (
                    <span className="line-clamp-1 text-[12px] text-gray-400">
                      {c.postTitle ?? "—"}
                    </span>
                  )}
                </Td>
                <Td>
                  <span className="text-[11px] tabular-nums text-gray-500">
                    {formatDateTime(c.createdAt)}
                  </span>
                </Td>
                <Td>
                  <div className="flex justify-end gap-1">
                    <ModerateButton
                      comment={c}
                      action="approve"
                      label="승인"
                      hover="hover:text-emerald-400"
                      disabled={c.status === "VISIBLE" && !c.reported}
                    >
                      <CheckIcon size={15} />
                    </ModerateButton>
                    <ModerateButton
                      comment={c}
                      action="hide"
                      label="숨김"
                      hover="hover:text-yellow-400"
                      disabled={c.status === "HIDDEN" && !c.reported}
                    >
                      <EyeIcon size={15} />
                    </ModerateButton>
                    <ModerateButton
                      comment={c}
                      action="delete"
                      label="삭제"
                      hover="hover:text-red-400"
                    >
                      <TrashIcon size={15} />
                    </ModerateButton>
                  </div>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}

      <p className="mt-5 text-[11px] text-gray-600">
        노출 규칙은 서버에서 계산합니다: 전역 스위치 &amp;&amp; 글별 스위치가 모두 켜져 있을 때만
        작성 폼이 노출됩니다. 승인·숨김은 신고 표시도 함께 내립니다.
      </p>
    </AdminShell>
  );
}

/** 버튼 하나가 폼 하나다 — 서버 액션에 어떤 댓글인지 함께 넘긴다. */
function ModerateButton({
  comment,
  action,
  label,
  hover,
  disabled = false,
  children,
}: {
  comment: Comment;
  action: "approve" | "hide" | "delete";
  label: string;
  hover: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <form action={moderateCommentAction}>
      <input type="hidden" name="id" value={comment.id} />
      <input type="hidden" name="action" value={action} />
      <input type="hidden" name="postSlug" value={comment.postSlug ?? ""} />
      <button
        type="submit"
        disabled={disabled}
        aria-label={`${label} — ${comment.body.slice(0, 20)}`}
        title={label}
        className={cx(
          "rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-cardHover disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent",
          !disabled && hover,
        )}
      >
        {children}
      </button>
    </form>
  );
}

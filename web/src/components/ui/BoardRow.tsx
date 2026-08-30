import Link from "next/link";
import { Badge } from "./Badge";
import { LockIcon, MessageIcon } from "@/components/icons";
import { formatDate } from "@/lib/format";
import type { Post } from "@/lib/types";
import { POST_TYPE_LABEL } from "./Badge";

/** 게시판 한 줄: 카테고리뱃지 + 제목 + 💬수(또는 🔒잠금) + 메타 */
export function BoardRow({ post, rank }: { post: Post; rank?: number }) {
  const locked = !post.commentsEnabled;
  return (
    <Link
      href={`/board/${post.id}`}
      className="group flex items-center gap-3 px-4 py-3.5 border-b border-border/70 last:border-b-0 hover:bg-cardHover transition-colors"
    >
      {rank != null && (
        <span className="w-5 shrink-0 text-center text-xs font-bold text-gold-500 tabular-nums">
          {rank}
        </span>
      )}
      <Badge tone={post.type === "NOTICE" ? "info" : post.type === "INSIGHT" ? "gold" : "emerald"}>
        {post.category ?? POST_TYPE_LABEL[post.type]}
      </Badge>
      <span className="flex-1 min-w-0 text-sm text-gray-200 group-hover:text-ink truncate">
        {post.title}
      </span>
      <span className="hidden sm:flex items-center gap-1 shrink-0 text-[11px]">
        {locked ? (
          <span className="flex items-center gap-1 text-gray-500" title="댓글이 잠긴 글">
            <LockIcon size={12} />
            잠금
          </span>
        ) : (
          <span className="flex items-center gap-1 text-emerald-400">
            <MessageIcon size={12} />
            {post.commentCount}
          </span>
        )}
      </span>
      <span className="hidden md:block shrink-0 w-20 text-right text-[11px] text-gray-500 tabular-nums">
        {formatDate(post.publishedAt)}
      </span>
    </Link>
  );
}

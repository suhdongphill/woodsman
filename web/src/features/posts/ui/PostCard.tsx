import Link from "next/link";
import { Badge, PostTypeBadge, SourceBadge } from "@/components/ui/Badge";
import { ClockIcon, MessageIcon, LockIcon, ExternalIcon } from "@/components/icons";
import { formatDate } from "@/lib/format";
import type { Post } from "@/lib/types";

/** 인사이트 카드 (목록·홈 공용) */
export function PostCard({ post, compact = false }: { post: Post; compact?: boolean }) {
  return (
    <Link
      href={`/insights/${post.slug}`}
      className="group flex flex-col bg-card border border-border rounded-2xl p-5 card-hover hover:border-gold-600/40"
    >
      <div className="flex items-center gap-2 flex-wrap">
        <PostTypeBadge type={post.type} />
        {post.category && <Badge tone="neutral">{post.category}</Badge>}
        <SourceBadge source={post.source} />
      </div>

      <h3 className="mt-3 text-[15px] font-semibold text-ink leading-snug group-hover:text-gold-400 transition-colors line-clamp-2">
        {post.title}
      </h3>

      {!compact && post.excerpt && (
        <p className="mt-2 text-[13px] text-muted leading-relaxed line-clamp-3">
          {post.excerpt}
        </p>
      )}

      <div className="mt-4 pt-3 border-t border-border/70 flex items-center gap-3 text-[11px] text-gray-500">
        <span className="flex items-center gap-1">
          <ClockIcon size={12} />
          {formatDate(post.publishedAt)}
        </span>
        {post.commentsEnabled ? (
          <span className="flex items-center gap-1">
            <MessageIcon size={12} />
            {post.commentCount}
          </span>
        ) : (
          <span className="flex items-center gap-1">
            <LockIcon size={12} />
            잠금
          </span>
        )}
        <span className="ml-auto flex items-center gap-1">
          {post.source === "TISTORY" && <ExternalIcon size={12} />}
          조회 {post.viewCount.toLocaleString("ko-KR")}
        </span>
      </div>
    </Link>
  );
}

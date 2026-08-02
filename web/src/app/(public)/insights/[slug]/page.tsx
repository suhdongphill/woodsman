import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, PostTypeBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PostCard } from "@/features/posts/ui/PostCard";
import { CommentSection } from "@/features/comments/ui/CommentSection";
import { ClockIcon, EyeIcon, ExternalIcon, TagIcon, ChevronRightIcon } from "@/components/icons";
import { formatDate } from "@/lib/format";
import { getCommentsByPostId, getPostBySlug, posts, siteConfig, getStock } from "@/lib/mock";
import { getSitePolicy } from "@/lib/site-settings";

type Props = { params: Promise<{ slug: string }> };

/**
 * 댓글 개방 여부를 DB에서 읽으므로 정적 생성하지 않는다.
 * 정적으로 구우면 관리자가 댓글을 열어도 이미 배포된 페이지는 계속 "닫힘"으로 남는다.
 * (Phase 4에서 글도 DB로 옮기면 어차피 동적이 된다.)
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return { title: "글을 찾을 수 없습니다" };
  return {
    title: post.title,
    description: post.excerpt,
    openGraph: { title: post.title, description: post.excerpt, type: "article" },
  };
}

export default async function InsightDetailPage({ params }: Props) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const policy = await getSitePolicy();
  const comments = getCommentsByPostId(post.id);
  const related = posts.filter((p) => p.id !== post.id && p.category === post.category).slice(0, 3);
  const stock = post.ticker ? getStock(post.ticker) : undefined;
  const tags = post.tags?.split(",").filter(Boolean) ?? [];

  return (
    <article className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
      {/* 브레드크럼 */}
      <nav className="flex items-center gap-1 text-[11px] text-gray-600 mb-6">
        <Link href="/insights" className="hover:text-gold-400 transition-colors">
          인사이트
        </Link>
        <ChevronRightIcon size={11} />
        <span className="text-muted">{post.category}</span>
      </nav>

      <div className="flex items-center gap-2 flex-wrap">
        <PostTypeBadge type={post.type} />
        {post.category && <Badge tone="neutral">{post.category}</Badge>}
        {post.source === "TISTORY" && <Badge tone="neutral">티스토리</Badge>}
      </div>

      <h1 className="mt-4 text-2xl sm:text-[32px] font-bold text-white leading-snug tracking-tight">
        {post.title}
      </h1>

      <div className="mt-4 flex items-center gap-4 text-[11px] text-gray-500">
        <span className="flex items-center gap-1">
          <ClockIcon size={12} />
          {formatDate(post.publishedAt)}
        </span>
        <span className="flex items-center gap-1">
          <EyeIcon size={12} />
          {post.viewCount.toLocaleString("ko-KR")}
        </span>
        <span className="text-gold-500">Woodsman</span>
      </div>

      {/* 연결된 종목 */}
      {stock && (
        <Link
          href={`/stocks/${stock.ticker}`}
          className="mt-6 flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3 hover:border-gold-600/40 transition-colors"
        >
          <span className="text-[11px] text-muted">연결 종목</span>
          <span className="text-sm font-semibold text-white">{stock.name}</span>
          <span className="text-[11px] font-mono text-gray-500">{stock.ticker}</span>
          <ChevronRightIcon size={14} className="ml-auto text-gold-500" />
        </Link>
      )}

      {/* 본문 */}
      <div
        className="prose-woodsman mt-8"
        dangerouslySetInnerHTML={{ __html: post.bodyHtml ?? "" }}
      />

      {/* 티스토리 원문 링크 */}
      {post.source === "TISTORY" && post.externalUrl && (
        <Card className="mt-8 flex items-center justify-between gap-3">
          <div>
            <p className="text-[13px] text-white font-medium">티스토리에서 원문 이어 읽기</p>
            <p className="text-[11px] text-gray-500 mt-0.5 break-all">{post.externalUrl}</p>
          </div>
          <a
            href={post.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-gold-500 text-[#1a1400] text-xs font-semibold hover:bg-gold-400 transition-colors"
          >
            원문 보기
            <ExternalIcon size={13} />
          </a>
        </Card>
      )}

      {/* 태그 */}
      {tags.length > 0 && (
        <div className="mt-8 flex items-center gap-2 flex-wrap">
          <TagIcon size={14} className="text-gray-600" />
          {tags.map((t) => (
            <Badge key={t} tone="neutral">
              #{t}
            </Badge>
          ))}
        </div>
      )}

      {/* 댓글 — 커뮤니티를 열기 전까지는 안내만 나온다 */}
      <CommentSection
        post={post}
        comments={comments}
        config={siteConfig}
        open={policy.commentsEnabled}
        showAuthLinks={policy.signupEnabled}
      />

      {/* 관련 글 */}
      {related.length > 0 && (
        <section className="mt-14">
          <h2 className="text-base font-semibold text-white mb-5">함께 읽으면 좋은 글</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {related.map((p) => (
              <PostCard key={p.id} post={p} compact />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}

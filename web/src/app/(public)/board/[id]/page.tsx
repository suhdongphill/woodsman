import type { Metadata } from "next";
import { outboundPostHref } from "@/lib/outbound";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, PostTypeBadge } from "@/components/ui/Badge";
import { CommentSection } from "@/features/comments/ui/CommentSection";
import { BoardRow } from "@/components/ui/BoardRow";
import { ClockIcon, EyeIcon, ChevronRightIcon, ExternalIcon } from "@/components/icons";
import { formatDate } from "@/lib/format";
import { findPost, loadPublishedPosts } from "@/features/posts/repository";
import { loadVisibleComments } from "@/features/comments/repository";
import { getSiteFlags, getSitePolicy } from "@/lib/site-settings";
import { currentUser } from "@/lib/session";

type Props = { params: Promise<{ id: string }> };

/**
 * 개방 여부를 DB에서 읽으므로 정적 생성하지 않는다(`/board`와 같은 이유).
 * generateStaticParams를 두면 빌드 때 전부 404로 굳어버린다.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const post = await findPost(id);
  if (!post) return { title: "글을 찾을 수 없습니다" };
  return { title: post.title, description: post.excerpt };
}

export default async function BoardDetailPage({ params }: Props) {
  // 커뮤니티가 닫혀 있으면 상세도 열지 않는다(/board와 같은 규칙).
  const policy = await getSitePolicy();
  if (!policy.communityEnabled) notFound();

  const { id } = await params;
  const post = await findPost(id);
  if (!post || !post.published) notFound();

  const [flags, comments, viewer, published] = await Promise.all([
    getSiteFlags(),
    loadVisibleComments(post.id),
    currentUser(),
    loadPublishedPosts(20),
  ]);
  const others = published.filter((p) => p.id !== post.id).slice(0, 5);

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
      <nav className="flex items-center gap-1 text-[11px] text-gray-600 mb-6">
        <Link href="/board" className="hover:text-gold-400 transition-colors">
          커뮤니티
        </Link>
        <ChevronRightIcon size={11} />
        <span className="text-muted">{post.category}</span>
      </nav>

      <article>
        <div className="flex items-center gap-2 flex-wrap">
          <PostTypeBadge type={post.type} />
          {post.category && <Badge tone="neutral">{post.category}</Badge>}
          {!post.commentsEnabled && <Badge tone="warn">🔒 댓글잠금</Badge>}
        </div>

        <h1 className="mt-4 text-xl sm:text-2xl font-bold text-ink leading-snug">
          {post.title}
        </h1>

        <div className="mt-3 pb-5 border-b border-border flex items-center gap-4 text-[11px] text-gray-500">
          <span className="text-gold-500">Woodsman</span>
          <span className="flex items-center gap-1">
            <ClockIcon size={12} />
            {formatDate(post.publishedAt)}
          </span>
          <span className="flex items-center gap-1">
            <EyeIcon size={12} />
            {post.viewCount.toLocaleString("ko-KR")}
          </span>
        </div>

        <div
          className="prose-woodsman mt-7"
          dangerouslySetInnerHTML={{ __html: post.bodyHtml ?? "" }}
        />

        {/*
          ⚠ `source`를 묻지 않는다. 원문 링크가 있으면 그게 곧 "이어지는 글이 있다"는 뜻이다
             — 「직접 작성」 글에 넣은 링크가 조용히 사라지던 자리다(2026-08-25).
          ⚠ 주소를 직접 걸지 않고 `/go/post-<slug>`로 경유한다. 직접 걸면 나가는 클릭이
             안 세지고, 이 사이트의 1순위 지표가 비게 된다.
        */}
        {post.externalUrl && (
          <a
            href={outboundPostHref(post.slug)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-1.5 text-xs text-gold-400 hover:text-gold-500"
          >
            티스토리 원문 보기
            <ExternalIcon size={13} />
          </a>
        )}
      </article>

      <CommentSection
        post={post}
        comments={comments}
        policy={flags}
        isLoggedIn={!!viewer}
        open={policy.commentsEnabled}
        showAuthLinks={policy.signupEnabled}
      />

      <section className="mt-14">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-ink">다른 글</h2>
          <Link href="/board" className="text-[11px] text-gold-400 hover:text-gold-500">
            목록으로
          </Link>
        </div>
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {others.map((p) => (
            <BoardRow key={p.id} post={p} />
          ))}
        </div>
      </section>
    </div>
  );
}

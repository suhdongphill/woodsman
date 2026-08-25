import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, PostTypeBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PostCard } from "@/features/posts/ui/PostCard";
import { CommentSection } from "@/features/comments/ui/CommentSection";
import { AdSlot } from "@/components/analytics/AdSlot";
import { TistoryCta } from "@/features/site/ui/TistoryCta";
import { blogLinkForPost, outboundPostHref } from "@/lib/outbound";
import { ClockIcon, EyeIcon, ExternalIcon, TagIcon, ChevronRightIcon } from "@/components/icons";
import { formatDate } from "@/lib/format";
import { findPublishedName } from "@/features/reports/repository";
import { findPostBySlug, loadPublishedPosts } from "@/features/posts/repository";
import { loadVisibleComments } from "@/features/comments/repository";
import { getSiteFlags, getSitePolicy } from "@/lib/site-settings";
import { currentUser } from "@/lib/session";

type Props = { params: Promise<{ slug: string }> };

/**
 * 댓글 개방 여부를 DB에서 읽으므로 정적 생성하지 않는다.
 * 정적으로 구우면 관리자가 댓글을 열어도 이미 배포된 페이지는 계속 "닫힘"으로 남는다.
 * (Phase 4에서 글도 DB로 옮기면 어차피 동적이 된다.)
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await findPostBySlug(slug);
  if (!post || !post.published) return { title: "글을 찾을 수 없습니다" };

  return {
    title: post.title,
    description: post.excerpt,
    openGraph: { title: post.title, description: post.excerpt, type: "article" },
    /**
     * 티스토리에서 가져온 글은 **원문이 정본**이다. canonical을 원문으로 넘겨
     * 검색엔진이 둘을 중복으로 보고 서로 순위를 깎는 일을 막는다.
     * (우리가 순위를 가져가는 게 아니라, 원문으로 트래픽이 모이는 게 목적이다.)
     */
    alternates:
      post.source === "TISTORY" && post.externalUrl
        ? { canonical: post.externalUrl }
        : undefined,
  };
}

export default async function InsightDetailPage({ params }: Props) {
  const { slug } = await params;
  const post = await findPostBySlug(slug);
  if (!post || !post.published) notFound();

  const [policy, flags, all, comments, viewer] = await Promise.all([
    getSitePolicy(),
    getSiteFlags(),
    loadPublishedPosts(50),
    loadVisibleComments(post.id),
    currentUser(),
  ]);
  const related = all.filter((p) => p.id !== post.id && p.category === post.category).slice(0, 3);
  // ⚠ 발행된 보고서가 있을 때만 링크를 건다. 목업 종목을 읽던 시절에는 존재하지 않는
  //    화면으로 보내고 있었다 — 링크는 눌러서 도착해야 링크다.
  const stockName = post.ticker ? await findPublishedName(post.ticker) : null;
  const tags = post.tags?.split(",").filter(Boolean) ?? [];
  const isFromTistory = post.source === "TISTORY" && Boolean(post.externalUrl);
  /**
   * 글 끝에 붙일 블로그 링크. ⚠ `source`(어디서 왔나)와 `externalUrl`(이어지는 글이 있나)은
   * **다른 질문**이다. 둘을 한 조건으로 묶어 뒀더니, 「직접 작성」 글에 넣은 원문 링크가
   * 조용히 무시되고 전부 대표 글로 나갔다(2026-08-25). 판단은 `lib/outbound.ts`에 있다.
   */
  const blogLink = blogLinkForPost(post);

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
      {stockName && post.ticker && (
        <Link
          href={`/stocks/${post.ticker}`}
          className="mt-6 flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3 hover:border-gold-600/40 transition-colors"
        >
          <span className="text-[11px] text-muted">연결 종목</span>
          <span className="text-sm font-semibold text-white">{stockName}</span>
          <span className="text-[11px] font-mono text-gray-500">{post.ticker}</span>
          <ChevronRightIcon size={14} className="ml-auto text-gold-500" />
        </Link>
      )}

      {/* 본문 */}
      <div
        className="prose-woodsman mt-8"
        dangerouslySetInnerHTML={{ __html: post.bodyHtml ?? "" }}
      />

      {/* 티스토리 원문 링크 — 이 글 자체의 원문. 경유 링크로 클릭을 센다. */}
      {isFromTistory && (
        <Card className="mt-8 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] text-white font-medium">티스토리에서 원문 이어 읽기</p>
            <p className="mt-0.5 break-all text-[11px] text-gray-500">{post.externalUrl}</p>
          </div>
          <a
            href={outboundPostHref(post.slug)}
            target="_blank"
            rel="noopener"
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-gold-500 px-3.5 py-2 text-xs font-semibold text-[#1a1400] transition-colors hover:bg-gold-400"
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

      {/*
        글을 다 읽은 자리 — 이 사이트의 1순위 목적(블로그 트래픽)이 먼저 온다.
        원문이 이미 티스토리인 글은 위에서 링크를 줬으므로 중복해서 붙이지 않는다(kind: "none").
      */}
      {blogLink.kind !== "none" && (
        <TistoryCta
          href={blogLink.href}
          {...(blogLink.kind === "post"
            ? {
                /**
                 * ⚠ 이 글에 딸린 원문으로 보낼 때는 문구도 달라야 한다.
                 *   "이 주제를 다룬 글이 있다"(막연함)와 "이 글의 원문이 있다"(확실함)는
                 *   누를 이유가 다르다. 다만 **티스토리 글의 제목은 저장하지 않으므로**
                 *   있는 척하지 않고 이 글의 요약을 쓴다.
                 */
                headline: "이 글의 원문을 블로그에서 이어 읽기",
                description:
                  post.excerpt ??
                  "사이트에는 결론과 수치를 정리해 두고, 배경과 근거는 티스토리에 길게 풀어 둡니다.",
              }
            : {})}
        />
      )}

      {/* 광고는 CTA 아래로 — 자리 경쟁에서 트래픽 유도가 이긴다. */}
      <AdSlot placement="article-end" />

      {/* 댓글 — 커뮤니티를 열기 전까지는 안내만 나온다 */}
      <CommentSection
        post={post}
        comments={comments}
        policy={flags}
        isLoggedIn={!!viewer}
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

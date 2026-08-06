/**
 * 섹션 프레임 — 그 화면에 대해 쓴 글이 **발행할 때마다 한 편씩 쌓이는** 자리.
 *
 * ## 왜 목록이 아니라 '프레임'인가
 * 링크 목록만 두면 클릭하기 전에는 아무것도 읽히지 않는다. 여기서는 **가장 최근 글의
 * 본문 앞부분까지** 펼쳐 보여주고, 그 아래로 이전 글들이 제목·요약으로 이어진다.
 * 화면이 길어지는 만큼 읽을 것이 늘어나는 구조다(검색엔진이 읽을 본문이기도 하다).
 *
 * 글이 없으면 **아무것도 그리지 않는다** — 빈 상자는 "고장"으로 보인다.
 */
import Link from "next/link";
import { Card, SectionHeader } from "@/components/ui/Card";
import { ChevronRightIcon, ExternalIcon } from "@/components/icons";
import { formatDate } from "@/lib/format";
import { SECTION_FRAME } from "@/lib/sections";
import { outboundPostHref } from "@/lib/outbound";
import type { Post, PostSection } from "@/lib/types";

function PostLink({ post, children }: { post: Post; children: React.ReactNode }) {
  // 티스토리 원문이 있는 글은 원문으로 보낸다(유입 측정 경로를 거친다).
  if (post.source === "TISTORY" && post.externalUrl) {
    return (
      <a
        href={outboundPostHref(post.slug)}
        target="_blank"
        rel="noopener"
        className="block group"
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={`/insights/${post.slug}`} className="block group">
      {children}
    </Link>
  );
}

export function SectionFrame({
  section,
  posts,
  className,
}: {
  section: PostSection;
  posts: Post[];
  className?: string;
}) {
  if (posts.length === 0) return null;

  const frame = SECTION_FRAME[section];
  const [latest, ...rest] = posts;

  return (
    <section className={className} aria-labelledby={`frame-${section}`}>
      <SectionHeader
        title={<span id={`frame-${section}`}>{frame.title}</span>}
        subtitle={frame.subtitle}
        action={
          <Link
            href="/insights"
            className="flex shrink-0 items-center gap-0.5 text-xs text-gold-400 hover:text-gold-500"
          >
            전체 글
            <ChevronRightIcon size={13} />
          </Link>
        }
      />

      {/* 가장 최근 글 — 본문까지 펼친다 */}
      <Card padding="p-5 sm:p-6">
        <PostLink post={latest}>
          <h3 className="text-[17px] font-semibold text-white group-hover:text-gold-400">
            {latest.title}
            {latest.source === "TISTORY" && (
              <ExternalIcon size={13} className="ml-1.5 inline text-gray-500" />
            )}
          </h3>
        </PostLink>
        <p className="mt-1 text-[11px] text-gray-500">
          {latest.publishedAt ? formatDate(latest.publishedAt) : "발행일 없음"}
          {latest.category && ` · ${latest.category}`}
        </p>

        {latest.bodyHtml ? (
          <div
            className="prose-woodsman mt-4 text-[14px] leading-relaxed text-gray-300"
            // 저장할 때 허용 목록으로 정화한 HTML이다(features/posts/schema.ts).
            dangerouslySetInnerHTML={{ __html: latest.bodyHtml }}
          />
        ) : (
          latest.excerpt && (
            <p className="mt-4 text-[13.5px] leading-relaxed text-gray-300">{latest.excerpt}</p>
          )
        )}
      </Card>

      {/* 이전 글 — 쌓인 만큼 이어진다 */}
      {rest.length > 0 && (
        <ul className="mt-4 divide-y divide-border/70 rounded-2xl border border-border bg-card">
          {rest.map((post) => (
            <li key={post.id}>
              <PostLink post={post}>
                <div className="px-5 py-4 transition-colors hover:bg-cardHover">
                  <p className="text-[14px] font-medium text-white group-hover:text-gold-400">
                    {post.title}
                    {post.source === "TISTORY" && (
                      <ExternalIcon size={12} className="ml-1.5 inline text-gray-500" />
                    )}
                  </p>
                  {post.excerpt && (
                    <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-muted">
                      {post.excerpt}
                    </p>
                  )}
                  <p className="mt-1.5 text-[11px] text-gray-600">
                    {post.publishedAt ? formatDate(post.publishedAt) : ""}
                  </p>
                </div>
              </PostLink>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

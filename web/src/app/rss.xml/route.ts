/**
 * `/rss.xml` — 발행 글 피드.
 *
 * ⚠ 정본이 정해지기 전(SITE_URL 미설정)에는 내보내지 않는다. `llms.txt`와 같은 이유로,
 *    `robots.txt`가 전체 차단인 상태에서 이 파일만 열려 있으면 미리보기 주소가 먼저 알려진다.
 * ⚠ **판단은 `lib/rss.ts`에 있다.** 여기서는 조립만 한다(CLAUDE.md §1) — 전문을 싣지 않는 규칙,
 *    티스토리 경유 링크 규칙, guid 고정은 전부 그 파일과 그 테스트가 쥐고 있다.
 */
import { hasCanonicalDomain, siteUrl } from "@/lib/site-url";
import { SITE_DESCRIPTION, SITE_TITLE } from "@/lib/site-identity";
import { outboundPostHref } from "@/lib/outbound";
import { FEED_LIMIT, buildRss } from "@/lib/rss";
import { loadPublishedPosts } from "@/features/posts/repository";

/** ⚠ 정적 생성 금지 — 글을 발행하면 피드도 따라 바뀌어야 한다. */
export const dynamic = "force-dynamic";

export async function GET() {
  if (!hasCanonicalDomain()) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const posts = await loadPublishedPosts(FEED_LIMIT);

    const body = buildRss(
      posts.map((p) => ({
        slug: p.slug,
        title: p.title,
        excerpt: p.excerpt,
        publishedAt: p.publishedAt,
        updatedAt: p.updatedAt,
        source: p.source,
        externalUrl: p.externalUrl,
      })),
      {
        siteUrl: siteUrl(),
        title: SITE_TITLE,
        description: SITE_DESCRIPTION,
        outboundPostHref,
      },
    );

    return new Response(body, {
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
        // 글은 자주 발행되지 않는다. 리더가 매번 새로 받을 이유가 없다.
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    /**
     * ⚠ 조용히 **빈 피드**를 주지 않는다. 리더는 빈 피드를 「글을 다 내렸다」로 읽어
     *    이미 받은 항목을 지우기도 한다 — 고장을 「글이 없음」으로 바꿔 보이면 안 된다(CLAUDE.md §3).
     */
    console.error("[rss.xml] 피드를 만들지 못했습니다", error);
    return new Response("Temporarily unavailable", { status: 503 });
  }
}

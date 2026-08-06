/**
 * `/llms.txt` — AI가 사이트를 읽을 때 보는 목차.
 *
 * ⚠ 정본이 정해지기 전(SITE_URL 미설정)에는 내보내지 않는다. `robots.txt`가 전체 차단인
 *    상태에서 이 파일만 열려 있으면 미리보기 주소가 AI에 먼저 알려진다.
 * ⚠ 내용은 카탈로그·DB에서 만든다. 손으로 적으면 지표를 늘렸을 때 이 파일만 옛말을 한다.
 */
import { hasCanonicalDomain } from "@/lib/site-url";
import { renderLlmsTxt } from "@/lib/llms-txt";
import { loadPublishedPosts } from "@/features/posts/repository";
import { loadMacroOverview } from "@/features/macro/service";

/** ⚠ 정적 생성 금지 — 지표를 갱신하거나 글을 쓰면 이 목차도 따라 바뀌어야 한다. */
export const dynamic = "force-dynamic";

export async function GET() {
  if (!hasCanonicalDomain()) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const [overview, posts] = await Promise.all([loadMacroOverview(), loadPublishedPosts(20)]);

    const body = renderLlmsTxt({
      macroAsOf: overview.asOf,
      posts: posts.map((p) => ({
        title: p.title,
        slug: p.slug,
        publishedAt: p.publishedAt,
      })),
    });

    return new Response(body, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        // 자주 바뀌지 않는다. 크롤러가 매번 새로 받을 이유가 없다.
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    // ⚠ 조용히 빈 파일을 주지 않는다 — 빈 목차는 "가진 게 없는 사이트"로 읽힌다.
    console.error("[llms.txt] 목차를 만들지 못했습니다", error);
    return new Response("Temporarily unavailable", { status: 503 });
  }
}

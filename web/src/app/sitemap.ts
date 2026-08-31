import type { MetadataRoute } from "next";
import { loadPublishedSummaries } from "@/features/reports/repository";
import { loadPublishedPosts } from "@/features/posts/repository";
import { loadMaxDates } from "@/features/macro/repository";
import { absoluteUrl } from "@/lib/site-url";
import { MACRO_GROUPS } from "@/lib/macro/groups";
import { getSitePolicy } from "@/lib/site-settings";
import { latestOf, sitemapEntries } from "@/lib/sitemap";

/**
 * sitemap.xml — **조립만 한다.**
 *
 * ⚠ "무엇을 담고 lastmod에 무엇을 적을지"는 `lib/sitemap.ts`(순수 함수 + 테스트)가 정한다.
 *    전에는 여기서 정적 페이지 전부에 `lastModified: now`를 찍었고, 이 라우트가
 *    `force-dynamic`이라 **모든 페이지가 요청할 때마다 「방금 수정됨」**이라고 말했다.
 */
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [policy, posts, reports, maxDates] = await Promise.all([
    getSitePolicy(),
    loadPublishedPosts(500),
    loadPublishedSummaries(200),
    loadMaxDates(),
  ]);

  const entries = sitemapEntries({
    // 자체 작성 글만 넣는다. 티스토리 원문 링크(source=TISTORY)는 원문이 정본이다.
    posts: posts.filter((p) => p.source === "SELF"),
    reports,
    macroGroups: MACRO_GROUPS.map((g) => g.key),
    // 지표가 마지막으로 갱신된 날. ⚠ 수집 전이면 `undefined`이고 lastmod가 안 붙는다.
    macroAsOf: latestOf(...maxDates.values()),
    communityEnabled: policy.communityEnabled,
  });

  return entries.map((e) => ({
    url: absoluteUrl(e.path),
    // ⚠ 모르는 날짜는 넣지 않는다 — 규격상 선택 항목이다.
    ...(e.lastModified ? { lastModified: new Date(e.lastModified) } : {}),
    changeFrequency: e.changeFrequency,
    priority: e.priority,
  }));
}

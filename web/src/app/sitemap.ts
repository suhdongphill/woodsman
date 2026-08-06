import type { MetadataRoute } from "next";
import { stocks } from "@/lib/mock";
import { loadPublishedPosts } from "@/features/posts/repository";
import { absoluteUrl } from "@/lib/site-url";
import { MACRO_GROUPS } from "@/lib/macro/groups";
import { getSitePolicy } from "@/lib/site-settings";

/**
 * sitemap.xml.
 *
 * 닫혀 있는 영역(커뮤니티·회원가입)은 넣지 않는다 — 404를 색인 요청하는 꼴이 된다.
 * 운영자 전용 화면(/login, /admin)도 당연히 제외한다.
 */
export const dynamic = "force-dynamic";

const STATIC_PAGES: { path: string; priority: number; changeFrequency: "daily" | "weekly" | "monthly" }[] = [
  { path: "/", priority: 1, changeFrequency: "daily" },
  { path: "/portfolio", priority: 0.9, changeFrequency: "weekly" },
  { path: "/journal", priority: 0.9, changeFrequency: "weekly" },
  { path: "/insights", priority: 0.8, changeFrequency: "weekly" },
  // 거시 지표는 매주 갱신되는 고유 콘텐츠라 색인 우선순위를 높게 둔다.
  { path: "/macro", priority: 0.9, changeFrequency: "daily" },
  { path: "/macro/bubble", priority: 0.8, changeFrequency: "weekly" },
  { path: "/stocks", priority: 0.6, changeFrequency: "weekly" },
  { path: "/about", priority: 0.5, changeFrequency: "monthly" },
  { path: "/disclaimer", priority: 0.3, changeFrequency: "monthly" },
  { path: "/privacy", priority: 0.3, changeFrequency: "monthly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const policy = await getSitePolicy();
  const now = new Date();

  const entries: MetadataRoute.Sitemap = STATIC_PAGES.map((p) => ({
    url: absoluteUrl(p.path),
    lastModified: now,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));

  // 자체 작성 글만 넣는다. 티스토리 원문 링크(source=TISTORY)는 원문이 정본이다.
  for (const post of await loadPublishedPosts(500)) {
    if (post.source !== "SELF") continue;
    entries.push({
      url: absoluteUrl(`/insights/${post.slug}`),
      lastModified: post.publishedAt ? new Date(post.publishedAt) : now,
      changeFrequency: "monthly",
      priority: 0.7,
    });
  }

  // 지표 묶음 9장 — 각각 다른 주제의 본문을 가진 페이지다(중복 콘텐츠가 아니다).
  for (const group of MACRO_GROUPS) {
    entries.push({
      url: absoluteUrl(`/macro/${group.key}`),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  for (const stock of stocks) {
    entries.push({
      url: absoluteUrl(`/stocks/${stock.ticker}`),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.4,
    });
  }

  if (policy.communityEnabled) {
    entries.push({
      url: absoluteUrl("/board"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.6,
    });
  }

  return entries;
}

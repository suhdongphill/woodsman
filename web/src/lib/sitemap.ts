/**
 * sitemap.xml이 무엇을 담는가 — 순수 판단 모듈.
 *
 * ## ⚠ 왜 뺐나 (2026-08-31)
 * 라우트가 정적 페이지 전부에 `lastModified: now`를 찍고 있었다. sitemap이
 * `force-dynamic`이라 **요청할 때마다 모든 페이지가 「방금 수정됨」이라고 말했다.**
 *
 * 검색엔진은 그런 lastmod를 금방 알아채고 **그 사이트의 lastmod를 통째로 무시한다.**
 * 즉 거짓말 하나 때문에, 진짜로 글이 올라간 페이지의 신호까지 같이 죽는다.
 *
 * ⚠ **모르는 날짜는 적지 않는다.** lastmod는 사이트맵 규격에서 선택 항목이다 —
 *    비워 두는 것이 지어내는 것보다 낫다. 이 사이트가 화면에서 지키는 규칙과 같다
 *    (「수집 전」·「아직 평가 없음」·「모의 투자」를 다 밝히면서 여기서만 단언할 수 없다).
 *
 * ## 어디까지 아는가
 * | 페이지 | lastmod | 근거 |
 * |---|---|---|
 * | `/insights`·글 상세 | 있다 | 글의 `publishedAt` |
 * | `/stocks`·보고서 상세 | 있다 | 보고서의 `publishedAt` |
 * | `/macro*` | 있다 | 지표의 마지막 관측일 |
 * | `/` | 있다 | 위 셋 중 가장 최근 — 홈이 그 셋을 싣는다 |
 * | `/portfolio`·`/journal`·`/about`·`/privacy`·`/disclaimer`·`/board` | **없다** | 언제 바뀌었는지 모른다 |
 */

export type SitemapEntry = {
  /** 사이트 기준 경로. 절대 URL 변환은 라우트가 한다(`absoluteUrl`). */
  path: string;
  /** YYYY-MM-DD 또는 ISO. ⚠ 모르면 넣지 않는다. */
  lastModified?: string;
  changeFrequency: "daily" | "weekly" | "monthly";
  priority: number;
};

export type SitemapInput = {
  /** 자체 작성 글(티스토리 원문은 부르는 쪽에서 이미 걸렀다) */
  posts: { slug: string; publishedAt?: string | null }[];
  /** 발행된 종목 보고서 */
  reports: { ticker: string; publishedAt?: string | null }[];
  /** 지표 묶음 키 */
  macroGroups: string[];
  /** 지표의 마지막 관측일(YYYY-MM-DD). 수집 전이면 없다. */
  macroAsOf?: string;
  communityEnabled: boolean;
};

/** 가장 최근 날짜. 전부 없으면 `undefined` — ⚠ 오늘로 메우지 않는다. */
export function latestOf(...dates: (string | null | undefined)[]): string | undefined {
  const known = dates.filter((d): d is string => !!d);
  if (!known.length) return undefined;
  return known.slice().sort().reverse()[0];
}

export function sitemapEntries(input: SitemapInput): SitemapEntry[] {
  const latestPostAt = latestOf(...input.posts.map((p) => p.publishedAt));
  const latestReportAt = latestOf(...input.reports.map((r) => r.publishedAt));
  /** 홈은 글·보고서·지표를 다 싣는다. 그중 가장 최근이 홈이 바뀐 때다. */
  const homeAt = latestOf(latestPostAt, latestReportAt, input.macroAsOf);

  const entries: SitemapEntry[] = [
    { path: "/", lastModified: homeAt, priority: 1, changeFrequency: "daily" },
    // ⚠ 계좌 기록이 언제 바뀌었는지는 사이트맵이 모른다. 비워 둔다.
    { path: "/portfolio", priority: 0.9, changeFrequency: "weekly" },
    { path: "/journal", priority: 0.9, changeFrequency: "weekly" },
    { path: "/insights", lastModified: latestPostAt, priority: 0.8, changeFrequency: "weekly" },
    // 거시 지표는 매주 갱신되는 고유 콘텐츠라 색인 우선순위를 높게 둔다.
    { path: "/macro", lastModified: input.macroAsOf, priority: 0.9, changeFrequency: "daily" },
    { path: "/macro/bubble", lastModified: input.macroAsOf, priority: 0.8, changeFrequency: "weekly" },
    { path: "/macro/compare", lastModified: input.macroAsOf, priority: 0.7, changeFrequency: "daily" },
    { path: "/macro/calendar", priority: 0.6, changeFrequency: "weekly" },
    { path: "/stocks", lastModified: latestReportAt, priority: 0.6, changeFrequency: "weekly" },
    { path: "/about", priority: 0.5, changeFrequency: "monthly" },
    { path: "/disclaimer", priority: 0.3, changeFrequency: "monthly" },
    { path: "/privacy", priority: 0.3, changeFrequency: "monthly" },
  ];

  for (const post of input.posts) {
    entries.push({
      path: `/insights/${post.slug}`,
      lastModified: post.publishedAt ?? undefined,
      changeFrequency: "monthly",
      priority: 0.7,
    });
  }

  // 지표 묶음 — 각각 다른 주제의 본문을 가진 페이지다(중복 콘텐츠가 아니다).
  for (const key of input.macroGroups) {
    entries.push({
      path: `/macro/${key}`,
      lastModified: input.macroAsOf,
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  // ⚠ **발행된 보고서만** 넣는다. 404를 색인 요청하면 사이트 신뢰가 깎인다.
  for (const report of input.reports) {
    entries.push({
      path: `/stocks/${report.ticker}`,
      lastModified: report.publishedAt ?? undefined,
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  // 닫혀 있는 영역은 넣지 않는다 — 404를 색인 요청하는 꼴이 된다.
  if (input.communityEnabled) {
    entries.push({ path: "/board", changeFrequency: "daily", priority: 0.6 });
  }

  return entries;
}

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
 *
 * ## ⚠ 빈 목록은 넣지 않는다 (2026-11-14 · v3 첫 조각)
 * 애드센스가 「가치가 별로 없는 콘텐츠」로 거절했다(2026-11). 그때 `/journal`(「아직 기록이 없습니다」)과
 * `/stocks`(「아직 발행한 보고서가 없습니다」 · 본문 236자)가 사이트맵에 올라 있었다 — **빈 쪽을 색인해 달라고**
 * 우리가 직접 요청한 셈이다. 그래서 목록에 실제 항목이 0이면 사이트맵에서 빼고, 페이지는 `noindex, follow`로 둔다
 * (`emptyListingRobots`). ⚠ 페이지는 지우지 않는다 — 메뉴에서 그대로 열리고 「아직 없다」고 적는다(운영지침 §4).
 * ⚠ 항목이 하나라도 생기면 **코드 수정 없이** 다시 들어간다. 심사 기간에만 켜는 분기가 아니다 — 사람과 검색엔진이 같은 화면을 본다.
 */
import { BUBBLE_PUBLIC } from "./site-policy";

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
  /** 공개된 투자일지 수. ⚠ 0이면 `/journal`을 넣지 않는다(빈 목록) */
  journalCount: number;
  /** `/stocks` 목록에 실제로 보이는 보고서 수(구조화 + 올린 HTML). ⚠ 0이면 `/stocks`를 넣지 않는다 */
  stocksListingCount: number;
  /** 공개된 오늘의 브리핑 날짜들(YYYY-MM-DD). ⚠ 초안은 넣지 않는다 — 404를 색인 요청하게 된다. */
  briefings?: string[];
};

/**
 * 목록 페이지의 robots — 항목이 0이면 `noindex, follow`, 있으면 기본값(`undefined`).
 * ⚠ 사이트맵의 「빈 목록은 넣지 않는다」와 **같은 기준**이어야 한다. 사이트맵에서만 빼면 검색엔진이 링크로 찾아와 빈 쪽을 색인한다.
 * ⚠ `follow`는 남긴다 — 빈 목록에도 다른 화면으로 가는 링크(주도주·블로그)가 있다.
 */
export function emptyListingRobots(count: number): { index: false; follow: true } | undefined {
  return Number.isFinite(count) && count > 0 ? undefined : { index: false, follow: true };
}

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
    // ⚠ 빈 목록은 색인을 요청하지 않는다(위 「빈 목록은 넣지 않는다」)
    ...(input.journalCount > 0 ? [{ path: "/journal", priority: 0.9, changeFrequency: "weekly" as const }] : []),
    { path: "/insights", lastModified: latestPostAt, priority: 0.8, changeFrequency: "weekly" },
    // 거시 지표는 매주 갱신되는 고유 콘텐츠라 색인 우선순위를 높게 둔다.
    { path: "/macro", lastModified: input.macroAsOf, priority: 0.9, changeFrequency: "daily" },
    // ⚠ 버블은 공개할 때만(`BUBBLE_PUBLIC`)
    ...(BUBBLE_PUBLIC
      ? [{ path: "/macro/bubble", lastModified: input.macroAsOf, priority: 0.8, changeFrequency: "weekly" as const }]
      : []),
    { path: "/macro/compare", lastModified: input.macroAsOf, priority: 0.7, changeFrequency: "daily" },
    { path: "/macro/calendar", priority: 0.6, changeFrequency: "weekly" },
    // ⚠ 용어 사전은 코드 상수라 언제 바뀌었는지 사이트맵이 모른다. 링크 확인일(`checked`)은
    //    「링크를 본 날」이지 「페이지가 바뀐 날」이 아니다 — 대신 쓰지 않는다.
    { path: "/macro/glossary", priority: 0.5, changeFrequency: "monthly" },
    { path: "/leaders", priority: 0.8, changeFrequency: "weekly" },
    // 블로그 글 목록 — 매일 수집하지만 글은 주 몇 편이다.
    { path: "/blog", priority: 0.8, changeFrequency: "weekly" },
    // 오늘의 브리핑(2026-10-31) — 매일 아침 한 편.
    { path: "/briefing", lastModified: latestOf(...(input.briefings ?? [])), priority: 0.7, changeFrequency: "daily" },
    ...(input.stocksListingCount > 0
      ? [{ path: "/stocks", lastModified: latestReportAt, priority: 0.6, changeFrequency: "weekly" as const }]
      : []),
    { path: "/about", priority: 0.5, changeFrequency: "monthly" },
    { path: "/data-terms", priority: 0.3, changeFrequency: "monthly" },
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

  for (const date of input.briefings ?? []) {
    entries.push({ path: `/briefing/${date}`, lastModified: date, changeFrequency: "monthly", priority: 0.6 });
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

/**
 * RSS 2.0 피드를 만든다 — 순수 함수. DB·React·환경 의존 없음(CLAUDE.md §1).
 *
 * ## ⚠ 전문을 싣지 않는다
 * 이 사이트의 1순위는 **티스토리로 트래픽을 보내는 것**이다(CLAUDE.md §5).
 * 피드에 본문을 통째로 실으면 구독자가 **리더 안에서 다 읽고 끝난다** — 사이트에도, 블로그에도 오지 않는다.
 * 그래서 항목마다 **제목 · 요약 · 링크**만 낸다. 요약이 없으면 지어내지 않고 **비워 둔다**
 * (본문 앞부분을 잘라 넣는 방법도 있지만, 그러면 「요약을 쓰지 않아도 되는」 길이 생겨 요약이 영영 안 쓰인다).
 *
 * ## ⚠ 링크는 화면과 **같은 규칙**을 쓴다
 * 티스토리 원문이 있는 글은 **경유 링크(`/go/...`)**로 보낸다 — `SectionFrame`과 같다.
 * 경유해야 「티스토리로 넘어간 클릭」에 집계된다(그게 이 사이트의 성과 지표다).
 * 판단을 두 곳에 두지 않으려고 링크 결정은 `outboundPostHref`를 그대로 부른다.
 *
 * ## ⚠ `guid`는 링크와 따로 둔다
 * 링크는 경유 주소라 나중에 바뀔 수 있다. `guid`가 바뀌면 리더가 **같은 글을 새 글로 다시 띄운다.**
 * 그래서 `guid`는 우리 영구 주소(`/insights/<slug>`)로 고정하고 `isPermaLink="false"`를 붙인다.
 */

/** 피드에 필요한 것만. ⚠ `body`는 받지 않는다 — 실을 일이 없다. */
export type FeedPost = {
  slug: string;
  title: string;
  excerpt?: string | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
  source?: string | null;
  externalUrl?: string | null;
};

export type FeedOptions = {
  /** 절대 주소의 기준. 끝의 `/`는 있어도 없어도 된다 */
  siteUrl: string;
  title: string;
  description: string;
  /** 티스토리 경유 링크를 만드는 함수 — 화면과 같은 규칙을 쓰려고 주입받는다 */
  outboundPostHref: (slug: string) => string;
  /** 지금 시각(테스트가 고정할 수 있게 받는다) */
  now?: Date;
};

/** 피드에 담는 최대 항목 수. ⚠ 리더가 긴 피드를 잘라 읽는 일이 있어 넉넉하되 무한하지 않게. */
export const FEED_LIMIT = 30;

const trimSlash = (s: string) => s.replace(/\/+$/, "");

/**
 * XML 텍스트 이스케이프.
 * ⚠ **다섯 개를 다 막는다.** `&`를 먼저 바꾸지 않으면 뒤에 만든 `&lt;`가 다시 이스케이프된다.
 */
export function xmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

/** RFC 822 — RSS가 요구하는 날짜 형식. ⚠ ISO를 그대로 넣으면 리더가 날짜를 못 읽는다. */
export function toRfc822(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  return d.toUTCString();
}

/** 이 글을 눌렀을 때 갈 곳. 화면(`SectionFrame`)과 같은 규칙이다. */
export function feedLink(post: FeedPost, opts: FeedOptions): string {
  const base = trimSlash(opts.siteUrl);
  if (post.source === "TISTORY" && post.externalUrl) {
    return `${base}${opts.outboundPostHref(post.slug)}`;
  }
  return `${base}/insights/${post.slug}`;
}

/** 리더가 「같은 글」임을 아는 열쇠. ⚠ 링크가 바뀌어도 이 값은 그대로여야 한다. */
export function feedGuid(post: FeedPost, siteUrl: string): string {
  return `${trimSlash(siteUrl)}/insights/${post.slug}`;
}

export function buildRss(posts: FeedPost[], opts: FeedOptions): string {
  const base = trimSlash(opts.siteUrl);
  const now = opts.now ?? new Date();
  const items = posts.slice(0, FEED_LIMIT);

  /**
   * 피드 자체의 갱신 시각 — 가장 최근 글의 발행일. 글이 없으면 지금.
   * ⚠ 매번 "지금"으로 내면 리더가 **바뀌지 않았는데 바뀐 줄 안다.**
   */
  const latest = items[0]?.publishedAt ?? items[0]?.updatedAt;

  const body = items
    .map((post) => {
      const link = feedLink(post, opts);
      const date = post.publishedAt ?? post.updatedAt;
      const lines = [
        `      <title>${xmlEscape(post.title)}</title>`,
        `      <link>${xmlEscape(link)}</link>`,
        `      <guid isPermaLink="false">${xmlEscape(feedGuid(post, base))}</guid>`,
      ];
      // ⚠ 요약이 없으면 **태그를 아예 넣지 않는다.** 빈 description은 리더에서 빈 줄로 보인다.
      if (post.excerpt) lines.push(`      <description>${xmlEscape(post.excerpt)}</description>`);
      if (date) lines.push(`      <pubDate>${toRfc822(date)}</pubDate>`);
      return `    <item>\n${lines.join("\n")}\n    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xmlEscape(opts.title)}</title>
    <link>${xmlEscape(base)}</link>
    <description>${xmlEscape(opts.description)}</description>
    <language>ko</language>
    <lastBuildDate>${toRfc822(latest ?? now)}</lastBuildDate>
    <atom:link href="${xmlEscape(`${base}/rss.xml`)}" rel="self" type="application/rss+xml" />
${body}
  </channel>
</rss>
`;
}

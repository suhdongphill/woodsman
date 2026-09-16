/**
 * RSS 테스트 — **피드가 목적을 거스르는 길**을 막는다.
 *
 * 이 피드의 위험은 XML이 깨지는 게 아니라, 전문을 실어 사이트·블로그 어느 쪽에도 사람이 안 오는 것이다.
 * 그래서 "잘 만든다"보다 "본문을 싣지 않는다 · 링크 규칙이 화면과 같다"를 더 많이 잰다.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FEED_LIMIT, buildRss, feedGuid, feedLink, toRfc822, xmlEscape, type FeedOptions } from "./rss";

const OPTS: FeedOptions = {
  siteUrl: "https://portfolio-solutions.net/",
  title: "Woodsman",
  description: "거시 지표로 읽는 경제 흐름",
  outboundPostHref: (slug) => `/go/post-${slug}`,
  now: new Date("2026-09-16T00:00:00Z"),
};

const SELF = {
  slug: "fed-three-mandates",
  title: "연준의 책무는 둘이 아니라 셋이다",
  excerpt: "제2A조 원문을 그대로 읽으면 장기금리가 함께 적혀 있다.",
  publishedAt: "2026-09-15T03:00:00.000Z",
  source: "SELF",
};

const TISTORY = {
  slug: "dividend-calendar",
  title: "배당 캘린더로 현금흐름을 설계하기",
  excerpt: "빈 달을 어떻게 메웠는지 원문에 적었다.",
  publishedAt: "2026-09-10T03:00:00.000Z",
  source: "TISTORY",
  externalUrl: "https://suhdp.tistory.com/2",
};

describe("링크 규칙 — 화면과 같아야 한다", () => {
  it("티스토리 원문이 있으면 경유 링크로 보낸다 — 그래야 클릭이 집계된다", () => {
    expect(feedLink(TISTORY, OPTS)).toBe("https://portfolio-solutions.net/go/post-dividend-calendar");
  });

  it("직접 쓴 글은 우리 글 주소로 보낸다", () => {
    expect(feedLink(SELF, OPTS)).toBe("https://portfolio-solutions.net/insights/fed-three-mandates");
  });

  it("⚠ 원문 주소가 비었으면 티스토리로 보내지 않는다 — 없는 링크를 만들지 않는다", () => {
    expect(feedLink({ ...TISTORY, externalUrl: null }, OPTS)).toBe(
      "https://portfolio-solutions.net/insights/dividend-calendar",
    );
  });

  it("⭐ guid는 링크와 다르다 — 경유 주소가 바뀌어도 같은 글로 남아야 한다", () => {
    const guid = feedGuid(TISTORY, OPTS.siteUrl);
    expect(guid).toBe("https://portfolio-solutions.net/insights/dividend-calendar");
    expect(guid).not.toBe(feedLink(TISTORY, OPTS));
  });

  it("기준 주소 끝의 슬래시가 두 번 겹치지 않는다", () => {
    expect(feedLink(SELF, { ...OPTS, siteUrl: "https://portfolio-solutions.net" })).toBe(
      "https://portfolio-solutions.net/insights/fed-three-mandates",
    );
  });
});

describe("⭐ 전문을 싣지 않는다", () => {
  const xml = buildRss([SELF, TISTORY], OPTS);

  it("요약만 나가고 본문 태그는 없다", () => {
    expect(xml).toContain("제2A조 원문을 그대로 읽으면");
    // 전문을 싣는 흔한 태그들 — 하나도 쓰지 않는다
    expect(xml).not.toContain("content:encoded");
    expect(xml).not.toContain("<![CDATA[");
  });

  it("⚠ 요약이 없으면 빈 description을 만들지 않는다 — 본문을 잘라 채우지도 않는다", () => {
    const xml2 = buildRss([{ ...SELF, excerpt: null }], OPTS);
    expect(xml2).not.toContain("<description></description>");
    // 채널 설명은 남아 있어야 한다
    expect(xml2).toContain("거시 지표로 읽는 경제 흐름");
  });
});

describe("XML이 깨지지 않는다", () => {
  it("다섯 문자를 모두 이스케이프하고, &를 두 번 바꾸지 않는다", () => {
    expect(xmlEscape(`a & b < c > d " e ' f`)).toBe("a &amp; b &lt; c &gt; d &quot; e &apos; f");
    expect(xmlEscape("<")).toBe("&lt;");
    expect(xmlEscape("&lt;")).toBe("&amp;lt;");
  });

  it("제목에 &가 있어도 그대로 깨지지 않는다", () => {
    const xml = buildRss([{ ...SELF, title: "금리 & 유동성 <읽는 법>" }], OPTS);
    expect(xml).toContain("<title>금리 &amp; 유동성 &lt;읽는 법&gt;</title>");
  });

  it("날짜는 RFC 822다 — ISO를 그대로 넣으면 리더가 못 읽는다", () => {
    expect(toRfc822("2026-09-15T03:00:00.000Z")).toBe("Tue, 15 Sep 2026 03:00:00 GMT");
    expect(buildRss([SELF], OPTS)).toContain("<pubDate>Tue, 15 Sep 2026 03:00:00 GMT</pubDate>");
  });
});

describe("채널", () => {
  it("⚠ lastBuildDate는 가장 최근 글의 날짜다 — 매번 「지금」이면 안 바뀐 피드가 바뀐 것처럼 보인다", () => {
    expect(buildRss([SELF, TISTORY], OPTS)).toContain("<lastBuildDate>Tue, 15 Sep 2026 03:00:00 GMT</lastBuildDate>");
  });

  it("글이 없어도 피드가 깨지지 않는다(항목 없는 채널)", () => {
    const xml = buildRss([], OPTS);
    expect(xml).toContain("<rss version=\"2.0\"");
    expect(xml).toContain("</channel>");
    expect(xml).not.toContain("<item>");
  });

  it("자기 주소(atom:link rel=self)를 밝힌다 — 리더·검색엔진이 요구한다", () => {
    expect(buildRss([SELF], OPTS)).toContain(
      '<atom:link href="https://portfolio-solutions.net/rss.xml" rel="self" type="application/rss+xml" />',
    );
  });

  it(`항목은 ${FEED_LIMIT}개를 넘지 않는다`, () => {
    const many = Array.from({ length: FEED_LIMIT + 10 }, (_, i) => ({ ...SELF, slug: `p${i}` }));
    const count = (buildRss(many, OPTS).match(/<item>/g) ?? []).length;
    expect(count).toBe(FEED_LIMIT);
  });
});

/**
 * ⚠ 2026-09-16 회귀 — **피드 발견 태그가 조용히 사라진 적이 있다.**
 *
 * 처음에는 루트 `metadata.alternates.types`로 넣었는데, 하위 페이지가
 * `alternates: { canonical: … }`를 설정하면 Next가 상위 `alternates`를 **통째로 덮는다.**
 * 홈을 포함해 거의 모든 페이지가 canonical을 설정하므로 태그가 전부 사라졌고,
 * **배포 뒤 운영 HTML을 긁어 보고서야** 알았다(로컬에서는 피드 자체가 404라 눈에 안 띈다).
 *
 * 그래서 「루트 레이아웃이 `<head>`에 직접 쓴다」를 여기서 **소스로 대조**한다(CLAUDE.md §2-1의 방식).
 */
describe("⚠ 피드 발견 태그는 레이아웃의 <head>에 있어야 한다", () => {
  const layout = readFileSync(join(process.cwd(), "src", "app", "layout.tsx"), "utf8");

  it("<head>에 rel=alternate · application/rss+xml 링크가 있다", () => {
    expect(layout).toMatch(/<link\s+rel="alternate"\s+type="application\/rss\+xml"/);
    expect(layout).toContain('href="/rss.xml"');
  });

  it("⭐ metadata.alternates로 되돌리지 않는다 — 하위 페이지의 canonical이 덮는다", () => {
    expect(layout).not.toContain("application/rss+xml\":");
    expect(layout).not.toMatch(/alternates:\s*\{[\s\S]{0,200}types:/);
  });
});

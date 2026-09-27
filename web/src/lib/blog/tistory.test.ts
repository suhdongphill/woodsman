import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  UNCATEGORIZED,
  blogTargetKey,
  categoryTree,
  decodeEntities,
  displaySummary,
  filterByCategory,
  parseBlogTarget,
  parseEntryPage,
  parseReactionSum,
  parseSitemapEntries,
  popularEntries,
  splitCategory,
  stripUrls,
  visibleEntries,
} from "./tistory";

const fx = (name: string) => readFileSync(join(__dirname, "fixtures", name), "utf8");
const ORIGIN = "https://suhdp.tistory.com";

describe("사이트맵", () => {
  it("글 주소만 뽑고 ⚠ 모바일 주소(/m/entry/)는 뺀다 — 안 빼면 목록이 두 배가 된다", () => {
    const urls = parseSitemapEntries(fx("sitemap.xml"), ORIGIN);
    expect(urls).toHaveLength(3);
    expect(urls.every((u) => u.startsWith(`${ORIGIN}/entry/`))).toBe(true);
    expect(urls.some((u) => u.includes("/m/entry/"))).toBe(false);
    expect(urls.some((u) => u.includes("/category/"))).toBe(false);
  });

  it("⚠ 이 블로그 주소가 아니면 받지 않는다 — 남의 주소로 보내는 길을 만들지 않는다", () => {
    const xml = `<urlset><url><loc>https://evil.example/entry/x</loc></url><url><loc>${ORIGIN}/entry/ok</loc></url></urlset>`;
    expect(parseSitemapEntries(xml, ORIGIN)).toEqual([`${ORIGIN}/entry/ok`]);
  });
});

describe("글 페이지", () => {
  it("실제 글(2026-09-20)에서 번호·제목·카테고리·발행일·요약을 읽는다", () => {
    const r = parseEntryPage(fx("entry-crypto.html"), `${ORIGIN}/entry/x`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.entry.entryId).toBe(29);
    expect(r.entry.title).toBe("크립토 시장의 변화 — 달러의 디지털화와 비트코인의 가격 변동");
    expect(r.entry.category).toBe("CryptoMarket");
    // ⚠ +09:00을 UTC로 옮긴다 — 날짜만 보면 하루가 밀려 보일 수 있다
    expect(r.entry.publishedAt).toBe("2026-09-20T14:52:44.000Z");
    expect(r.entry.summary).toMatch(/^2026\.09\.20/);
    expect(r.entry.thumbnailUrl).toMatch(/^https:\/\//);
  });

  it("⚠ 분류 전 글은 카테고리가 null이다(「미분류」는 화면이 붙인다)", () => {
    const r = parseEntryPage(fx("entry-uncategorized.html"), `${ORIGIN}/entry/y`);
    expect(r.ok && r.entry.category).toBe(null);
    expect(r.ok && r.entry.entryId).toBe(25);
  });

  it("⚠ 글 번호가 없으면 실패다 — 빈칸을 지어 채우지 않는다", () => {
    const html = fx("entry-crypto.html").replace(/window\.T\.entryInfo[^;]*;/, "");
    expect(parseEntryPage(html, "u")).toEqual({ ok: false, reason: expect.stringContaining("글 번호") });
  });

  it("⚠ 발행일이 없으면 실패다", () => {
    const html = fx("entry-crypto.html").replace(/article:published_time"[^>]*>/, ">");
    expect(parseEntryPage(html, "u").ok).toBe(false);
  });
});

describe("공감 수", () => {
  it("합계를 읽는다(2026-09-27 실제 응답 모양)", () => {
    const res = { data: { success: true, code: 200, reactionCounter: { sum: 3, like: 3, sad: 0 } } };
    expect(parseReactionSum(res)).toBe(3);
  });
  it("⚠ 못 읽으면 null — 0으로 만들지 않는다", () => {
    expect(parseReactionSum({ data: {} })).toBe(null);
    expect(parseReactionSum(null)).toBe(null);
    expect(parseReactionSum({ data: { reactionCounter: { sum: "3" } } })).toBe(null);
  });
});

describe("엔티티", () => {
  it("&amp;를 마지막에 푼다 — &amp;lt;는 <가 아니라 &lt;로 남는다", () => {
    expect(decodeEntities("A &mdash; B &#39;C&#39; &amp;lt;")).toBe("A — B 'C' &lt;");
  });
});

describe("요약 속 URL (2026-09-27 — 모바일 가로 넘침의 원인)", () => {
  it("실제 요약의 긴 URL을 뺀다 — entryId 22 「금리는 오르는데, 비트코인은…」", () => {
    const s = "지난 글 https://suhdp.tistory.com/entry/%EB%B9%84%ED%8A%B8%EC%BD%94%EC%9D%B8-%EA%B8%89%EB%93%B1 에서 이어집니다.";
    expect(stripUrls(s)).toBe("지난 글 에서 이어집니다.");
  });

  it("⚠ 붙은 한글·괄호는 남긴다 — 「(https://…/10)에서」 → 「에서」", () => {
    expect(stripUrls("투자전략(https://suhdp.tistory.com/10)에서 이야기 했던")).toBe("투자전략에서 이야기 했던");
  });

  it("URL이 없으면 그대로", () => {
    expect(stripUrls("금리는 5%를 넘었다.")).toBe("금리는 5%를 넘었다.");
  });

  it("화면 요약은 자동 요약의 URL을 빼고, ⚠ 운영자 요약은 손대지 않는다", () => {
    expect(displaySummary({ summary: "보기 https://a.b/c 끝", summaryOverride: null })).toBe("보기 끝");
    expect(displaySummary({ summary: "https://a.b/c", summaryOverride: null })).toBe(null);
    expect(displaySummary({ summary: null, summaryOverride: "직접 https://a.b" })).toBe("직접 https://a.b");
  });
});

describe("요약", () => {
  it("운영자 요약이 먼저, 없으면 티스토리 요약", () => {
    expect(displaySummary({ summary: "자동", summaryOverride: "직접" })).toBe("직접");
    expect(displaySummary({ summary: "자동", summaryOverride: "  " })).toBe("자동");
    expect(displaySummary({ summary: null, summaryOverride: null })).toBe(null);
  });
});

type E = { category: string | null; hidden: boolean; publishedAt: string; likes: number | null };
const e = (category: string | null, publishedAt: string, likes: number | null = 0, hidden = false): E => ({ category, publishedAt, likes, hidden });

describe("카테고리", () => {
  it("상위/하위로 나눈다", () => {
    expect(splitCategory("자산배분 전략/인컴(Income) 자산")).toEqual(["자산배분 전략", "인컴(Income) 자산"]);
    expect(splitCategory("CryptoMarket")).toEqual(["CryptoMarket", null]);
    expect(splitCategory(null)).toEqual([UNCATEGORIZED, null]);
  });

  it("글 수 많은 순 · ⚠ 미분류는 맨 뒤", () => {
    const tree = categoryTree([e(null, "1"), e(null, "2"), e(null, "3"), e("A/x", "1"), e("A/y", "1"), e("B", "1")]);
    expect(tree.map((n) => [n.name, n.count])).toEqual([["A", 2], ["B", 1], [UNCATEGORIZED, 3]]);
    expect(tree[0].children).toEqual([{ name: "x", count: 1 }, { name: "y", count: 1 }]);
  });

  it("상위로 거르면 하위 글도 들어온다 · 하위로 거르면 그것만", () => {
    const list = [e("A/x", "1"), e("A/y", "2"), e("B", "3")];
    expect(filterByCategory(list, "A")).toHaveLength(2);
    expect(filterByCategory(list, "A", "y")).toHaveLength(1);
    expect(filterByCategory(list, null)).toHaveLength(3);
  });
});

describe("목록 · 인기", () => {
  it("숨긴 글은 빼고 최신순", () => {
    const list = visibleEntries([e("A", "2026-01-01"), e("A", "2026-03-01"), e("A", "2026-02-01", 0, true)]);
    expect(list.map((x) => x.publishedAt)).toEqual(["2026-03-01", "2026-01-01"]);
  });

  it("공감 많은 순, 같으면 최신 · ⚠ 0과 못 읽음(null)과 숨김은 인기가 아니다", () => {
    const list = [
      e("A", "2026-01-01", 3),
      e("A", "2026-02-01", 3),
      e("A", "2026-03-01", 4),
      e("A", "2026-04-01", 0),
      e("A", "2026-05-01", null),
      e("A", "2026-06-01", 9, true),
    ];
    expect(popularEntries(list, 5).map((x) => [x.likes, x.publishedAt])).toEqual([
      [4, "2026-03-01"],
      [3, "2026-02-01"],
      [3, "2026-01-01"],
    ]);
  });
});

describe("경유 대상 키", () => {
  it("blog-<번호>를 만들고 읽는다", () => {
    expect(blogTargetKey(29)).toBe("blog-29");
    expect(parseBlogTarget("blog-29")).toBe(29);
  });
  it("⚠ 숫자 말고는 받지 않는다", () => {
    for (const bad of ["blog-", "blog-2a", "blog-../x", "blog-1e3", "post-29", "blog-1234567890"]) {
      expect(parseBlogTarget(bad), bad).toBe(null);
    }
  });
});

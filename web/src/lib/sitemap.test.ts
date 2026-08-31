/**
 * sitemap은 **모르는 날짜를 지어내지 않는다.**
 *
 * ⚠ 전에는 정적 페이지 전부에 `lastModified: now`를 찍었다. 라우트가 `force-dynamic`이라
 *    요청할 때마다 모든 페이지가 「방금 수정됨」이라고 말했고, 그러면 검색엔진이
 *    **이 사이트의 lastmod를 통째로 무시한다** — 거짓말 하나가 진짜 신호까지 죽인다.
 */
import { describe, expect, it } from "vitest";
import { latestOf, sitemapEntries } from "./sitemap";

const input = {
  posts: [
    { slug: "a", publishedAt: "2026-08-20" },
    { slug: "b", publishedAt: "2026-08-29" },
  ],
  reports: [{ ticker: "TSM", publishedAt: "2026-08-10" }],
  macroGroups: ["rates", "fx"],
  macroAsOf: "2026-08-31",
  communityEnabled: false,
};
const find = (entries: ReturnType<typeof sitemapEntries>, path: string) =>
  entries.find((e) => e.path === path)!;

describe("sitemapEntries", () => {
  it("⚠ 언제 바뀌었는지 모르는 페이지에는 lastmod를 넣지 않는다", () => {
    const entries = sitemapEntries(input);
    for (const path of ["/portfolio", "/journal", "/about", "/privacy", "/disclaimer"]) {
      expect(find(entries, path).lastModified, path).toBeUndefined();
    }
  });

  it("아는 페이지에는 **실제 근거가 되는 날짜**를 넣는다", () => {
    const entries = sitemapEntries(input);
    // 글 목록은 가장 최근 글의 발행일
    expect(find(entries, "/insights").lastModified).toBe("2026-08-29");
    // 종목 목록은 가장 최근 보고서
    expect(find(entries, "/stocks").lastModified).toBe("2026-08-10");
    // 지표 화면은 마지막 관측일
    expect(find(entries, "/macro").lastModified).toBe("2026-08-31");
    expect(find(entries, "/macro/rates").lastModified).toBe("2026-08-31");
    // 홈은 그 셋 중 가장 최근 — 홈이 셋을 다 싣는다
    expect(find(entries, "/").lastModified).toBe("2026-08-31");
  });

  it("⚠ 수집 전이면 지표 화면의 lastmod도 없다 — 오늘로 메우지 않는다", () => {
    const entries = sitemapEntries({ ...input, macroAsOf: undefined });
    expect(find(entries, "/macro").lastModified).toBeUndefined();
    // 홈은 글·보고서가 남아 있으므로 그중 최근을 쓴다.
    expect(find(entries, "/").lastModified).toBe("2026-08-29");
  });

  it("아무 근거도 없으면 홈에도 lastmod가 없다", () => {
    const entries = sitemapEntries({
      posts: [],
      reports: [],
      macroGroups: [],
      communityEnabled: false,
    });
    expect(find(entries, "/").lastModified).toBeUndefined();
  });

  it("닫힌 커뮤니티는 넣지 않는다 — 404를 색인 요청하지 않는다", () => {
    expect(sitemapEntries(input).some((e) => e.path === "/board")).toBe(false);
    expect(sitemapEntries({ ...input, communityEnabled: true }).some((e) => e.path === "/board")).toBe(
      true,
    );
  });

  it("latestOf는 전부 없으면 undefined를 준다", () => {
    expect(latestOf(null, undefined)).toBeUndefined();
    expect(latestOf("2026-01-01", null, "2026-08-31")).toBe("2026-08-31");
  });
});

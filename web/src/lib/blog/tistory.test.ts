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
  articleBlocks,
  articleSummary,
  clampSummary,
  cleanSummary,
  isKicker,
  splitTitle,
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
    // ⚠ 예전엔 티스토리 요약을 그대로 써서 「2026.09.20 · CRYPTO MARKET…」으로 시작했다 — 이제 머리표를 걷는다(80)
    expect(r.entry.summary).not.toMatch(/^2026\.09\.20/);
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

describe("본문에서 요약 (2026-09-27 (80) — 매체 수준 요약)", () => {
  const T = (name: string) => ({ html: fx(name), title: fx(name).match(/og:title" content="([^"]*)"/)![1] });

  it("블록마다 끊는다 — 「다시 읽습니다기준일」처럼 붙지 않는다", () => {
    const texts = articleBlocks(fx("body-crypto-glance.html")).map((b) => b.text);
    expect(texts).toContain("이번 주 8만 달러 회복을 숲의 눈으로 다시 읽습니다");
    expect(texts.some((t) => t.includes("읽습니다기준일"))).toBe(false);
  });

  it("「한눈에 보기」 상자 — 작가가 쓴 요약을 쓴다", () => {
    const { html, title } = T("body-crypto-glance.html");
    expect(articleSummary(html, title)).toMatch(/^암호화폐 시장은 나무 한 그루가 아닙니다/);
  });

  it("「한 줄 요약」 표지 다음 블록", () => {
    const { html, title } = T("body-fedboj-oneline.html");
    expect(articleSummary(html, title)).toMatch(/^정책금리는 올랐지만/);
  });

  it("「한 줄 요약 — …」 한 블록 안", () => {
    const { html, title } = T("body-aimodel-inline.html");
    expect(articleSummary(html, title)).toMatch(/^AI 모델 가중치/);
  });

  it("「메타 설명: …」", () => {
    const { html, title } = T("body-leverage-meta.html");
    expect(articleSummary(html, title)).toMatch(/^레버리지 ETF 손절선은/);
  });

  it("표지가 없으면 첫 완결 문장", () => {
    const { html, title } = T("body-principles-fallback.html");
    expect(articleSummary(html, title)).toMatch(/^최근 주식시장이 상승장으로/);
  });

  it("⚠ URL은 빼고 괄호 뒤 한글은 남긴다 · 제목 반복·「업데이트:」는 건너뛴다", () => {
    const { html, title } = T("body-brazil-fragment.html");
    const s = articleSummary(html, title)!;
    expect(s).not.toMatch(/https?:/);
    expect(s).not.toContain("업데이트");
  });

  it("인라인 태그는 공백이 아니다 — 「숲 입니다」가 되지 않는다", () => {
    const s = articleSummary(T("body-crypto-glance.html").html, "x")!;
    expect(s).not.toMatch(/숲 입니다/);
  });

  it("⚠ 수용 기준 — 어느 요약도 「WOODSMAN ·」·날짜로 시작하지 않고, 한글 뒤에 영문 대문자가 붙지 않는다", () => {
    for (const name of ["body-crypto-glance.html", "body-fedboj-oneline.html", "body-aimodel-inline.html", "body-leverage-meta.html", "body-principles-fallback.html", "body-brazil-fragment.html"]) {
      const { html, title } = T(name);
      const s = articleSummary(html, title)!;
      expect(s, name).not.toMatch(/^(WOODSMAN\s*·|\d{4}\.\d{2}\.\d{2})/);
      expect(s, name).not.toMatch(/[가-힣][A-Z]{2,}/);
    }
  });
});

describe("머리표 · 정리 · 자르기", () => {
  it("머리표를 알아본다", () => {
    expect(isKicker("2026.09.20 · CRYPTO MARKET")).toBe(true);
    expect(isKicker("CAPITAL FLOW · 2026.09.16 – 09.18")).toBe(true);
    expect(isKicker("이번 주 8만 달러 회복을 숲의 눈으로 다시 읽습니다")).toBe(false);
  });

  it("티스토리 요약의 머리표를 걷는다 — 실측 두 모양", () => {
    expect(cleanSummary("WOODSMAN · CRYPTO 자본경로 · 2026.09.27 9월 셋째 주 비트코인")).toBe("9월 셋째 주 비트코인");
    expect(cleanSummary("2026.09.20 · CRYPTO MARKET크립토 시장은 어떻게")).toBe("크립토 시장은 어떻게");
  });

  it("엔티티를 푼다 — 실측 &rarr; &minus; &hellip;", () => {
    expect(cleanSummary("5.01% &rarr; 4.94%, 약 &minus;4bp 라니&hellip;")).toBe("5.01% → 4.94%, 약 −4bp 라니…");
  });

  it("약 140자에서 문장 단위로 자르고 「…」", () => {
    const long = "가".repeat(70) + "다. " + "나".repeat(60) + "다. " + "라".repeat(80) + "다.";
    const c = clampSummary(long);
    expect(c.endsWith("…")).toBe(true);
    expect(c.length).toBeLessThanOrEqual(155);
    expect(c).toMatch(/다\. …$/);
    expect(clampSummary("짧은 요약입니다.")).toBe("짧은 요약입니다.");
  });
});

describe("제목 나누기 (81)", () => {
  it("첫 대시에서 본제목·부제", () => {
    expect(splitTitle("암호화폐로 들어오는 돈의 길이 달라지고 있다 — 2026년 9월 비트코인 ETF·스테이블코인·디지털 달러로 읽는 크립토 자본경로")).toEqual({
      head: "암호화폐로 들어오는 돈의 길이 달라지고 있다",
      dek: "2026년 9월 비트코인 ETF·스테이블코인·디지털 달러로 읽는 크립토 자본경로",
    });
    expect(splitTitle("Global Capital Regime 2026-09-16 – 5% 할인율은 어디까지 번졌나").dek).toBe("5% 할인율은 어디까지 번졌나");
  });
  it("대시가 없거나 한쪽이 너무 짧으면 나누지 않는다", () => {
    expect(splitTitle("WoodsMan의 투자원칙")).toEqual({ head: "WoodsMan의 투자원칙", dek: null });
    expect(splitTitle("AI — 왜 지금인가").dek).toBe(null);
    expect(splitTitle("비트코인 급등의 진짜 원인 — 방아").dek).toBe(null);
  });
  it("⚠ 띄어 쓰지 않은 대시(범위 표기)는 나누지 않는다", () => {
    expect(splitTitle("2026.09.16–09.18 금리 결정 정리").dek).toBe(null);
  });
});

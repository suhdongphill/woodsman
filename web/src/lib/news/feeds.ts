/**
 * 파도(오늘의 기사) — 공공기관 피드 해석. 순수 함수(네트워크·DB 없음). 통합 계획 S3 (2026-09-14).
 *
 * ## 무엇을 자동으로 받나 (운영자 결정: 연준 발언은 자동 + 나머지는 관리자 입력)
 * - 연준 **연설**(`feeds/speeches.xml`) · **금융정책 보도자료**(`press_monetary.xml` — FOMC 성명·의사록) · **의회 증언**(`testimony.xml`) — RSS 2.0
 * - BLS **CPI 발표**(`feed/cpi.rss`) — ⚠ 확장자는 rss지만 **Atom**이다
 * ⚠ 둘 다 미국 정부 저작물이다. 그래도 **본문을 싣지 않는다** — 제목 · 날짜 · 원문 링크 · (있으면) 기관이 준 한 줄 설명만.
 *
 * ## ⚠ 실제 응답에서 확인한 것
 * - 연준 피드는 파일 맨 앞에 **BOM**이 있고, 링크·날짜가 **CDATA**다. 제목의 `&#39;` 같은 엔티티를 풀어야 한다.
 * - 연준 연설 제목은 「**Waller**, The Economic Outlook…」처럼 발언자가 쉼표 앞에 온다 — 발언자를 그 자리에서 뽑는다(지어내지 않는다: 쉼표가 없으면 발언자 없음).
 * - BLS Atom의 `content`에는 발표 요지(「rose 0.4 percent … 3.4 percent over the last 12 months」)가 들어 있다 — 한 줄 요약으로 쓴다.
 * ⚠ 형식이 깨진 항목(제목·링크·날짜 중 하나라도 없음)은 **버리고 센다** — 반쯤 채운 기사를 홈에 올리지 않는다.
 */

export type NewsSource = "FED_SPEECH" | "FED_MONETARY" | "FED_TESTIMONY" | "BLS_CPI" | "MANUAL";
/** 홈 파도 분류 — 운영자 요청: 금리 · 물가(CPI) · 연준(FOMC·발언) · 유가 · 지정학 · 환율 */
export type NewsCategory = "연준" | "물가" | "금리" | "유가" | "지정학" | "환율";

export type NewsItem = {
  source: NewsSource;
  category: NewsCategory;
  title: string;
  url: string;
  /** ISO 시각(UTC) */
  publishedAt: string;
  /** 기관이 준 한 줄 설명(본문 아님) */
  summary?: string;
  /** 연준 연설·증언의 발언자 */
  speaker?: string;
};

export type ParseResult = { items: NewsItem[]; skipped: number };

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'", "&#39;": "'", "&nbsp;": " " };

export function cleanText(raw: string | undefined): string {
  if (!raw) return "";
  return raw
    .replace(/^﻿/, "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&[a-z#0-9]+;/gi, (e) => ENTITIES[e] ?? e)
    .replace(/\s+/g, " ")
    .trim();
}

function tag(block: string, name: string): string | undefined {
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`).exec(block);
  return m ? cleanText(m[1]) : undefined;
}

function toIso(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? new Date(t).toISOString() : undefined;
}

/** 연준 RSS 한 채널. `source`는 부르는 쪽이 피드 주소로 정한다. */
export function parseFedRss(xml: string, source: Exclude<NewsSource, "BLS_CPI" | "MANUAL">): ParseResult {
  const items: NewsItem[] = [];
  let skipped = 0;
  for (const m of xml.replace(/^﻿/, "").matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const title = tag(m[1], "title");
    const url = tag(m[1], "link");
    const publishedAt = toIso(tag(m[1], "pubDate"));
    if (!title || !url || !publishedAt || !/^https:\/\/www\.federalreserve\.gov\//.test(url)) {
      skipped++;
      continue;
    }
    const description = tag(m[1], "description");
    const speaker = source === "FED_MONETARY" ? undefined : /^([A-Z][A-Za-z.'\- ]{1,40}),\s/.exec(title)?.[1];
    items.push({
      source,
      category: "연준",
      title,
      url,
      publishedAt,
      ...(description && description !== title ? { summary: description } : {}),
      ...(speaker ? { speaker } : {}),
    });
  }
  return { items, skipped };
}

/** BLS CPI Atom */
export function parseBlsCpiAtom(xml: string): ParseResult {
  const items: NewsItem[] = [];
  let skipped = 0;
  for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const title = tag(m[1], "title");
    const url = /<link[^>]*href="([^"]+)"/.exec(m[1])?.[1];
    const publishedAt = toIso(tag(m[1], "published") ?? tag(m[1], "updated"));
    if (!title || !url || !publishedAt || !/^https:\/\/www\.bls\.gov\//.test(url)) {
      skipped++;
      continue;
    }
    const content = tag(m[1], "content");
    items.push({ source: "BLS_CPI", category: "물가", title, url, publishedAt, ...(content ? { summary: content.slice(0, 280) } : {}) });
  }
  return { items, skipped };
}

/**
 * 홈 파도에 올릴 순서 — 최신순, 같은 원문 링크는 한 번만.
 * ⚠ 연준 금융정책 보도자료 중 FOMC **성명**은 의사록·할인율 회의록보다 앞에 둘 이유가 있지만, 날짜를 거슬러 끌어올리지 않는다(순서 조작 금지).
 */
export function mergeNews(lists: NewsItem[][], limit: number): NewsItem[] {
  const seen = new Set<string>();
  return lists
    .flat()
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .filter((n) => (seen.has(n.url) ? false : (seen.add(n.url), true)))
    .slice(0, limit);
}

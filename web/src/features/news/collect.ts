/**
 * 공공기관 피드를 받아 파도에 쌓는다 — 거시 수집이 끝난 뒤 부른다(`features/macro/ingest.ts`).
 *
 * ⚠ 피드 하나가 실패해도 나머지는 받는다. 실패는 **로그와 반환값** 양쪽에 남긴다(조용한 실패 금지).
 * ⚠ 이 수집이 실패해도 거시 수집·점수 결과는 그대로다 — 부르는 쪽이 따로 감싼다.
 */
import { parseBlsCpiAtom, parseFedRss, type NewsItem, type ParseResult } from "@/lib/news/feeds";
import { upsertAutoNews } from "./repository";

const FEEDS: { key: string; url: string; parse: (xml: string) => ParseResult }[] = [
  { key: "FED_SPEECH", url: "https://www.federalreserve.gov/feeds/speeches.xml", parse: (x) => parseFedRss(x, "FED_SPEECH") },
  { key: "FED_MONETARY", url: "https://www.federalreserve.gov/feeds/press_monetary.xml", parse: (x) => parseFedRss(x, "FED_MONETARY") },
  { key: "FED_TESTIMONY", url: "https://www.federalreserve.gov/feeds/testimony.xml", parse: (x) => parseFedRss(x, "FED_TESTIMONY") },
  { key: "BLS_CPI", url: "https://www.bls.gov/feed/cpi.rss", parse: parseBlsCpiAtom },
];

export type NewsCollectSummary = {
  saved: number;
  skipped: number;
  failed: { feed: string; error: string }[];
};

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    // ⚠ BLS는 사용자 에이전트가 없는 요청을 막는다 — 누구인지 밝힌다.
    const res = await fetch(url, { signal: controller.signal, headers: { "user-agent": "Mozilla/5.0 (compatible; WoodsmanBot/1.0; +https://portfolio-solutions.net)" } });
    if (!res.ok) throw new Error(`응답 ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function collectPublicNews(): Promise<NewsCollectSummary> {
  const items: NewsItem[] = [];
  let skipped = 0;
  const failed: NewsCollectSummary["failed"] = [];
  const results = await Promise.all(
    FEEDS.map(async (f) => {
      try {
        return { f, r: f.parse(await fetchText(f.url)) };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[news] ${f.key} 받기 실패`, error);
        failed.push({ feed: f.key, error: message });
        return null;
      }
    }),
  );
  for (const x of results) {
    if (!x) continue;
    if (x.r.items.length === 0) {
      // ⚠ 받았는데 0건이면 형식이 바뀐 것이다 — 성공으로 넘기지 않는다.
      failed.push({ feed: x.f.key, error: "읽힌 기사가 0건 — 피드 형식이 바뀌었을 수 있다" });
      continue;
    }
    items.push(...x.r.items);
    skipped += x.r.skipped;
  }
  const saved = await upsertAutoNews(items);
  return { saved, skipped, failed };
}

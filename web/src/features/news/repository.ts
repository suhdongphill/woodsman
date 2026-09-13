/**
 * 파도(오늘의 기사)의 DB 접근. 해석 규칙은 `lib/news/feeds.ts`(순수 · 테스트)가 원본이다.
 *
 * ⚠ 자동 수집은 **관리자가 넣은 행(MANUAL)을 덮지 않는다** — 운영자가 고친 제목·요약이 다음 수집에 사라지면 안 된다.
 * ⚠ 숨김(`hidden`)은 자동 수집이 되돌리지 않는다 — 운영자가 내린 기사가 다음 수집에 다시 올라오면 안 된다.
 */
import { getD1, queryAll, type D1Statement } from "@/lib/d1";
import type { NewsCategory, NewsItem, NewsSource } from "@/lib/news/feeds";

export type StoredNews = NewsItem & { id: string; hidden: boolean };

/** 자동 수집분을 쌓는다(같은 링크면 갱신 · MANUAL은 건드리지 않음). 넣거나 고친 행 수는 알 수 없어 보낸 수만 돌려준다. */
export async function upsertAutoNews(items: NewsItem[]): Promise<number> {
  if (items.length === 0) return 0;
  const db = await getD1();
  const now = new Date().toISOString();
  const statements: D1Statement[] = items.map((n) =>
    db
      .prepare(
        `INSERT INTO MacroNews (id, source, category, title, url, summary, speaker, publishedAt, hidden, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
         ON CONFLICT(url) DO UPDATE SET
           source = excluded.source, category = excluded.category, title = excluded.title, summary = excluded.summary,
           speaker = excluded.speaker, publishedAt = excluded.publishedAt, updatedAt = excluded.updatedAt
         WHERE MacroNews.source <> 'MANUAL'`,
      )
      .bind(crypto.randomUUID(), n.source, n.category, n.title, n.url, n.summary ?? null, n.speaker ?? null, n.publishedAt, now, now),
  );
  const BATCH = 20;
  for (let i = 0; i < statements.length; i += BATCH) await db.batch(statements.slice(i, i + BATCH));
  return statements.length;
}

type Row = {
  id: string;
  source: string;
  category: string;
  title: string;
  url: string;
  summary: string | null;
  speaker: string | null;
  publishedAt: string;
  hidden: number;
};

/** 홈 파도 — 숨기지 않은 최신 기사. */
export async function loadLatestNews(limit: number): Promise<StoredNews[]> {
  const rows = await queryAll<Row>(
    `SELECT id, source, category, title, url, summary, speaker, publishedAt, hidden
       FROM MacroNews WHERE hidden = 0 ORDER BY publishedAt DESC LIMIT ?`,
    [limit],
  );
  return rows.map((r) => ({
    id: r.id,
    source: r.source as NewsSource,
    category: r.category as NewsCategory,
    title: r.title,
    url: r.url,
    publishedAt: r.publishedAt,
    hidden: r.hidden === 1,
    ...(r.summary ? { summary: r.summary } : {}),
    ...(r.speaker ? { speaker: r.speaker } : {}),
  }));
}

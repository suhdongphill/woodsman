/**
 * 블로그 글 목록의 DB 접근. 해석·정렬 규칙은 `lib/blog/tistory.ts`(순수 · 테스트)가 원본이다.
 *
 * ⚠ 자동 수집은 **운영자가 고친 것**(`summaryOverride`·`hidden`)을 덮지 않는다 — 다음 수집에 사라지면 안 된다.
 * ⚠ `likes`를 못 읽은 날은 **그 칸을 건드리지 않는다**(어제 값 유지 · `likesAt`이 오래된 것으로 보인다) — NULL로 덮으면 인기 목록이 하루 비어 버린다.
 */
import { execute, getD1, queryAll, queryOne, toBool, type D1Statement } from "@/lib/d1";
import type { BlogEntry, ParsedBlogEntry } from "@/lib/blog/tistory";

type Row = {
  entryId: number;
  url: string;
  title: string;
  summary: string | null;
  summaryOverride: string | null;
  category: string | null;
  thumbnailUrl: string | null;
  publishedAt: string;
  likes: number | null;
  likesAt: string | null;
  hidden: number;
  pageFetchedAt: string;
};

export type StoredBlogEntry = BlogEntry & { likesAt: string | null; pageFetchedAt: string };

function toEntry(r: Row): StoredBlogEntry {
  return {
    entryId: r.entryId,
    url: r.url,
    title: r.title,
    summary: r.summary,
    summaryOverride: r.summaryOverride,
    category: r.category,
    thumbnailUrl: r.thumbnailUrl,
    publishedAt: r.publishedAt,
    likes: r.likes,
    likesAt: r.likesAt,
    hidden: toBool(r.hidden),
    pageFetchedAt: r.pageFetchedAt,
  };
}

const COLUMNS = `entryId, url, title, summary, summaryOverride, category, thumbnailUrl, publishedAt, likes, likesAt, hidden, pageFetchedAt`;

/** 전체(숨김 포함) — 최신순. 공개 화면은 `visibleEntries`로 거른다. */
export async function loadBlogEntries(): Promise<StoredBlogEntry[]> {
  const rows = await queryAll<Row>(`SELECT ${COLUMNS} FROM BlogEntry ORDER BY publishedAt DESC`);
  return rows.map(toEntry);
}

/** 경유 링크의 목적지. ⚠ **숨긴 글로는 보내지 않는다** — 운영자가 내린 글이 링크로 살아 있으면 안 된다. */
export async function findBlogEntryUrl(entryId: number): Promise<string | null> {
  const row = await queryOne<{ url: string }>(`SELECT url FROM BlogEntry WHERE entryId = ? AND hidden = 0`, [entryId]);
  return row?.url ?? null;
}

/** 이미 아는 글 — 주소 → (번호, 마지막으로 페이지를 읽은 시각). */
export async function loadKnownPages(): Promise<Map<string, { entryId: number; pageFetchedAt: string }>> {
  const rows = await queryAll<{ url: string; entryId: number; pageFetchedAt: string }>(
    `SELECT url, entryId, pageFetchedAt FROM BlogEntry`,
  );
  return new Map(rows.map((r) => [r.url, { entryId: r.entryId, pageFetchedAt: r.pageFetchedAt }]));
}

const BATCH = 20;

async function runBatches(statements: D1Statement[]): Promise<void> {
  if (statements.length === 0) return;
  const db = await getD1();
  for (let i = 0; i < statements.length; i += BATCH) await db.batch(statements.slice(i, i + BATCH));
}

/** 글 페이지에서 읽은 것을 쌓는다. ⚠ `summaryOverride`·`hidden`·`likes`는 UPDATE 목록에 없다. */
export async function upsertBlogPages(entries: ParsedBlogEntry[], fetchedAt: string): Promise<void> {
  const db = await getD1();
  await runBatches(
    entries.map((e) =>
      db
        .prepare(
          `INSERT INTO BlogEntry (entryId, url, title, summary, category, thumbnailUrl, publishedAt, pageFetchedAt, hidden, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
           ON CONFLICT(entryId) DO UPDATE SET
             url = excluded.url, title = excluded.title, summary = excluded.summary, category = excluded.category,
             thumbnailUrl = excluded.thumbnailUrl, publishedAt = excluded.publishedAt,
             pageFetchedAt = excluded.pageFetchedAt, updatedAt = excluded.updatedAt`,
        )
        .bind(e.entryId, e.url, e.title, e.summary, e.category, e.thumbnailUrl, e.publishedAt, fetchedAt, fetchedAt, fetchedAt),
    ),
  );
}

/** 공감 수를 쓴다 — 읽은 것만. */
export async function updateBlogLikes(likes: { entryId: number; likes: number }[], at: string): Promise<void> {
  const db = await getD1();
  await runBatches(
    likes.map((l) =>
      db.prepare(`UPDATE BlogEntry SET likes = ?, likesAt = ?, updatedAt = ? WHERE entryId = ?`).bind(l.likes, at, at, l.entryId),
    ),
  );
}

export async function setBlogHidden(entryId: number, hidden: boolean): Promise<void> {
  await execute(`UPDATE BlogEntry SET hidden = ?, updatedAt = ? WHERE entryId = ?`, [hidden ? 1 : 0, new Date().toISOString(), entryId]);
}

/** 운영자 요약. 빈 문자열이면 지운다(자동 요약으로 돌아간다). */
export async function setBlogSummaryOverride(entryId: number, summary: string | null): Promise<void> {
  await execute(`UPDATE BlogEntry SET summaryOverride = ?, updatedAt = ? WHERE entryId = ?`, [
    summary && summary.trim() ? summary.trim() : null,
    new Date().toISOString(),
    entryId,
  ]);
}

export type BlogSyncRecord = {
  id: string;
  trigger: "CRON" | "MANUAL";
  startedAt: string;
  finishedAt: string | null;
  found: number;
  added: number;
  refreshed: number;
  likesRead: number;
  failCount: number;
  failures: { url: string; reason: string }[];
  error: string | null;
};

export async function saveBlogSync(r: BlogSyncRecord): Promise<void> {
  await execute(
    `INSERT INTO BlogSync (id, trigger, startedAt, finishedAt, found, added, refreshed, likesRead, failCount, failures, error)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      r.id,
      r.trigger,
      r.startedAt,
      r.finishedAt,
      r.found,
      r.added,
      r.refreshed,
      r.likesRead,
      r.failCount,
      r.failures.length ? JSON.stringify(r.failures.slice(0, 20)) : null,
      r.error,
    ],
  );
}

type SyncRow = Omit<BlogSyncRecord, "failures" | "trigger"> & { trigger: string; failures: string | null };

/** 최근 수집 기록. */
export async function loadRecentBlogSyncs(limit = 10): Promise<BlogSyncRecord[]> {
  const rows = await queryAll<SyncRow>(`SELECT * FROM BlogSync ORDER BY startedAt DESC LIMIT ?`, [limit]);
  return rows.map((r) => {
    let failures: BlogSyncRecord["failures"] = [];
    try {
      failures = r.failures ? (JSON.parse(r.failures) as BlogSyncRecord["failures"]) : [];
    } catch (error) {
      // ⚠ 삼키지 않는다 — 기록이 깨졌다는 사실이 로그에 남아야 한다.
      console.error("[blog] 수집 기록의 실패 내역을 읽지 못했다", error);
    }
    return { ...r, trigger: r.trigger === "CRON" ? "CRON" : "MANUAL", failures };
  });
}

/**
 * 인사이트 AI 초안 — 재료 모으기와 DB 질의. 판단(대조·조립)은 `lib/insight/draft.ts`.
 * ⚠ 초안은 추가만 한다. 발행은 `Post`의 저장 경로(`savePost` · body → 변환·정화)로만 한다.
 */
import { queryAll, queryOne, execute } from "@/lib/d1";
import { seoulDay } from "@/lib/kst";
import { buildFacts } from "@/lib/gcrm/commentary";
import { visibleEntries } from "@/lib/blog/tistory";
import { newsSourceLabel } from "@/lib/news/feeds";
import type { InsightDraftBody, InsightInput } from "@/lib/insight/draft";
import { loadLatestNews } from "@/features/news/repository";
import { loadBlogEntries } from "@/features/blog/repository";
import { loadPublishedBriefings } from "@/features/briefing/repository";
import { loadCommentaryInput } from "@/features/gcrm/commentary-repo";

/** 재료: 최근 기사 8건 · 최근 블로그 6편 · 최신 공개 브리핑 · 조류 사실표. ⚠ 하나를 못 읽어도 나머지로 만든다(빈 재료는 빈 배열 + 로그). */
export async function loadInsightInput(): Promise<InsightInput> {
  const [news, blogs, briefings, commentary] = await Promise.all([
    loadLatestNews(8).catch((e) => (console.error("[insight] 기사를 못 읽었다", e), [])),
    loadBlogEntries().catch((e) => (console.error("[insight] 블로그를 못 읽었다", e), [])),
    loadPublishedBriefings(1).catch((e) => (console.error("[insight] 브리핑을 못 읽었다", e), [])),
    loadCommentaryInput().catch((e) => (console.error("[insight] 조류 사실표를 못 만들었다", e), undefined)),
  ]);
  const b = briefings[0];
  return {
    today: seoulDay(new Date().toISOString()),
    news: news.map((n) => ({ id: n.id, source: newsSourceLabel(n.source), title: n.title, url: n.url, publishedAt: n.publishedAt, summary: n.summary ?? null })),
    blogs: visibleEntries(blogs)
      .slice(0, 6)
      .map((e) => ({ entryId: e.entryId, title: e.title, summary: e.summaryOverride ?? e.summary ?? null, publishedAt: e.publishedAt })),
    briefing: b ? { date: b.date, headline: b.headline, summary: b.article.summary } : undefined,
    // 조류는 핵심만(방향 · 점수 · 수준 · 4주 비교) — 40줄 전부를 넣으면 프롬프트가 길어져 시간 제한에 걸렸다(2026-11-14 추정)
    facts: commentary ? buildFacts(commentary).filter((f) => /\.(polarity|score|level|w4)$/.test(f.id) || f.id.startsWith("regime.")) : [],
  };
}

export type InsightDraftRow = {
  id: string;
  createdAt: string;
  promptVersion: string;
  status: "DRAFT" | "PUBLISHED" | "REJECTED" | "FAILED";
  body: InsightDraftBody | null;
  input: InsightInput;
  editor: string;
  problems: string[];
  editedTitle: string | null;
  editedMain: string | null;
  operatorNote: string | null;
  postId: string | null;
  decidedAt: string | null;
  decidedBy: string | null;
};

type Db = Omit<InsightDraftRow, "body" | "input" | "problems"> & { body: string | null; input: string; problems: string | null };

function parse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    console.error("[insight] 저장된 JSON을 읽지 못했다", error);
    return fallback;
  }
}

const fromDb = (r: Db): InsightDraftRow => ({
  ...r,
  body: parse<InsightDraftBody | null>(r.body, null),
  input: parse<InsightInput>(r.input, { today: "", news: [], blogs: [], facts: [] }),
  problems: parse<string[]>(r.problems, []),
});

export async function loadInsightDrafts(limit = 20): Promise<InsightDraftRow[]> {
  return (await queryAll<Db>(`SELECT * FROM InsightDraft ORDER BY createdAt DESC LIMIT ?`, [limit])).map(fromDb);
}

export async function findInsightDraft(id: string): Promise<InsightDraftRow | null> {
  const r = await queryOne<Db>(`SELECT * FROM InsightDraft WHERE id = ?`, [id]);
  return r ? fromDb(r) : null;
}

/** 이번 주(월요일부터 · 서울) 발행한 초안 수 — 「주 2~3편」을 화면에 보이기 위해(막지는 않는다). */
export async function countPublishedSince(sinceIso: string): Promise<number> {
  const r = await queryOne<{ n: number }>(`SELECT count(*) AS n FROM InsightDraft WHERE status = 'PUBLISHED' AND decidedAt >= ?`, [sinceIso]);
  return r?.n ?? 0;
}

export async function saveInsightDraft(d: {
  input: InsightInput;
  promptVersion: string;
  status: "DRAFT" | "FAILED";
  body?: InsightDraftBody;
  editor: string;
  problems?: string[];
}): Promise<string> {
  const now = new Date().toISOString();
  const id = `id_${now}`;
  await execute(
    `INSERT INTO InsightDraft (id, createdAt, promptVersion, status, body, input, editor, problems) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, now, d.promptVersion, d.status, d.body ? JSON.stringify(d.body) : null, JSON.stringify(d.input), d.editor, d.problems?.length ? JSON.stringify(d.problems) : null],
  );
  return id;
}

/** 운영자 편집 저장 — ⚠ DRAFT만. */
export async function saveInsightEdits(id: string, e: { title: string; main: string; note: string }): Promise<boolean> {
  const r = await queryOne<{ status: string }>(`SELECT status FROM InsightDraft WHERE id = ?`, [id]);
  if (r?.status !== "DRAFT") return false;
  await execute(`UPDATE InsightDraft SET editedTitle = ?, editedMain = ?, operatorNote = ? WHERE id = ? AND status = 'DRAFT'`, [
    e.title,
    e.main,
    e.note,
    id,
  ]);
  return true;
}

export async function markInsightDraft(id: string, status: "PUBLISHED" | "REJECTED", by: string, postId?: string): Promise<void> {
  await execute(`UPDATE InsightDraft SET status = ?, decidedAt = ?, decidedBy = ?, postId = ? WHERE id = ? AND status = 'DRAFT'`, [
    status,
    new Date().toISOString(),
    by,
    postId ?? null,
    id,
  ]);
}

/**
 * 오늘의 브리핑 DB 접근. 기사 꼴과 거르는 규칙은 `lib/briefing/article.ts`(순수 · 테스트)가 원본이다.
 *
 * ⚠ 공개본만 저장한다 — 원고 원문(SNS 출처가 섞인 것)은 DB에 두지 않는다.
 * ⚠ 읽다 실패하면 빈 목록을 내되 **반드시 console.error**를 남긴다(CLAUDE.md §3 — 「없음」과 「못 읽음」을 가른다).
 */
import { execute, queryAll, queryOne } from "@/lib/d1";
import type { BriefingArticle } from "@/lib/briefing/article";
import type { Rejection } from "@/lib/briefing/rewrite";

export type BriefingStatus = "DRAFT" | "PUBLISHED";

export type StoredBriefing = {
  date: string;
  headline: string;
  article: BriefingArticle;
  status: BriefingStatus;
  editor: string;
  editNote: Rejection[];
  sourceName: string | null;
  publishedAt: string | null;
  updatedAt: string;
};

type Row = {
  date: string;
  headline: string;
  article: string;
  status: string;
  editor: string;
  editNote: string | null;
  sourceName: string | null;
  publishedAt: string | null;
  updatedAt: string;
};

function toBriefing(r: Row): StoredBriefing | null {
  try {
    return {
      date: r.date,
      headline: r.headline,
      article: JSON.parse(r.article) as BriefingArticle,
      status: r.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
      editor: r.editor,
      editNote: r.editNote ? (JSON.parse(r.editNote) as Rejection[]) : [],
      sourceName: r.sourceName,
      publishedAt: r.publishedAt,
      updatedAt: r.updatedAt,
    };
  } catch (error) {
    console.error(`[briefing] ${r.date} 기사 JSON을 읽지 못했다`, error);
    return null;
  }
}

const COLUMNS = "date, headline, article, status, editor, editNote, sourceName, publishedAt, updatedAt";

/** 공개된 것 — 최신순. */
export async function loadPublishedBriefings(limit = 60): Promise<StoredBriefing[]> {
  try {
    const rows = await queryAll<Row>(
      `SELECT ${COLUMNS} FROM Briefing WHERE status = 'PUBLISHED' ORDER BY date DESC LIMIT ?`,
      [limit],
    );
    return rows.map(toBriefing).filter((b): b is StoredBriefing => !!b);
  } catch (error) {
    console.error("[briefing] 공개 목록을 읽지 못했다", error);
    return [];
  }
}

/** 관리자 목록 — 초안 포함. */
export async function loadAllBriefings(limit = 60): Promise<StoredBriefing[]> {
  const rows = await queryAll<Row>(`SELECT ${COLUMNS} FROM Briefing ORDER BY date DESC LIMIT ?`, [limit]);
  return rows.map(toBriefing).filter((b): b is StoredBriefing => !!b);
}

export async function findBriefing(date: string): Promise<StoredBriefing | null> {
  const row = await queryOne<Row>(`SELECT ${COLUMNS} FROM Briefing WHERE date = ?`, [date]);
  return row ? toBriefing(row) : null;
}

/**
 * 초안으로 저장한다(같은 날짜면 덮는다). ⚠ 이미 공개된 날짜를 다시 올리면 **초안으로 내려간다** —
 * 운영자가 미리보기를 보고 다시 「공개」를 눌러야 바뀐 글이 나간다.
 */
export async function saveBriefingDraft(input: {
  article: BriefingArticle;
  editor: string;
  editNote: Rejection[];
  sourceName: string | null;
}): Promise<void> {
  const now = new Date().toISOString();
  await execute(
    `INSERT INTO Briefing (date, headline, article, status, editor, editNote, sourceName, createdAt, updatedAt)
     VALUES (?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET headline = excluded.headline, article = excluded.article, status = 'DRAFT',
       editor = excluded.editor, editNote = excluded.editNote, sourceName = excluded.sourceName, updatedAt = excluded.updatedAt`,
    [
      input.article.date,
      input.article.headline,
      JSON.stringify(input.article),
      input.editor,
      input.editNote.length ? JSON.stringify(input.editNote) : null,
      input.sourceName,
      now,
      now,
    ],
  );
}

/** 공개 · 내리기. 처음 공개한 시각은 한 번만 적는다. */
export async function setBriefingStatus(date: string, status: BriefingStatus): Promise<void> {
  const now = new Date().toISOString();
  await execute(
    `UPDATE Briefing SET status = ?, publishedAt = CASE WHEN ? = 'PUBLISHED' THEN COALESCE(publishedAt, ?) ELSE publishedAt END, updatedAt = ? WHERE date = ?`,
    [status, status, now, now, date],
  );
}

export async function deleteBriefing(date: string): Promise<void> {
  await execute("DELETE FROM Briefing WHERE date = ?", [date]);
}

/**
 * 경제 캘린더 — D1 질의.
 *
 * ⚠ 판단(지났나·평가가 붙었나·무엇을 먼저 쓸까)은 여기 없다.
 *    `src/lib/macro-calendar.ts`(순수 함수 + 테스트)가 한다.
 */
import { execute, queryAll } from "@/lib/d1";
import type { CalendarEvent } from "@/lib/macro-calendar";

type Row = {
  id: string;
  at: string;
  title: string;
  kind: string;
  country: string;
  importance: number;
  note: string | null;
  postSlug: string | null;
  source: string;
  timeKnown: number;
};

function toEvent(row: Row): CalendarEvent {
  return {
    id: row.id,
    at: row.at,
    title: row.title,
    kind: row.kind,
    country: row.country,
    importance: row.importance,
    note: row.note ?? undefined,
    postSlug: row.postSlug ?? undefined,
    source: row.source,
    timeKnown: row.timeKnown === 1,
  };
}

const COLUMNS = `id, at, title, kind, country, importance, note, postSlug, source, timeKnown`;

/** 최근·다가오는 것을 함께 본다. 창을 넓게 잡고 걸러 쓰는 편이 왕복보다 싸다. */
export async function loadEvents(limit = 200): Promise<CalendarEvent[]> {
  const rows = await queryAll<Row>(
    `SELECT ${COLUMNS} FROM MacroEvent ORDER BY at DESC LIMIT ?`,
    [limit],
  );
  return rows.map(toEvent);
}

export async function createEvent(input: {
  at: string;
  title: string;
  kind: string;
  country: string;
  importance: number;
  note?: string;
  postSlug?: string;
  /** ⚠ 시각을 모르면 false — 화면이 시각을 지운다 */
  timeKnown: boolean;
  /** ⚠ 자동 수집이 붙을 자리. 지금은 언제나 MANUAL이다 */
  source?: string;
  externalId?: string;
}): Promise<void> {
  const now = new Date().toISOString();
  await execute(
    `INSERT INTO MacroEvent
       (id, at, title, kind, country, importance, note, postSlug, source, externalId,
        timeKnown, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      `ev_${now}_${Math.floor(performance.now())}`,
      input.at,
      input.title,
      input.kind,
      input.country,
      input.importance,
      input.note ?? null,
      input.postSlug ?? null,
      input.source ?? "MANUAL",
      input.externalId ?? null,
      input.timeKnown ? 1 : 0,
      now,
      now,
    ],
  );
}

/** 평가 글을 잇는다. ⚠ 일정 전체를 다시 쓰지 않는다 — 다른 칸을 실수로 지우지 않게. */
export async function linkPost(id: string, postSlug: string | null): Promise<void> {
  await execute(`UPDATE MacroEvent SET postSlug = ?, updatedAt = ? WHERE id = ?`, [
    postSlug,
    new Date().toISOString(),
    id,
  ]);
}

export async function deleteEvent(id: string): Promise<void> {
  await execute(`DELETE FROM MacroEvent WHERE id = ?`, [id]);
}

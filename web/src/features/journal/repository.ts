/**
 * 투자일지 · 계좌 스냅샷의 DB 접근.
 *
 * ## 왜 이걸 만들었나
 * 화면이 `src/lib/mock.ts`를 읽고 있어서 **관리자 화면에서 아무리 고쳐도 바뀌지 않았다.**
 * 시드가 D1에 같은 데이터를 넣어 두었는데도 화면은 파일을 보고 있었다.
 * 이 사이트의 주력 콘텐츠가 투자일지와 계좌 곡선이라, 못 고치면 사이트가 굴러가지 않는다.
 *
 * ⚠ 날짜는 DB에 ISO 문자열(DATETIME)로 들어 있다. 화면은 `YYYY-MM-DD`만 쓰므로
 *    읽을 때 잘라서 넘긴다 — 화면마다 다르게 자르면 표시가 어긋난다.
 */
import { execute, queryAll, queryOne, toBool } from "@/lib/d1";
import type { AccountSnapshot, JournalAction, JournalEntry } from "@/lib/types";

/** DATETIME → YYYY-MM-DD */
function dayOf(value: string): string {
  return String(value).slice(0, 10);
}

/** YYYY-MM-DD → 저장용 ISO. 시각은 정오로 둔다(시간대 때문에 하루 밀리는 사고 방지). */
function toStoredDate(day: string): string {
  return `${day}T12:00:00.000Z`;
}

type JournalRow = {
  id: string;
  date: string;
  action: string;
  title: string;
  body: string;
  ticker: string | null;
  name: string | null;
  shares: number | null;
  price: number | null;
  currency: string | null;
  postSlug: string | null;
  published: number;
};

function toEntry(row: JournalRow): JournalEntry {
  return {
    id: row.id,
    date: dayOf(row.date),
    action: row.action as JournalAction,
    title: row.title,
    body: row.body,
    ticker: row.ticker ?? undefined,
    name: row.name ?? undefined,
    shares: row.shares ?? undefined,
    price: row.price ?? undefined,
    currency: (row.currency as "KRW" | "USD" | null) ?? undefined,
    postSlug: row.postSlug ?? undefined,
    published: toBool(row.published),
  };
}

const JOURNAL_COLUMNS = `id, date, action, title, body, ticker, name, shares, price, currency, postSlug, published`;

/** 공개 화면용 — 발행된 것만, 최신순. */
export async function loadPublishedJournal(limit = 50): Promise<JournalEntry[]> {
  const rows = await queryAll<JournalRow>(
    `SELECT ${JOURNAL_COLUMNS} FROM JournalEntry WHERE published = 1 ORDER BY date DESC LIMIT ?`,
    [limit],
  );
  return rows.map(toEntry);
}

/** 관리자용 — 미발행 포함. */
export async function loadAllJournal(limit = 200): Promise<JournalEntry[]> {
  const rows = await queryAll<JournalRow>(
    `SELECT ${JOURNAL_COLUMNS} FROM JournalEntry ORDER BY date DESC LIMIT ?`,
    [limit],
  );
  return rows.map(toEntry);
}

export async function findJournalEntry(id: string): Promise<JournalEntry | null> {
  const row = await queryOne<JournalRow>(
    `SELECT ${JOURNAL_COLUMNS} FROM JournalEntry WHERE id = ?`,
    [id],
  );
  return row ? toEntry(row) : null;
}

export type JournalInput = {
  date: string;
  action: JournalAction;
  title: string;
  body: string;
  ticker?: string;
  name?: string;
  shares?: number;
  price?: number;
  currency?: "KRW" | "USD";
  postSlug?: string;
  published: boolean;
};

/** id를 주면 수정, 없으면 새로 만든다. */
export async function saveJournalEntry(input: JournalInput, id?: string): Promise<void> {
  const now = new Date().toISOString();
  const values = [
    toStoredDate(input.date),
    input.action,
    input.title,
    input.body,
    input.ticker ?? null,
    input.name ?? null,
    input.shares ?? null,
    input.price ?? null,
    input.currency ?? null,
    input.postSlug ?? null,
    input.published ? 1 : 0,
    now,
  ];

  if (id) {
    await execute(
      `UPDATE JournalEntry SET date = ?, action = ?, title = ?, body = ?, ticker = ?, name = ?,
              shares = ?, price = ?, currency = ?, postSlug = ?, published = ?, updatedAt = ?
         WHERE id = ?`,
      [...values, id],
    );
    return;
  }

  await execute(
    `INSERT INTO JournalEntry
       (id, date, action, title, body, ticker, name, shares, price, currency, postSlug, published, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [`j_${now}_${Math.floor(performance.now())}`, ...values, now],
  );
}

export async function deleteJournalEntry(id: string): Promise<void> {
  await execute(`DELETE FROM JournalEntry WHERE id = ?`, [id]);
}

// ────────────── 계좌 스냅샷 ──────────────

type SnapshotRow = {
  date: string;
  principal: number;
  value: number;
  income: number;
  memo: string | null;
};

export async function loadSnapshots(limit = 120): Promise<AccountSnapshot[]> {
  const rows = await queryAll<SnapshotRow>(
    `SELECT date, principal, value, income, memo FROM AccountSnapshot ORDER BY date ASC LIMIT ?`,
    [limit],
  );
  return rows.map((r) => ({
    date: dayOf(r.date),
    principal: r.principal,
    value: r.value,
    income: r.income,
    memo: r.memo ?? undefined,
  }));
}

export type SnapshotInput = {
  date: string;
  principal: number;
  value: number;
  income: number;
  memo?: string;
};

/**
 * 같은 날짜면 덮어쓴다(월 1회 기록이라 날짜가 곧 키다).
 * `date`에 UNIQUE 인덱스가 있어 UPSERT가 성립한다.
 */
export async function saveSnapshot(input: SnapshotInput): Promise<void> {
  const now = new Date().toISOString();
  await execute(
    `INSERT INTO AccountSnapshot (id, date, principal, value, income, memo, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET
       principal = excluded.principal,
       value = excluded.value,
       income = excluded.income,
       memo = excluded.memo`,
    [
      `snap_${input.date}`,
      toStoredDate(input.date),
      input.principal,
      input.value,
      input.income,
      input.memo ?? null,
      now,
    ],
  );
}

export async function deleteSnapshot(date: string): Promise<void> {
  await execute(`DELETE FROM AccountSnapshot WHERE date = ?`, [toStoredDate(date)]);
}

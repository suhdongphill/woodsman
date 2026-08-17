/**
 * 종목 시세 저장소 — D1 질의만 한다.
 *
 * ⚠ 판단(등락·52주·Envelope)은 여기서 하지 않는다. `lib/quote/*`가 순수 함수로 한다.
 *    같은 계산이 두 곳에 생기면 화면마다 다른 숫자가 나온다(8/7 점검에서 그 지적을 받았다).
 *
 * ⚠ ticker는 **문자열로만** 다룬다. 숫자로 파싱하면 `005930` → `5930`이 되어 국내 종목이 사라진다.
 */
import { execute, getD1, queryAll, queryOne, type D1Statement } from "@/lib/d1";
import type { QuotePoint } from "@/lib/quote/types";

/** 날짜만 있는 값은 정오(UTC)로 저장한다 — `MacroPoint`와 같은 규칙이다. */
function toStoredDate(day: string): string {
  return `${day}T12:00:00.000Z`;
}

function dayOf(stored: string): string {
  return stored.slice(0, 10);
}

type QuoteRow = { date: string; close: number; volume: number | null };

/**
 * 한 종목의 시세(오름차순).
 *
 * `limit` 기본값 600은 **일봉 2년 남짓**이다. Envelope가 20주(=100 거래일),
 * 52주 범위가 250 거래일을 쓰므로 그 둘을 넉넉히 덮는다.
 */
export async function loadQuotes(ticker: string, limit = 600): Promise<QuotePoint[]> {
  const rows = await queryAll<QuoteRow>(
    `SELECT date, close, volume FROM StockQuote WHERE ticker = ? ORDER BY date DESC LIMIT ?`,
    [ticker, limit],
  );
  // 최신 N개를 뽑고 나서 오름차순으로 되돌린다(계산이 시간순을 전제한다).
  return rows
    .map((r) => ({
      date: dayOf(r.date),
      close: r.close,
      // ⚠ null을 0으로 바꾸지 않는다. "거래량을 모른다"와 "거래가 없었다"는 다르다.
      volume: r.volume ?? undefined,
    }))
    .reverse();
}

/** 종목별 마지막 거래일 — 수집이 어디까지 왔는지. */
export async function loadMaxDates(): Promise<Map<string, string>> {
  const rows = await queryAll<{ ticker: string; maxDate: string }>(
    `SELECT ticker, MAX(date) AS maxDate FROM StockQuote GROUP BY ticker`,
  );
  return new Map(rows.map((r) => [r.ticker, dayOf(r.maxDate)]));
}

/** 종목별 보유 점 수 — 관리자 화면이 "얼마나 쌓였나"를 보여준다. */
export async function countQuotesByTicker(): Promise<Map<string, number>> {
  const rows = await queryAll<{ ticker: string; n: number }>(
    `SELECT ticker, COUNT(*) AS n FROM StockQuote GROUP BY ticker`,
  );
  return new Map(rows.map((r) => [r.ticker, r.n]));
}

/**
 * 시세를 누적한다(있으면 갱신).
 *
 * ⚠ 넘긴 점을 **전부** 쓴다. "무엇을 쓸지"는 부르는 쪽이 정한다 —
 *    여기서 다시 걸러 내면 같은 판단이 두 곳에 생긴다.
 *
 * ⚠ 한 점에 문장 하나씩 보내면 연결이 끊긴다(2026-08-06 ECONNRESET).
 *    `upsertPoints`와 같은 규칙으로 **한 문장에 20행**을 담는다.
 */
export async function upsertQuotes(
  ticker: string,
  source: string,
  points: QuotePoint[],
): Promise<void> {
  if (points.length === 0) return;

  const db = await getD1();
  const now = new Date().toISOString();

  const ROWS_PER_STATEMENT = 20;
  const STATEMENTS_PER_BATCH = 10;

  const statements: D1Statement[] = [];
  for (let i = 0; i < points.length; i += ROWS_PER_STATEMENT) {
    const chunk = points.slice(i, i + ROWS_PER_STATEMENT);
    const values = chunk.map(() => "(?, ?, ?, ?, ?, ?)").join(", ");
    const params = chunk.flatMap((p) => [
      ticker,
      toStoredDate(p.date),
      p.close,
      p.volume ?? null,
      source,
      now,
    ]);
    statements.push(
      db
        .prepare(
          `INSERT INTO StockQuote (ticker, date, close, volume, source, updatedAt)
           VALUES ${values}
           ON CONFLICT(ticker, date) DO UPDATE SET
             close = excluded.close, volume = excluded.volume,
             source = excluded.source, updatedAt = excluded.updatedAt`,
        )
        .bind(...params),
    );
  }

  for (let i = 0; i < statements.length; i += STATEMENTS_PER_BATCH) {
    await db.batch(statements.slice(i, i + STATEMENTS_PER_BATCH));
  }
}

/** 종목 하나의 시세를 통째로 지운다 — 보고서를 지울 때 함께 정리한다. */
export async function deleteQuotes(ticker: string): Promise<void> {
  await execute(`DELETE FROM StockQuote WHERE ticker = ?`, [ticker]);
}

// ────────────── 수집 이력 ──────────────

export type QuoteIngestDetail = {
  ticker: string;
  ok: boolean;
  added?: number;
  total?: number;
  latest?: string;
  error?: string;
};

export async function startQuoteIngest(trigger: string): Promise<string> {
  const id = `sqi_${new Date().toISOString()}_${Math.floor(performance.now())}`;
  await execute(`INSERT INTO StockQuoteIngest (id, startedAt, trigger) VALUES (?, ?, ?)`, [
    id,
    new Date().toISOString(),
    trigger,
  ]);
  return id;
}

export async function finishQuoteIngest(
  id: string,
  result: {
    okCount: number;
    failCount: number;
    addedPoints: number;
    detail: QuoteIngestDetail[];
  },
): Promise<void> {
  await execute(
    `UPDATE StockQuoteIngest SET finishedAt = ?, okCount = ?, failCount = ?, addedPoints = ?, detail = ?
       WHERE id = ?`,
    [
      new Date().toISOString(),
      result.okCount,
      result.failCount,
      result.addedPoints,
      JSON.stringify(result.detail),
      id,
    ],
  );
}

export type QuoteIngestRun = {
  id: string;
  startedAt: string;
  finishedAt?: string;
  trigger: string;
  okCount: number;
  failCount: number;
  addedPoints: number;
  detail: QuoteIngestDetail[];
};

/**
 * 최근 수집 이력.
 *
 * ⚠ 화면이 이걸 읽어 "마지막 수집이 언제였나"를 말한다. 이 값이 없으면
 *    수집이 멈춘 것과 오늘 값이 원래 없는 것을 구분할 수 없다(CLAUDE.md 3장).
 */
export async function loadQuoteIngestRuns(limit = 5): Promise<QuoteIngestRun[]> {
  const rows = await queryAll<{
    id: string;
    startedAt: string;
    finishedAt: string | null;
    trigger: string;
    okCount: number;
    failCount: number;
    addedPoints: number;
    detail: string | null;
  }>(
    `SELECT id, startedAt, finishedAt, trigger, okCount, failCount, addedPoints, detail
       FROM StockQuoteIngest ORDER BY startedAt DESC LIMIT ?`,
    [limit],
  );

  return rows.map((r) => ({
    id: r.id,
    startedAt: r.startedAt,
    finishedAt: r.finishedAt ?? undefined,
    trigger: r.trigger,
    okCount: r.okCount,
    failCount: r.failCount,
    addedPoints: r.addedPoints,
    detail: parseDetail(r.detail),
  }));
}

/** 마지막 수집 시각 하나만 — 편집 화면 배지가 쓴다. */
export async function loadLastQuoteIngestAt(): Promise<string | undefined> {
  const row = await queryOne<{ startedAt: string }>(
    `SELECT startedAt FROM StockQuoteIngest ORDER BY startedAt DESC LIMIT 1`,
  );
  return row?.startedAt;
}

/** ⚠ 이력 JSON이 깨져도 화면 전체를 죽이지 않는다. 다만 삼키지 않고 로그로 남긴다. */
function parseDetail(raw: string | null): QuoteIngestDetail[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QuoteIngestDetail[]) : [];
  } catch (error) {
    console.error("[stocks] 수집 이력 detail 파싱 실패", error);
    return [];
  }
}

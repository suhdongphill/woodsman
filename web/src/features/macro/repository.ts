/**
 * 거시 지표 시계열의 DB 접근.
 *
 * ## 무엇이 여기 쌓이나
 * `MacroPoint`에는 **원값만** 쌓는다. 지표의 정의(이름·출처·임계값·설명)는
 * `lib/macro/catalog.ts`가 원본이다 — 코드가 카탈로그, DB가 값.
 *
 * ⚠ 날짜는 **정오(UTC)**로 저장한다. 자정으로 넣으면 앞 10자를 자르는 화면에서 하루가 밀린다
 *    (features/journal·portfolio와 같은 규칙).
 * ⚠ 같은 날짜를 다시 받으면 **덮어쓴다.** 통계는 사후에 수정된다(고용·GDP는 두 번 고쳐진다).
 *    처음 받은 값을 고집하면 틀린 숫자가 영원히 남는다.
 */
import { execute, getD1, queryAll, queryOne, type D1Statement } from "@/lib/d1";
import type { SeriesPoint } from "@/lib/macro/series";

function dayOf(value: string): string {
  return String(value).slice(0, 10);
}

function toStoredDate(day: string): string {
  return `${day}T12:00:00.000Z`;
}

type PointRow = { date: string; value: number };

/** 한 지표의 시계열(오름차순). `limit`은 최근 N개. */
export async function loadSeries(seriesKey: string, limit = 600): Promise<SeriesPoint[]> {
  const rows = await queryAll<PointRow>(
    `SELECT date, value FROM MacroPoint WHERE seriesKey = ? ORDER BY date DESC LIMIT ?`,
    [seriesKey, limit],
  );
  // 최신 N개를 뽑고 나서 오름차순으로 되돌린다(변환·차트가 시간순을 전제한다).
  return rows.map((r) => ({ date: dayOf(r.date), value: r.value })).reverse();
}

export type LatestPoint = { seriesKey: string; date: string; value: number; source: string };

/**
 * 모든 지표의 **최신 한 점**만. 홈·허브가 40개 시계열을 통째로 읽지 않게 한다.
 *
 * 화면 한 번에 쿼리 한 번. (D1은 왕복이 비싸다)
 */
export async function loadLatestPoints(): Promise<Map<string, LatestPoint>> {
  const rows = await queryAll<{ seriesKey: string; date: string; value: number; source: string }>(
    `SELECT p.seriesKey, p.date, p.value, p.source
       FROM MacroPoint p
       JOIN (SELECT seriesKey, MAX(date) AS maxDate FROM MacroPoint GROUP BY seriesKey) m
         ON m.seriesKey = p.seriesKey AND m.maxDate = p.date`,
  );

  const out = new Map<string, LatestPoint>();
  for (const r of rows) {
    out.set(r.seriesKey, {
      seriesKey: r.seriesKey,
      date: dayOf(r.date),
      value: r.value,
      source: r.source,
    });
  }
  return out;
}

/**
 * 모든 지표의 **최근 N개**만 한 번에.
 *
 * 홈·허브는 "지금 값"만 필요한데, 전년 대비(YoY)를 내려면 1년 전 점도 있어야 한다.
 * 그래서 전체 시계열이 아니라 **지표당 최근 14개**(월간 기준 1년 남짓)만 가져온다.
 * 40개 시계열을 통째로 읽으면 홈이 느려지고, 최신 한 점만 읽으면 YoY를 못 낸다.
 */
export async function loadRecentPoints(perSeries = 14): Promise<Map<string, SeriesPoint[]>> {
  const rows = await queryAll<{ seriesKey: string; date: string; value: number }>(
    `SELECT seriesKey, date, value FROM (
       SELECT seriesKey, date, value,
              ROW_NUMBER() OVER (PARTITION BY seriesKey ORDER BY date DESC) AS rn
         FROM MacroPoint
     ) WHERE rn <= ? ORDER BY seriesKey ASC, date ASC`,
    [perSeries],
  );

  const out = new Map<string, SeriesPoint[]>();
  for (const r of rows) {
    const list = out.get(r.seriesKey) ?? [];
    list.push({ date: dayOf(r.date), value: r.value });
    out.set(r.seriesKey, list);
  }
  return out;
}

/** 여러 지표의 시계열을 한 번에(그룹 상세 화면용). */
export async function loadSeriesMany(
  seriesKeys: string[],
  limitPerSeries = 400,
): Promise<Map<string, SeriesPoint[]>> {
  const out = new Map<string, SeriesPoint[]>();
  if (seriesKeys.length === 0) return out;

  const placeholders = seriesKeys.map(() => "?").join(", ");
  const rows = await queryAll<{ seriesKey: string; date: string; value: number }>(
    `SELECT seriesKey, date, value FROM MacroPoint
      WHERE seriesKey IN (${placeholders})
      ORDER BY seriesKey ASC, date ASC`,
    seriesKeys,
  );

  for (const r of rows) {
    const list = out.get(r.seriesKey) ?? [];
    list.push({ date: dayOf(r.date), value: r.value });
    out.set(r.seriesKey, list);
  }
  // 지표별로 최근 구간만 남긴다(오래된 점은 차트에서 잘려도 DB에는 그대로 있다).
  for (const [key, list] of out) {
    if (list.length > limitPerSeries) out.set(key, list.slice(list.length - limitPerSeries));
  }
  return out;
}

/**
 * 지표별로 **가장 최근 기준일**만. 수집할 때 "어디부터 새로 쓰면 되는지"를 정하는 데 쓴다.
 *
 * ⚠ 이게 없으면 매번 전체 구간을 다시 쓰게 되고, 실제로 한 번 수집에 3분 넘게 걸렸다.
 */
export async function loadMaxDates(): Promise<Map<string, string>> {
  const rows = await queryAll<{ seriesKey: string; maxDate: string }>(
    `SELECT seriesKey, MAX(date) AS maxDate FROM MacroPoint GROUP BY seriesKey`,
  );
  return new Map(rows.map((r) => [r.seriesKey, dayOf(r.maxDate)]));
}

/**
 * 점들을 누적한다(있으면 갱신).
 *
 * ⚠ 넘긴 점을 **전부** 쓴다. "무엇을 쓸지"는 부르는 쪽이 정한다(ingest가 최근 구간만 넘긴다) —
 *    여기서 다시 걸러 내면 같은 판단이 두 곳에 생긴다.
 */
export async function upsertPoints(
  seriesKey: string,
  source: string,
  points: SeriesPoint[],
): Promise<void> {
  if (points.length === 0) return;

  const db = await getD1();
  const now = new Date().toISOString();

  /**
   * ⚠ 한 점에 문장 하나씩 `batch()`로 보내면 **연결이 끊긴다**(로컬 D1에서 200개 묶음이
   *    ECONNRESET로 죽었다, 2026-08-06). 시계열은 한 번에 수백 점이 들어오므로
   *    **여러 행을 한 INSERT에** 담는다. 왕복도 문장 수도 수십 분의 일로 줄어든다.
   *
   * 한 문장에 20행(=100개 바인딩). D1의 바인딩 한도를 넉넉히 밑도는 값이다.
   */
  const ROWS_PER_STATEMENT = 20;
  const STATEMENTS_PER_BATCH = 10;

  const statements: D1Statement[] = [];
  for (let i = 0; i < points.length; i += ROWS_PER_STATEMENT) {
    const chunk = points.slice(i, i + ROWS_PER_STATEMENT);
    const values = chunk.map(() => "(?, ?, ?, ?, ?)").join(", ");
    const params = chunk.flatMap((p) => [
      seriesKey,
      toStoredDate(p.date),
      p.value,
      source,
      now,
    ]);
    statements.push(
      db
        .prepare(
          `INSERT INTO MacroPoint (seriesKey, date, value, source, updatedAt)
           VALUES ${values}
           ON CONFLICT(seriesKey, date) DO UPDATE SET
             value = excluded.value, source = excluded.source, updatedAt = excluded.updatedAt`,
        )
        .bind(...params),
    );
  }

  for (let i = 0; i < statements.length; i += STATEMENTS_PER_BATCH) {
    await db.batch(statements.slice(i, i + STATEMENTS_PER_BATCH));
  }
}

export async function countPoints(seriesKey: string): Promise<number> {
  const row = await queryOne<{ n: number }>(
    `SELECT COUNT(*) AS n FROM MacroPoint WHERE seriesKey = ?`,
    [seriesKey],
  );
  return row?.n ?? 0;
}

/** 지표별 보유 점 수 — 관리자 화면이 "얼마나 쌓였나"를 보여준다. */
export async function countPointsBySeries(): Promise<Map<string, number>> {
  const rows = await queryAll<{ seriesKey: string; n: number }>(
    `SELECT seriesKey, COUNT(*) AS n FROM MacroPoint GROUP BY seriesKey`,
  );
  return new Map(rows.map((r) => [r.seriesKey, r.n]));
}

/** 수동 지표 한 점. 관리자 입력 폼이 부른다. */
export async function saveManualPoint(
  seriesKey: string,
  date: string,
  value: number,
): Promise<void> {
  await upsertPoints(seriesKey, "MANUAL", [{ date, value }]);
}

export async function deletePoint(seriesKey: string, date: string): Promise<void> {
  await execute(`DELETE FROM MacroPoint WHERE seriesKey = ? AND date = ?`, [
    seriesKey,
    toStoredDate(date),
  ]);
}

// ────────────── 수집 이력 ──────────────

export type IngestDetail = {
  key: string;
  ok: boolean;
  added?: number;
  total?: number;
  latest?: string;
  error?: string;
};

export type IngestRun = {
  id: string;
  startedAt: string;
  finishedAt?: string;
  trigger: string;
  okCount: number;
  failCount: number;
  addedPoints: number;
  detail: IngestDetail[];
};

export async function startIngest(trigger: string): Promise<string> {
  const id = `ing_${new Date().toISOString()}_${Math.floor(performance.now())}`;
  await execute(`INSERT INTO MacroIngest (id, startedAt, trigger) VALUES (?, ?, ?)`, [
    id,
    new Date().toISOString(),
    trigger,
  ]);
  return id;
}

export async function finishIngest(
  id: string,
  result: { okCount: number; failCount: number; addedPoints: number; detail: IngestDetail[] },
): Promise<void> {
  await execute(
    `UPDATE MacroIngest SET finishedAt = ?, okCount = ?, failCount = ?, addedPoints = ?, detail = ?
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

export async function loadIngestRuns(limit = 10): Promise<IngestRun[]> {
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
       FROM MacroIngest ORDER BY startedAt DESC LIMIT ?`,
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

/** 이력의 detail이 깨져 있어도 화면이 죽지 않게 한다. 다만 조용히 넘어가지는 않는다. */
function parseDetail(raw: string | null): IngestDetail[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as IngestDetail[]) : [];
  } catch (error) {
    console.error("[macro] 수집 이력 detail 파싱 실패", error);
    return [];
  }
}

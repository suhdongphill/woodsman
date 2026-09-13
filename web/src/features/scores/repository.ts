/**
 * 점수의 DB 접근 — 입력 원값 읽기 · 계산 결과 저장.
 *
 * ⚠ 입력은 화면과 같은 `MacroPoint`(L2)를 읽는다. 오늘 평가일의 LIVE 점수에는 그게 곧 「오늘 알려진 값」이다.
 * ⚠ 과거 평가일(RECOMPUTED)도 같은 L2를 읽는다 — 그래서 RECOMPUTED라고 표시한다(`lib/scores/store.ts`).
 *   L1 빈티지(`valuesAsOf`)로 과거 시점을 되살리는 계산은 백테스트 조각에서 붙인다.
 */
import { getD1, queryAll, type D1Statement } from "@/lib/d1";
import type { SeriesPoint } from "@/lib/macro/series";
import type { ScoreRow } from "@/lib/scores/store";

/** 점수 입력 계열을 `since`(YYYY-MM-DD) 이후만 읽는다. 오름차순. */
export async function loadScoreRaw(seriesKeys: string[], since: string): Promise<Map<string, SeriesPoint[]>> {
  const out = new Map<string, SeriesPoint[]>();
  if (seriesKeys.length === 0) return out;
  const placeholders = seriesKeys.map(() => "?").join(", ");
  // ⚠ 저장 형식은 정오 UTC ISO(`2026-09-10T12:00:00.000Z`)다. 날짜 문자열과의 비교는 사전순으로 맞다.
  const rows = await queryAll<{ seriesKey: string; date: string; value: number }>(
    `SELECT seriesKey, date, value FROM MacroPoint
      WHERE seriesKey IN (${placeholders}) AND date >= ?
      ORDER BY seriesKey ASC, date ASC`,
    [...seriesKeys, since],
  );
  for (const r of rows) {
    const list = out.get(r.seriesKey) ?? [];
    list.push({ date: String(r.date).slice(0, 10), value: r.value });
    out.set(r.seriesKey, list);
  }
  return out;
}

/**
 * 계산 결과를 쌓는다(같은 점수·평가일·모델판이면 갱신).
 * ⚠ **LIVE 행은 RECOMPUTED가 덮지 않는다** — 그날 알려진 값으로 낸 점수가, 나중의 수정치로 조용히 바뀌면 안 된다.
 */
export async function saveScoreRows(rows: ScoreRow[]): Promise<void> {
  if (rows.length === 0) return;
  const db = await getD1();
  const now = new Date().toISOString();
  const ROWS_PER_STATEMENT = 5;
  const statements: D1Statement[] = [];
  for (let i = 0; i < rows.length; i += ROWS_PER_STATEMENT) {
    const chunk = rows.slice(i, i + ROWS_PER_STATEMENT);
    const values = chunk.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
    const params = chunk.flatMap((r) => [r.scoreKey, r.asOf, r.modelVersion, r.basis, r.value, r.coverage, r.state, r.detail, now]);
    statements.push(
      db
        .prepare(
          `INSERT INTO ScoreValue (scoreKey, asOf, modelVersion, basis, value, coverage, state, detail, computedAt)
           VALUES ${values}
           ON CONFLICT(scoreKey, asOf, modelVersion) DO UPDATE SET
             basis = excluded.basis, value = excluded.value, coverage = excluded.coverage,
             state = excluded.state, detail = excluded.detail, computedAt = excluded.computedAt
           WHERE ScoreValue.basis <> 'LIVE' OR excluded.basis = 'LIVE'`,
        )
        .bind(...params),
    );
  }
  await db.batch(statements);
}

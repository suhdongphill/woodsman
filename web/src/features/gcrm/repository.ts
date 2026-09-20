/**
 * GCRM의 DB 접근 — 입력 계열 읽기 · 계산 결과 저장 · 저장값 읽기.
 *
 * ⚠ **계산은 여기 없다.** 계산은 `lib/gcrm/pipeline.ts`(순수 함수)가 한다.
 * `regime verify`가 **같은 함수로 다시 계산해** 저장값과 대조하므로, 계산이 DB 코드와 섞이면
 * 「재계산」이 「다시 읽기」가 되어 재현성 검증이 무의미해진다.
 *
 * ⚠ 입력은 **L2(`MacroPoint`)** 를 읽는다. 오늘 평가일의 `LIVE` 계산에는 그게 곧 「오늘 알려진 값」이다.
 * 과거 평가일을 되살리는 계산(`RECOMPUTED`·백테스트)은 L1(`MacroObservation`)의 `valuesAsOf`를
 * 써야 하고, 그건 P9 조각에서 붙인다 — **지금 L2로 과거를 계산하면 그때는 몰랐던 수정치가 섞인다.**
 */
import { getD1, queryAll, type D1Statement } from "@/lib/d1";
import type { SeriesPoint } from "@/lib/macro/series";
import { buildGcrmSeries, seriesKeysToRead, type MacroRow } from "@/lib/gcrm/series";
import type { PipelineResult } from "@/lib/gcrm/pipeline";
import type { RegimeState } from "@/lib/gcrm/regime";

/**
 * 계열을 `since` 이후만 읽는다. 오름차순.
 *
 * ## ⚠ 읽기만 한다 — 조립은 `lib/gcrm/series.ts`에 있다
 * 파생 지표(`sofr_iorb`·`sofr_dispersion`·`sofr_rvol`·`baa_spread`·재정 비율 둘)는
 * `MacroPoint`에 **저장돼 있지 않고** 읽을 때 합성된다. 그 합성을 이 파일에 두면
 * CLI 계측(`scripts/gcrm.mjs measure`)이 같은 조립을 두 번째로 적게 된다 —
 * 그러면 같은 지표가 사이트 안에서 두 값을 갖는다.
 *
 * ⚠ 2026-09-20(54)에 성분 읽기를 빠뜨려 첫 실계산에서 파생 넷이 통째로 빠졌다.
 *   그중 `baa_spread`는 **CREDIT 채널에서 유일하게 30년 이력을 가진 지표**다.
 *   `seriesKeysToRead()`가 성분까지 키를 넓힌다.
 */
export async function loadGcrmSeries(seriesKeys: string[], since: string): Promise<Map<string, SeriesPoint[]>> {
  if (seriesKeys.length === 0) return new Map();
  const keys = seriesKeysToRead(seriesKeys);
  const placeholders = keys.map(() => "?").join(", ");
  // ⚠ 저장 형식은 정오 UTC ISO다. 날짜 문자열과의 비교는 사전순으로 맞다.
  const rows = await queryAll<MacroRow>(
    `SELECT seriesKey, date, value FROM MacroPoint
      WHERE seriesKey IN (${placeholders}) AND date >= ?
      ORDER BY seriesKey ASC, date ASC`,
    [...keys, since],
  );
  // ⚠ 조립은 여기서 하지 않는다 — `lib/gcrm/series.ts` 한 벌이다(CLI 계측이 같은 함수를 쓴다).
  return buildGcrmSeries(seriesKeys, rows);
}

export type StoredRun = {
  runId: string;
  asOf: string;
  modelVersion: string;
  configHash: string;
  gitSha: string | null;
  basis: string;
  createdAt: string;
};

/** 가장 최근 run. 없으면 `undefined`. */
export async function latestRun(asOf?: string): Promise<StoredRun | undefined> {
  const rows = await queryAll<StoredRun>(
    asOf
      ? `SELECT * FROM GcrmRun WHERE asOf = ? ORDER BY createdAt DESC LIMIT 1`
      : `SELECT * FROM GcrmRun ORDER BY asOf DESC, createdAt DESC LIMIT 1`,
    asOf ? [asOf] : [],
  );
  return rows[0];
}

/** 직전 레짐 상태. ⚠ 없으면 지어내지 않고 `undefined`를 준다 — 부르는 쪽이 초기 상태를 만든다. */
export async function loadRegimeState(beforeAsOf: string): Promise<RegimeState | undefined> {
  const rows = await queryAll<{
    asOf: string;
    regimeCode: string;
    regimeKo: string;
    enteredAt: string;
    dwellDays: number;
    prevRegime: string | null;
    entryReason: string | null;
  }>(
    `SELECT asOf, regimeCode, regimeKo, enteredAt, dwellDays, prevRegime, entryReason
       FROM GcrmRegimeState WHERE asOf < ? ORDER BY asOf DESC LIMIT 1`,
    [beforeAsOf],
  );
  const r = rows[0];
  if (!r) return undefined;
  return {
    code: r.regimeCode as RegimeState["code"],
    nameKo: r.regimeKo,
    enteredAt: r.enteredAt,
    dwellDays: r.dwellDays,
    ...(r.prevRegime ? { prevRegime: r.prevRegime as RegimeState["code"] } : {}),
    entryReason: r.entryReason ? (JSON.parse(r.entryReason) as string[]) : [],
  };
}

/**
 * 방향 판정용 과거 축 점수 — `asOf` 오름차순.
 *
 * ## ⚠ 같은 날 run이 둘이면 **나중 것**을 쓴다
 * 하루 한 번 저장하는 것이 규칙이지만(`lib/cron.ts`의 `CRON_PLAN`), `/api/gcrm/run`을 손으로
 * 다시 부르면 같은 `asOf`에 run이 둘 생긴다. 예전에는 정렬이 `asOf`뿐이라 **둘 중 어느 것이
 * 남는지 정해져 있지 않았다** — 같은 입력에 같은 답이 나온다는 보장이 없었고,
 * 그러면 `regime verify`의 재현성 검증이 무의미해진다.
 * `createdAt` 오름차순을 덧붙여 **나중 run이 앞의 것을 덮게** 한다.
 * ⚠ 「나중 것」을 고른 이유: 손으로 다시 돌렸다면 **고치려고** 돌린 것이다.
 */
export async function loadAxisHistory(
  since: string,
  modelVersion: string,
): Promise<{ asOf: string; tide?: number; wind?: number; wave?: number }[]> {
  const rows = await queryAll<{ asOf: string; axis: string; score: number | null }>(
    `SELECT r.asOf AS asOf, a.axis AS axis, a.score AS score
       FROM GcrmAxisScore a JOIN GcrmRun r ON r.runId = a.runId
      WHERE r.asOf >= ? AND r.modelVersion = ?
      ORDER BY r.asOf ASC, r.createdAt ASC`,
    [since, modelVersion],
  );
  const byDate = new Map<string, { asOf: string; tide?: number; wind?: number; wave?: number }>();
  for (const r of rows) {
    const e = byDate.get(r.asOf) ?? { asOf: r.asOf };
    if (r.score !== null) (e as Record<string, unknown>)[r.axis] = r.score;
    byDate.set(r.asOf, e);
  }
  return [...byDate.values()].sort((a, b) => a.asOf.localeCompare(b.asOf));
}

const D = (v: number | undefined | null) => (v === undefined || v === null ? null : Number(v.toFixed(6)));

/**
 * 계산 결과를 쌓는다.
 *
 * ⚠ 같은 `runId`를 다시 쓰면 지우고 다시 넣는다 — 반쯤 갱신된 run이 남으면
 * `verify`가 무엇과 대조하는지 알 수 없게 된다.
 */
export async function saveRun(
  run: StoredRun,
  result: PipelineResult,
): Promise<{ statements: number }> {
  const db = await getD1();
  const stmts: D1Statement[] = [];
  const P = (sql: string, args: unknown[]) => stmts.push(db.prepare(sql).bind(...args));

  for (const t of [
    "GcrmIndicatorScore",
    "GcrmPillarScore",
    "GcrmAxisScore",
    "GcrmRegimeScore",
    "GcrmSignal",
  ]) {
    P(`DELETE FROM "${t}" WHERE runId = ?`, [run.runId]);
  }
  P(`DELETE FROM "GcrmRun" WHERE runId = ?`, [run.runId]);

  P(
    `INSERT INTO "GcrmRun" (runId, asOf, modelVersion, configHash, gitSha, basis, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [run.runId, run.asOf, run.modelVersion, run.configHash, run.gitSha, run.basis, run.createdAt],
  );

  for (const i of result.indicators) {
    P(
      `INSERT INTO "GcrmIndicatorScore"
         (runId, indicator, axis, rawValue, pctRank, score, staleness, evidence, baseWeight, effWeight, status, obsCount, obsDate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        run.runId,
        i.indicator,
        i.axis,
        null,
        D(i.pctRank),
        D(i.score),
        i.staleness ?? 0,
        i.evidence,
        0,
        0,
        i.status,
        i.obsCount ?? null,
        i.obsDate ?? null,
      ],
    );
  }

  for (const p of result.pillars) {
    P(
      `INSERT INTO "GcrmPillarScore"
         (runId, pillar, axis, scoreRaw, scoreOri, coverage, confidence, nUsed, nTotal, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [run.runId, p.pillar, p.axis, D(p.scoreRaw), D(p.scoreOri), D(p.coverage) ?? 0, 0, p.nUsed, p.nTotal, p.status],
    );
  }

  for (const axis of ["tide", "wind", "wave"] as const) {
    const a = result.axes[axis];
    P(
      `INSERT INTO "GcrmAxisScore" (runId, axis, score, direction, coverage, confidence, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [run.runId, axis, D(a.score), result.directions[axis] ?? null, D(a.coverage), D(result.confidence[axis].value), a.status],
    );
  }

  P(
    `INSERT INTO "GcrmRegimeScore" (runId, overall, rte, alignment, proximity, dirAgreement, alignmentState, acuteWatch)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      run.runId,
      D(result.overall),
      D(result.rte),
      D(result.alignment?.alignment),
      D(result.alignment?.proximity),
      D(result.alignment?.dirAgreement),
      result.alignmentState.state,
      result.acute.watch ? 1 : 0,
    ],
  );

  const s = result.regime.state;
  P(
    `INSERT OR REPLACE INTO "GcrmRegimeState"
       (asOf, regimeCode, regimeKo, enteredAt, dwellDays, prevRegime, entryReason, runId)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [run.asOf, s.code, s.nameKo, s.enteredAt, s.dwellDays, s.prevRegime ?? null, JSON.stringify(s.entryReason), run.runId],
  );

  // ⚠ D1은 한 배치에 넣을 수 있는 문장 수에 한계가 있다. 나눠 보낸다.
  const BATCH = 40;
  for (let i = 0; i < stmts.length; i += BATCH) await db.batch(stmts.slice(i, i + BATCH));
  return { statements: stmts.length };
}

export type StoredAxis = { axis: string; score: number | null; direction: string | null; coverage: number | null; confidence: number | null; status: string };
export type StoredPillar = { pillar: string; axis: string; scoreRaw: number | null; scoreOri: number | null; coverage: number; nUsed: number; nTotal: number; status: string };
export type StoredRegimeScore = { overall: number | null; rte: number | null; alignment: number | null; proximity: number | null; dirAgreement: number | null; alignmentState: string | null; acuteWatch: number };

/** 저장된 run 한 벌 — `verify`가 대조하는 대상. */
export async function loadRunResult(runId: string) {
  const [axes, pillars, regime] = await Promise.all([
    queryAll<StoredAxis>(`SELECT axis, score, direction, coverage, confidence, status FROM GcrmAxisScore WHERE runId = ? ORDER BY axis`, [runId]),
    queryAll<StoredPillar>(`SELECT pillar, axis, scoreRaw, scoreOri, coverage, nUsed, nTotal, status FROM GcrmPillarScore WHERE runId = ? ORDER BY pillar, axis`, [runId]),
    queryAll<StoredRegimeScore>(`SELECT overall, rte, alignment, proximity, dirAgreement, alignmentState, acuteWatch FROM GcrmRegimeScore WHERE runId = ?`, [runId]),
  ]);
  return { axes, pillars, regime: regime[0] };
}

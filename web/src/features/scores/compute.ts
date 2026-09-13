/**
 * 점수를 계산해 저장한다 — **수집이 끝날 때마다** 부른다(`features/macro/ingest.ts`).
 *
 * ⭐ 관리자 「산출」 버튼이 따로 없다. 자동 수집(매일 06:00 KST)이든 관리자 「자료 가져오기」든, 값이 들어오면 점수가 따라온다.
 *   버튼을 누르는 사람에 따라 점수가 갈리거나, 누르는 걸 잊어 점수가 묵는 일을 만들지 않는다.
 * ⭐ LLM은 여기 없다 — 숫자와 규칙만(점수 계산 명세 v1.0 머리말).
 */
import { COMPUTED_SCORES, computeScore, type ScoreResult } from "@/lib/scores/engine";
import { buildScoreSeries, historyStart, scoreSeriesKeys } from "@/lib/scores/series-input";
import { evaluationDates, toScoreRow, type ScoreRow } from "@/lib/scores/store";
import type { ScoreKey } from "@/lib/scores/config";
import { loadScoreRaw, saveScoreRows } from "./repository";

export type ScoreComputeSummary = {
  asOf: string;
  saved: number;
  /** 오늘 평가일의 점수별 상태 — 수집 결과에 같이 싣는다 */
  today: { scoreKey: ScoreKey; state: string; coverage: number; value: number | null }[];
  elapsedMs: number;
};

export async function computeAndSaveScores(today: string): Promise<ScoreComputeSummary> {
  const started = Date.now();
  const dates = evaluationDates(today);
  const raw = await loadScoreRaw(scoreSeriesKeys(), historyStart(dates[dates.length - 1].asOf));
  const series = buildScoreSeries(raw);

  const rows: ScoreRow[] = [];
  const todayResults: ScoreResult[] = [];
  for (const { asOf, basis } of dates) {
    // ⚠ 캐시는 평가일마다 새로 — 하위 점수는 같은 평가일의 것만 부모에 들어간다.
    const cache = new Map<ScoreKey, ScoreResult>();
    for (const key of COMPUTED_SCORES) {
      const result = computeScore(key, series, asOf, cache);
      rows.push(toScoreRow(result, basis));
      if (basis === "LIVE") todayResults.push(result);
    }
  }
  await saveScoreRows(rows);

  return {
    asOf: today,
    saved: rows.length,
    today: todayResults.map((r) => ({ scoreKey: r.scoreKey, state: r.state, coverage: r.coverage, value: r.score ?? null })),
    elapsedMs: Date.now() - started,
  };
}

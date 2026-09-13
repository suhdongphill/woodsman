/**
 * 그날의 분석의 DB 접근(통합 계획 S4).
 *
 * ⚠ 본문 저장 경로는 **글과 같다**(CLAUDE.md §6): 원본(`body`) → `markdownToHtml` → `sanitizeHtml` → `bodyHtml`.
 *   `bodyHtml`에 직접 쓰는 경로를 만들지 않는다 — 정화를 건너뛴 HTML이 홈 팝업에 꽂힌다.
 * ⚠ 점검(산식 없는 점수 · Confidence)은 저장 전에 액션이 한다(`features/analysis/actions.ts`). 여기는 받은 것을 저장만 한다.
 */
import { execute, queryAll, queryOne } from "@/lib/d1";
import { markdownToHtml } from "@/lib/markdown";
import { sanitizeHtml } from "@/lib/sanitize-html";

export type DailyAnalysisRow = {
  date: string;
  oneLine: string;
  bodyHtml: string;
  sourceLabel: string;
  updatedAt: string;
};

/** 날짜 하나에 분석 하나 — 같은 날 다시 저장하면 고친다. */
export async function saveDailyAnalysis(input: { date: string; oneLine: string; body: string; sourceLabel: string }): Promise<void> {
  const bodyHtml = sanitizeHtml(markdownToHtml(input.body));
  const now = new Date().toISOString();
  await execute(
    `INSERT INTO DailyAnalysis (date, oneLine, body, bodyHtml, sourceLabel, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET
       oneLine = excluded.oneLine, body = excluded.body, bodyHtml = excluded.bodyHtml,
       sourceLabel = excluded.sourceLabel, updatedAt = excluded.updatedAt`,
    [input.date, input.oneLine, input.body, bodyHtml, input.sourceLabel, now, now],
  );
}

export async function loadRecentAnalyses(limit: number): Promise<DailyAnalysisRow[]> {
  return queryAll<DailyAnalysisRow>(
    `SELECT date, oneLine, bodyHtml, sourceLabel, updatedAt FROM DailyAnalysis ORDER BY date DESC LIMIT ?`,
    [limit],
  );
}

/** 홈 팝업 — 가장 최근 분석 1건(없으면 null). ⚠ 날짜는 화면이 함께 적는다 — 묵은 분석을 오늘 것처럼 보이지 않게. */
export async function loadLatestAnalysis(): Promise<DailyAnalysisRow | null> {
  return queryOne<DailyAnalysisRow>(
    `SELECT date, oneLine, bodyHtml, sourceLabel, updatedAt FROM DailyAnalysis ORDER BY date DESC LIMIT 1`,
  );
}

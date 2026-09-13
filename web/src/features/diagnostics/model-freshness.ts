/**
 * 모델 최신성 — 판정(`lib/model-freshness.ts`)에 넣을 값을 모은다. 관리자 대시보드가 부른다.
 *
 * ⚠ 자동 수집 기록은 **최근 이력 목록에서 찾지 않는다** — 수동을 여러 번 누르면 자동 기록이 목록 밖으로 밀려
 *   「자동 실행 기록이 없다」로 잘못 뜬다. `trigger='CRON'`만 따로 한 줄 읽는다.
 * ⚠ 한 가지를 못 읽어도 나머지 줄은 낸다 — 다만 못 읽은 줄은 「없음」이 아니라 **읽기 실패**로 로그에 남긴다(CLAUDE.md 3장).
 */
import { queryOne } from "@/lib/d1";
import { CRON_PLAN } from "@/lib/cron";
import { seoulDay } from "@/lib/kst";
import { ALL_BUBBLE_INDICATORS, BUBBLE_TRIGGERS } from "@/lib/bubble/catalog";
import { judgeModelFreshness, type ModelFreshnessRow } from "@/lib/model-freshness";
import { loadIngestRuns, loadSeriesMeta } from "@/features/macro/repository";
import { loadReadings, loadTriggerStates } from "@/features/bubble/repository";

const RATES_INPUTS = [
  { key: "zq_front", label: "금리 방향 입력 · 연방기금 선물" },
  { key: "dff", label: "금리 방향 입력 · 일간 실효금리" },
];

export async function loadModelFreshness(now = new Date()): Promise<ModelFreshnessRow[]> {
  const [lastCron, runs, score, meta, readings, triggers] = await Promise.all([
    queryOne<{ startedAt: string }>(`SELECT startedAt FROM MacroIngest WHERE trigger = 'CRON' ORDER BY startedAt DESC LIMIT 1`),
    loadIngestRuns(1),
    queryOne<{ at: string | null }>(`SELECT MAX(computedAt) AS at FROM ScoreValue`),
    loadSeriesMeta(),
    loadReadings(),
    loadTriggerStates(),
  ]);
  const last = runs[0];

  return judgeModelFreshness({
    now,
    todayKst: seoulDay(now.toISOString()),
    plan: CRON_PLAN,
    lastCronStartedAt: lastCron?.startedAt,
    lastRun: last ? { startedAt: last.startedAt, finishedAt: last.finishedAt, failCount: last.failCount, trigger: last.trigger } : undefined,
    lastScoreComputedAt: score?.at ?? undefined,
    ratesInputs: RATES_INPUTS.map((r) => ({ ...r, asOf: meta.get(r.key)?.asOf })),
    bubbleReadingDates: [...readings.values()].map((r) => r.asOf),
    bubbleTotal: ALL_BUBBLE_INDICATORS.length,
    triggerDates: [...triggers.values()].map((t) => t.asOf),
    triggerTotal: BUBBLE_TRIGGERS.length,
  });
}

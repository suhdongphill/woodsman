/**
 * 모델의 최신성 — 「이 숫자가 언제 것인가, 자동은 제때 돌았나」를 판정하는 순수 모듈.
 *
 * ## 왜 있나 (운영자 요청 2026-09-14)
 * 「대시보드에 모델의 최신성을 체크할 수 있도록 · 자동이 돌지 않았으면 수동을 돌 수 있게 · 시간이 지났다는 것을 알도록」.
 * ⚠ 이 프로젝트가 가장 크게 데인 것은 **조용한 실패**다 — 스케줄을 만들어 두고 시크릿이 없어 **나흘간 한 번도 안 돌았는데**
 *   화면 어디에서도 몰랐다(2026-09-01). 홈 앞줄 판정이 늘수록 그 사고의 값이 커진다.
 *
 * ## ⚠ 지키는 것
 * - **없음(missing)과 늦음(late)을 다른 상태로** 낸다 — 한 번도 안 돈 것과 어제 안 돈 것은 할 일이 다르다.
 * - **정상일 때도 줄을 낸다** — 늦을 때만 뜨는 경고는, 경고 자체가 고장 났을 때 아무도 모른다.
 * - 문턱은 **초안**이다(`docs/설계_홈_섹션계획.md` §4). 바꾸면 이유를 CHANGELOG에.
 * - 시각은 ISO(UTC)로 받고, 날짜만 있는 관측일은 `YYYY-MM-DD`로 받는다. 표시(KST)는 화면이 한다.
 */
import type { CronPlanEntry } from "./cron";

export type FreshnessState = "ok" | "late" | "missing";
export type FreshnessAction = "ingest" | "macro" | "bubble" | null;

export type ModelFreshnessRow = {
  key: string;
  label: string;
  /** 마지막 갱신(ISO 시각 또는 YYYY-MM-DD) */
  lastAt?: string;
  state: FreshnessState;
  /** 사람이 읽는 판정 이유 — 화면이 그대로 쓴다 */
  reason: string;
  /** 늦거나 없을 때 할 일 */
  action: FreshnessAction;
};

/** ⚠ 초안 문턱 — 설계서 §4 */
export const FRESHNESS_RULES = {
  /** 예정 시각이 지나고 이만큼 기다린 뒤에도 자동 실행이 없으면 늦음 */
  cronGraceHours: 2,
  /** 점수 계산이 이보다 오래되면 늦음 */
  scoreMaxHours: 26,
  /** 금리 방향 입력(일간 계열) — 관측일이 이 영업일 수보다 묵으면 늦음 */
  ratesMaxBusinessDays: 3,
  /** 버블 채점(분기) — 가장 오래된 판정이 이 일수를 넘으면 늦음 */
  bubbleReadingMaxDays: 100,
  /** 버블 판정 중 「묵었다」고 세는 일수 */
  bubbleReadingStaleDays: 90,
  /** 하드 트리거 상태 — 이 일수를 넘으면 늦음 */
  triggerMaxDays: 14,
} as const;

const HOUR = 3_600_000;
const DAY = 86_400_000;

function parseAt(at: string): number {
  return /^\d{4}-\d{2}-\d{2}$/.test(at) ? Date.parse(`${at}T12:00:00Z`) : Date.parse(at);
}

/** 「N분 전 · N시간 전 · N일 전」. ⚠ 미래 시각이면 「방금」으로 뭉개지 않고 그대로 알린다. */
export function elapsedText(at: string, now: Date): string {
  const ms = now.getTime() - parseAt(at);
  if (!Number.isFinite(ms)) return "시각을 읽지 못함";
  if (ms < 0) return "미래 시각(시계 확인 필요)";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(ms / HOUR);
  if (hours < 48) return `${hours}시간 전`;
  return `${Math.floor(ms / DAY)}일 전`;
}

/**
 * `now` 이전(같거나 이른) **가장 최근 예정 시각**. `분 시 * * *`와 `분 시 * * MON-FRI`만 — 그 밖은 null(지어내지 않는다).
 */
export function previousScheduledRun(expr: string, now: Date): Date | null {
  const m = /^(\d{1,2}) (\d{1,2}) \* \* (\*|MON-FRI)$/.exec(expr.trim());
  if (!m) return null;
  const minute = Number(m[1]);
  const hour = Number(m[2]);
  if (minute > 59 || hour > 23) return null;
  const weekdaysOnly = m[3] === "MON-FRI";
  const at = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, minute));
  if (at.getTime() > now.getTime()) at.setUTCDate(at.getUTCDate() - 1);
  while (weekdaysOnly && (at.getUTCDay() === 0 || at.getUTCDay() === 6)) at.setUTCDate(at.getUTCDate() - 1);
  return at;
}

/** 거시 수집(`macro`)을 포함한 일정들 중 가장 최근 예정 시각 */
export function lastExpectedMacroRun(plan: readonly CronPlanEntry[], now: Date): Date | null {
  let best: Date | null = null;
  for (const p of plan) {
    if (!p.jobs.includes("macro")) continue;
    const at = previousScheduledRun(p.expr, now);
    if (at && (!best || at > best)) best = at;
  }
  return best;
}

/** `asOf`(YYYY-MM-DD) 다음 날부터 `today`까지의 평일 수 */
export function businessDaysSince(asOf: string, today: string): number {
  let n = 0;
  const d = new Date(`${asOf}T00:00:00Z`);
  const end = Date.parse(`${today}T00:00:00Z`);
  for (d.setUTCDate(d.getUTCDate() + 1); d.getTime() <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) n++;
  }
  return n;
}

export type ModelFreshnessInput = {
  now: Date;
  /** KST 오늘(YYYY-MM-DD) — 관측일 비교용 */
  todayKst: string;
  plan: readonly CronPlanEntry[];
  /** `trigger=CRON`인 마지막 수집의 시작 시각 */
  lastCronStartedAt?: string;
  /** 종류와 무관한 마지막 수집 */
  lastRun?: { startedAt: string; finishedAt?: string; failCount: number; trigger: string };
  /** `ScoreValue` 마지막 계산 시각 */
  lastScoreComputedAt?: string;
  /** 금리 방향 입력의 최신 관측일 */
  ratesInputs: { key: string; label: string; asOf?: string }[];
  /** 버블 판정의 기준일(판정이 없으면 목록에 없다) */
  bubbleReadingDates: (string | undefined)[];
  bubbleTotal: number;
  triggerDates: (string | undefined)[];
  triggerTotal: number;
};

export function judgeModelFreshness(input: ModelFreshnessInput): ModelFreshnessRow[] {
  const { now } = input;
  const rows: ModelFreshnessRow[] = [];
  const ageMs = (at: string) => now.getTime() - parseAt(at);

  // 1. 자동 수집
  const expected = lastExpectedMacroRun(input.plan, now);
  if (!input.lastCronStartedAt) {
    rows.push({ key: "cron", label: "거시 자동 수집", state: "missing", reason: "자동 실행 기록이 한 번도 없다 — 시크릿(CRON_SECRET)과 일정을 확인한다", action: "ingest" });
  } else if (
    expected &&
    parseAt(input.lastCronStartedAt) < expected.getTime() &&
    now.getTime() - expected.getTime() > FRESHNESS_RULES.cronGraceHours * HOUR
  ) {
    rows.push({
      key: "cron",
      label: "거시 자동 수집",
      lastAt: input.lastCronStartedAt,
      state: "late",
      reason: `예정된 자동 실행(${expected.toISOString()})이 돌지 않았다 — 수동으로 돌린다`,
      action: "ingest",
    });
  } else {
    rows.push({ key: "cron", label: "거시 자동 수집", lastAt: input.lastCronStartedAt, state: "ok", reason: "예정대로 돌았다", action: null });
  }

  // 2. 마지막 수집 결과
  const run = input.lastRun;
  if (!run) {
    rows.push({ key: "ingest", label: "마지막 수집 결과", state: "missing", reason: "수집 기록이 없다", action: "ingest" });
  } else if (!run.finishedAt) {
    rows.push({ key: "ingest", label: "마지막 수집 결과", lastAt: run.startedAt, state: "late", reason: "끝나지 않은 수집이 있다(중간에 죽었을 수 있다)", action: "macro" });
  } else if (run.failCount > 0) {
    rows.push({ key: "ingest", label: "마지막 수집 결과", lastAt: run.finishedAt, state: "late", reason: `실패 ${run.failCount}건 — 실패 지표는 옛 값을 달고 있다`, action: "macro" });
  } else {
    rows.push({ key: "ingest", label: "마지막 수집 결과", lastAt: run.finishedAt, state: "ok", reason: `실패 없음(${run.trigger === "CRON" ? "자동" : "수동"})`, action: null });
  }

  // 3. 점수
  const scoreAt = input.lastScoreComputedAt;
  if (!scoreAt) {
    rows.push({ key: "scores", label: "조류 점수", state: "missing", reason: "계산된 점수가 없다 — 수집을 한 번 돌리면 따라 계산된다", action: "ingest" });
  } else if (run?.finishedAt && parseAt(scoreAt) < parseAt(run.finishedAt)) {
    rows.push({ key: "scores", label: "조류 점수", lastAt: scoreAt, state: "late", reason: "마지막 수집 뒤에 점수가 계산되지 않았다(계산 실패 — 로그 확인)", action: "ingest" });
  } else if (ageMs(scoreAt) > FRESHNESS_RULES.scoreMaxHours * HOUR) {
    rows.push({ key: "scores", label: "조류 점수", lastAt: scoreAt, state: "late", reason: `${FRESHNESS_RULES.scoreMaxHours}시간 넘게 새 점수가 없다`, action: "ingest" });
  } else {
    rows.push({ key: "scores", label: "조류 점수", lastAt: scoreAt, state: "ok", reason: "수집 뒤 계산됐다", action: null });
  }

  // 4. 금리 방향 입력
  for (const r of input.ratesInputs) {
    if (!r.asOf) {
      rows.push({ key: `rates:${r.key}`, label: r.label, state: "missing", reason: "값이 없다(수집 전)", action: "ingest" });
      continue;
    }
    const bd = businessDaysSince(r.asOf, input.todayKst);
    rows.push(
      bd > FRESHNESS_RULES.ratesMaxBusinessDays
        ? { key: `rates:${r.key}`, label: r.label, lastAt: r.asOf, state: "late", reason: `관측일이 영업일 ${bd}일 묵었다`, action: "ingest" }
        : { key: `rates:${r.key}`, label: r.label, lastAt: r.asOf, state: "ok", reason: `영업일 ${bd}일 전 관측`, action: null },
    );
  }

  // 5. 버블 채점
  const dated = input.bubbleReadingDates.filter((d): d is string => !!d).sort();
  const unscored = input.bubbleTotal - input.bubbleReadingDates.length;
  const undated = input.bubbleReadingDates.length - dated.length;
  if (dated.length === 0) {
    rows.push({ key: "bubble", label: "AI 버블 채점", state: "missing", reason: "기준일이 있는 판정이 없다", action: "bubble" });
  } else {
    const oldest = dated[0];
    const staleCount = dated.filter((d) => ageMs(d) > FRESHNESS_RULES.bubbleReadingStaleDays * DAY).length;
    const extra = [
      `${FRESHNESS_RULES.bubbleReadingStaleDays}일 넘은 판정 ${staleCount}개`,
      unscored > 0 ? `미채점 ${unscored}개` : "",
      undated > 0 ? `기준일 없는 판정 ${undated}개` : "",
    ].filter(Boolean).join(" · ");
    rows.push(
      ageMs(oldest) > FRESHNESS_RULES.bubbleReadingMaxDays * DAY
        ? { key: "bubble", label: "AI 버블 채점", lastAt: oldest, state: "late", reason: `가장 오래된 판정이 ${FRESHNESS_RULES.bubbleReadingMaxDays}일을 넘었다 · ${extra}`, action: "bubble" }
        : { key: "bubble", label: "AI 버블 채점", lastAt: oldest, state: "ok", reason: `가장 오래된 판정 기준 · ${extra}`, action: null },
    );
  }

  // 6. 하드 트리거
  const tDated = input.triggerDates.filter((d): d is string => !!d).sort();
  if (tDated.length === 0) {
    rows.push({ key: "triggers", label: "AI 버블 하드 트리거", state: "missing", reason: "기준일이 있는 상태가 없다", action: "bubble" });
  } else {
    const oldest = tDated[0];
    const missingCount = input.triggerTotal - tDated.length;
    const tail = missingCount > 0 ? ` · 상태 없는 트리거 ${missingCount}개` : "";
    rows.push(
      ageMs(oldest) > FRESHNESS_RULES.triggerMaxDays * DAY
        ? { key: "triggers", label: "AI 버블 하드 트리거", lastAt: oldest, state: "late", reason: `${FRESHNESS_RULES.triggerMaxDays}일 넘게 갱신되지 않은 상태가 있다${tail}`, action: "bubble" }
        : { key: "triggers", label: "AI 버블 하드 트리거", lastAt: oldest, state: "ok", reason: `가장 오래된 상태 기준${tail}`, action: null },
    );
  }

  return rows;
}

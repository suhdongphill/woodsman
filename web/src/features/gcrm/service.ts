/**
 * GCRM 읽기 서비스 — 라우트가 조립만 하도록 판단을 여기 모은다.
 *
 * ⚠ `explain`과 `verify`는 **재계산**한다. 기여도·제외 사유는 저장하지 않기 때문이다.
 * 저장했다면 그 값이 낡을 수 있고, 무엇보다 **재계산이 되는지가 곧 재현성**이다.
 */
import { GCRM_CONFIG, MODEL_VERSION } from "@/lib/gcrm/config";
import { configHash } from "@/lib/gcrm/config/hash";
import { GCRM_INDICATOR_BY_CODE } from "@/lib/gcrm/config/indicators";
import { GCRM_PILLARS } from "@/lib/gcrm/config/pillars";
import { explainPillar } from "@/lib/gcrm/pipeline";
import { compareRun, type VerifyResult } from "@/lib/gcrm/verify";
import { STATE_LABEL } from "@/lib/gcrm/alignment";
import type { Axis } from "@/lib/gcrm/config/model";
import { computeAndSaveGcrm } from "./compute";
import { latestRun, loadRunResult } from "./repository";
import { queryAll } from "@/lib/d1";

/** 화면·API가 함께 쓰는 「지금」. */
export async function gcrmCurrent(asOf?: string) {
  const run = await latestRun(asOf);
  if (!run) return { ok: false as const, reason: "아직 계산된 run이 없다" };
  const stored = await loadRunResult(run.runId);
  const pillarByCode = new Map(GCRM_PILLARS.map((p) => [p.code, p]));

  return {
    ok: true as const,
    asOf: run.asOf,
    runId: run.runId,
    modelVersion: run.modelVersion,
    configHash: run.configHash,
    gitSha: run.gitSha,
    basis: run.basis,
    axes: stored.axes.map((a) => ({
      axis: a.axis,
      score: a.score,
      direction: a.direction,
      coverage: a.coverage,
      confidence: a.confidence,
      status: a.status,
    })),
    pillars: stored.pillars.map((p) => ({
      pillar: p.pillar,
      nameKo: pillarByCode.get(p.pillar)?.nameKo ?? p.pillar,
      polarity: pillarByCode.get(p.pillar)?.polarity,
      axis: p.axis,
      /** ⚠ 화면이 쓰는 값은 raw다 — 스트레스 기둥은 높을수록 나쁘다 */
      scoreRaw: p.scoreRaw,
      coverage: p.coverage,
      used: `${p.nUsed}/${p.nTotal}`,
      status: p.status,
    })),
    regime: stored.regime
      ? {
          ...stored.regime,
          alignmentStateKo: stored.regime.alignmentState
            ? STATE_LABEL[stored.regime.alignmentState as keyof typeof STATE_LABEL]
            : null,
          acuteWatch: stored.regime.acuteWatch === 1,
        }
      : null,
  };
}

/** 레짐 이력. */
export async function gcrmRegimeHistory(from?: string, to?: string) {
  return queryAll<{
    asOf: string;
    regimeCode: string;
    regimeKo: string;
    enteredAt: string;
    dwellDays: number;
    prevRegime: string | null;
    entryReason: string | null;
  }>(
    `SELECT asOf, regimeCode, regimeKo, enteredAt, dwellDays, prevRegime, entryReason
       FROM GcrmRegimeState
      WHERE asOf >= ? AND asOf <= ?
      ORDER BY asOf ASC`,
    [from ?? "0000-01-01", to ?? "9999-12-31"],
  );
}

/** 축 점수 이력. ⚠ 모델판을 섞지 않는다 — 식이 바뀐 점수끼리 방향을 재면 식의 변화가 조류로 보인다. */
export async function gcrmHistory(from?: string, to?: string) {
  return queryAll<{ asOf: string; axis: string; score: number | null; direction: string | null; status: string }>(
    `SELECT r.asOf AS asOf, a.axis AS axis, a.score AS score, a.direction AS direction, a.status AS status
       FROM GcrmAxisScore a JOIN GcrmRun r ON r.runId = a.runId
      WHERE r.asOf >= ? AND r.asOf <= ? AND r.modelVersion = ?
      ORDER BY r.asOf ASC, a.axis ASC`,
    [from ?? "0000-01-01", to ?? "9999-12-31", MODEL_VERSION],
  );
}

/** 지표 상세 — 저장된 지표 × 축 점수. */
export async function gcrmIndicator(code: string, asOf?: string) {
  const run = await latestRun(asOf);
  if (!run) return { ok: false as const, reason: "아직 계산된 run이 없다" };
  const def = GCRM_INDICATOR_BY_CODE.get(code);
  if (!def) return { ok: false as const, reason: `지표 정의에 없다: ${code}` };

  const rows = await queryAll<{ axis: string; pctRank: number | null; score: number | null; staleness: number; evidence: number; status: string; obsDate: string | null; obsCount: number | null }>(
    `SELECT axis, pctRank, score, staleness, evidence, status, obsDate, obsCount
       FROM GcrmIndicatorScore WHERE runId = ? AND indicator = ? ORDER BY axis`,
    [run.runId, code],
  );
  return {
    ok: true as const,
    asOf: run.asOf,
    code,
    nameKo: def.nameKo,
    series: def.series,
    source: def.source,
    seriesId: def.seriesId ?? null,
    freq: def.freq,
    polarity: def.polarity,
    channels: def.channels,
    /** ⚠ 이력 길이를 함께 준다 — 3년짜리의 99번째 백분위는 3년 중 최악일 뿐이다 */
    historyStart: def.historyStart,
    points: def.points,
    historyNote: def.historyNote ?? null,
    glossary: def.glossary ?? null,
    axes: rows,
  };
}

/**
 * 설명 — 기여도 내림차순 + **제외된 지표와 사유**.
 * ⚠ 무엇이 빠졌는지 보이지 않으면 설명이 아니다.
 */
export async function gcrmExplain(pillar: string, axis: Axis, asOf?: string) {
  const run = await latestRun(asOf);
  if (!run) return { ok: false as const, reason: "아직 계산된 run이 없다" };

  const recomputed = await computeAndSaveGcrm({ asOf: run.asOf, basis: run.basis as "LIVE", dryRun: true });
  const e = explainPillar(recomputed.result, pillar, axis);
  if (!e) return { ok: false as const, reason: `기둥이 없다: ${pillar}` };

  const def = GCRM_PILLARS.find((p) => p.code === pillar)!;
  return {
    ok: true as const,
    asOf: run.asOf,
    runId: run.runId,
    /** ⚠ 지금 설정으로 다시 계산한 값이다. 저장값과 다르면 `verify`가 잡는다 */
    recomputedWith: recomputed.configHash,
    storedConfigHash: run.configHash,
    nameKo: def.nameKo,
    polarity: def.polarity,
    from: def.from,
    ...e,
  };
}

/** ★ 재현성 검증 — 저장값과 재계산값을 대조한다. */
export async function gcrmVerify(asOf?: string): Promise<VerifyResult | { status: "NO_RUN"; detail: string }> {
  const run = await latestRun(asOf);
  if (!run) return { status: "NO_RUN", detail: "아직 계산된 run이 없다" };

  const stored = await loadRunResult(run.runId);
  const recomputed = await computeAndSaveGcrm({ asOf: run.asOf, basis: run.basis as "LIVE", dryRun: true });
  const current = await configHash(GCRM_CONFIG);

  return compareRun(
    {
      runId: run.runId,
      asOf: run.asOf,
      configHash: run.configHash,
      gitSha: run.gitSha,
      axes: stored.axes,
      pillars: stored.pillars,
      regime: stored.regime,
    },
    recomputed.result,
    current,
  );
}

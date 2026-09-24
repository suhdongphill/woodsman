/**
 * GCRM 계산을 실행하고 저장한다.
 *
 * ⚠ **여기에 산식이 없다.** 산식은 `lib/gcrm/pipeline.ts`(순수)에 있고, 이 파일은
 * 「읽고 → 그 함수를 부르고 → 저장」만 한다. `verify`가 같은 함수로 다시 계산해 대조하기 때문이다.
 *
 * ⚠ LLM은 여기 없다. 숫자와 규칙만이다(점수 엔진 v1과 같은 원칙).
 */
import { runPipeline, type PipelineResult } from "@/lib/gcrm/pipeline";
import { clickDateKey } from "@/lib/outbound";
import { enabledIndicators } from "@/lib/gcrm/config/indicators";
import { GCRM_CONFIG, MODEL_VERSION } from "@/lib/gcrm/config";
import { configHash } from "@/lib/gcrm/config/hash";
import { assertValidConfig } from "@/lib/gcrm/config/validate";
import { buildGitSha } from "@/lib/gcrm/build-sha";
import { initialRegimeState } from "@/lib/gcrm/regime";
import type { SignalContext } from "@/lib/gcrm/regime";
import type { RawReading } from "@/lib/gcrm/signals";
import {
  loadGcrmSeries,
  loadRegimeState,
  loadAxisHistory,
  saveRun,
  type StoredRun,
} from "./repository";

/** 방향 판정에 필요한 과거 길이(조류 lag 63영업일 + 여유). */
const HISTORY_DAYS = 200;

/** 계열을 얼마나 거슬러 읽을 것인가. ⚠ `maxWindow`(2500 관측)를 덮을 만큼은 읽어야 한다. */
const SERIES_SINCE = "1990-01-01";

function daysBefore(asOf: string, days: number): string {
  return new Date(Date.parse(`${asOf}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * GCRM의 「오늘」(KST).
 *
 * ⚠ 사이트가 이미 쓰는 **같은 함수**에 얹는다(`clickDateKey`). 「오늘」을 각자 구현하면
 *    화면의 오늘과 점수의 오늘이 갈리고, 그 어긋남은 **자정 전후 몇 시간에만** 나타나서
 *    재현이 어렵다. 한국 사용자 기준이라 UTC로 자르면 밤 9시 이후가 다음 날이 된다.
 */
export function gcrmToday(now: Date = new Date()): string {
  return clickDateKey(now);
}

export type GcrmComputeOptions = {
  asOf: string;
  /** LIVE(그날 알려진 값) · RECOMPUTED(지금 값으로 과거를 다시) */
  basis?: "LIVE" | "RECOMPUTED";
  gitSha?: string | null;
  /**
   * 승격·해제에 쓰는 신호 상태.
   * ⚠ 주지 않으면 **빈 상태**로 둔다 — 지어내지 않는다. 그러면 R5·R6 진입이 막히고,
   *   막힌 이유가 결과에 그대로 남는다.
   */
  signals?: Partial<SignalContext>;
  rawReadings?: RawReading[];
  /** 계산만 하고 저장하지 않는다 */
  dryRun?: boolean;
};

export type GcrmComputeSummary = {
  runId: string;
  asOf: string;
  configHash: string;
  saved: number;
  elapsedMs: number;
  result: PipelineResult;
};

export async function computeAndSaveGcrm(opts: GcrmComputeOptions): Promise<GcrmComputeSummary> {
  const started = Date.now();
  // ⚠ 잘못된 설정으로 계산하지 않는다. 오류가 있으면 던지고 멈춘다.
  assertValidConfig();

  const { asOf, basis = "LIVE" } = opts;
  const hash = await configHash(GCRM_CONFIG);

  const [series, prevState, axisHistory] = await Promise.all([
    loadGcrmSeries(
      enabledIndicators().map((i) => i.series),
      SERIES_SINCE,
    ),
    loadRegimeState(asOf),
    loadAxisHistory(daysBefore(asOf, HISTORY_DAYS), MODEL_VERSION, hash),
  ]);

  const signals: SignalContext = {
    confirmedChannels: [],
    windPersistenceWeeks: 0,
    windImprovingWeeks: 0,
    fundingNormalWeeks: 0,
    tideDeteriorating: false,
    ...opts.signals,
  };

  const result = runPipeline({
    asOf,
    series,
    axisHistory,
    signals,
    rawReadings: opts.rawReadings ?? [],
    prev: prevState ?? initialRegimeState(asOf),
  });

  const run: StoredRun = {
    runId: `${asOf}_${hash}_${basis}`,
    asOf,
    modelVersion: MODEL_VERSION,
    configHash: hash,
    // 주지 않으면 이 워커를 빌드한 커밋이다 — ⚠ 2026-09-24까지는 여기서 null이 저장됐다.
    gitSha: opts.gitSha !== undefined ? opts.gitSha : buildGitSha(),
    basis,
    createdAt: new Date().toISOString(),
  };

  const saved = opts.dryRun ? { statements: 0 } : await saveRun(run, result);

  return {
    runId: run.runId,
    asOf,
    configHash: hash,
    saved: saved.statements,
    elapsedMs: Date.now() - started,
    result,
  };
}

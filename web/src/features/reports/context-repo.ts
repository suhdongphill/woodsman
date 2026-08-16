/**
 * 보고서 컨텍스트 스냅숏의 DB 접근 — SQL은 여기까지만 온다.
 *
 * ⚠ 판정·서식은 `lib/report/context.ts`(순수 모듈)가 한다. 여기서는 옮겨 담기만 한다.
 * ⚠ 보고서 하나에 스냅숏 하나다. 쌓지 않고 **갈아 끼운다** — 이력이 필요해지면
 *    그때 별도 표를 만든다. 지금 쌓아 두면 읽을 화면이 없는 행만 늘어난다.
 * ⚠ 날짜만 있는 값은 **정오(UTC)** 로 저장한다. 자정으로 넣으면 화면에서 하루가 밀린다.
 */
import { execute, queryOne, toBool } from "@/lib/d1";
import type { FunctionType } from "@/lib/types";
import type { ReportContextSnapshot } from "@/lib/report/context";
import type { RecessionLevel } from "@/lib/macro/signal";
import type { FedHikeBias } from "@/lib/macro/fedhike";

function toStoredDate(day: string): string {
  return `${day}T12:00:00.000Z`;
}

function dayOf(v: string | null | undefined): string | undefined {
  return v ? String(v).slice(0, 10) : undefined;
}

type ContextRow = {
  ticker: string;
  capturedAt: string;
  recessionLevel: string | null;
  recessionLabel: string | null;
  recessionLine: string | null;
  recessionAlerts: number | null;
  recessionWatches: number | null;
  recessionUnknowns: number | null;
  recessionTotal: number | null;
  macroAsOf: string | null;
  fedBias: string | null;
  fedBiasLabel: string | null;
  fedHike: number | null;
  fedHold: number | null;
  fedCut: number | null;
  fedAsOf: string | null;
  bubbleScore: number | null;
  bubbleRegime: string | null;
  bubbleStance: string | null;
  bubbleScored: number | null;
  bubbleTotal: number | null;
  bubblePriorityFired: number;
  bubbleFired: string;
  inPortfolio: number;
  functionType: string | null;
  targetWeight: number | null;
  holdingThesis: string | null;
};

const COLUMNS = `ticker, capturedAt, recessionLevel, recessionLabel, recessionLine,
       recessionAlerts, recessionWatches, recessionUnknowns, recessionTotal, macroAsOf,
       fedBias, fedBiasLabel, fedHike, fedHold, fedCut, fedAsOf,
       bubbleScore, bubbleRegime, bubbleStance, bubbleScored, bubbleTotal,
       bubblePriorityFired, bubbleFired,
       inPortfolio, functionType, targetWeight, holdingThesis`;

/** 저장된 문자열을 아는 값으로만 좁힌다. 모르는 값은 미수집으로 본다 — 지어내지 않는다. */
function toLevel(v: string | null): RecessionLevel {
  return v === "calm" || v === "watch" || v === "caution" || v === "danger" ? v : "unknown";
}

function toBias(v: string | null): FedHikeBias | undefined {
  return v === "hawkish" || v === "neutral" || v === "dovish" ? v : undefined;
}

function toFunctionType(v: string | null): FunctionType | undefined {
  return v === "GROWTH" || v === "INCOME" || v === "DEFENSE" ? v : undefined;
}

function toSnapshot(row: ContextRow): ReportContextSnapshot {
  const bias = toBias(row.fedBias);

  return {
    capturedAt: dayOf(row.capturedAt) ?? "",
    macro: {
      level: toLevel(row.recessionLevel),
      label: row.recessionLabel ?? "미수집",
      line: row.recessionLine ?? "",
      alerts: row.recessionAlerts ?? 0,
      watches: row.recessionWatches ?? 0,
      unknowns: row.recessionUnknowns ?? 0,
      total: row.recessionTotal ?? 0,
      asOf: dayOf(row.macroAsOf),
      // ⚠ 편향이 없으면 확률도 통째로 없다. 하나만 살려 두면 "덜 본 것"이 "본 것"이 된다.
      fed:
        bias && row.fedHike != null && row.fedHold != null && row.fedCut != null
          ? {
              bias,
              biasLabel: row.fedBiasLabel ?? "",
              hike: row.fedHike,
              hold: row.fedHold,
              cut: row.fedCut,
              asOf: dayOf(row.fedAsOf),
            }
          : undefined,
    },
    bubble: {
      // ⚠ null은 **미채점**이다. 0으로 바꾸지 않는다 — 0은 "안전"으로 읽힌다.
      score: row.bubbleScore ?? undefined,
      regime: row.bubbleRegime ?? undefined,
      stance: row.bubbleStance ?? undefined,
      scored: row.bubbleScored ?? 0,
      total: row.bubbleTotal ?? 0,
      priorityFired: toBool(row.bubblePriorityFired),
      firedTriggerKeys: row.bubbleFired ? row.bubbleFired.split(",").filter(Boolean) : [],
    },
    holding: {
      inPortfolio: toBool(row.inPortfolio),
      functionType: toFunctionType(row.functionType),
      targetWeight: row.targetWeight ?? undefined,
      thesis: row.holdingThesis ?? undefined,
    },
  };
}

export async function loadContext(ticker: string): Promise<ReportContextSnapshot | null> {
  const row = await queryOne<ContextRow>(
    `SELECT ${COLUMNS} FROM StockReportContext WHERE ticker = ?`,
    [ticker],
  );
  return row ? toSnapshot(row) : null;
}

/** 스냅숏을 갈아 끼운다. ⚠ 쿼리 **1번**으로 끝낸다(무료 등급은 호출당 50개다). */
export async function saveContext(
  ticker: string,
  snapshot: ReportContextSnapshot,
): Promise<void> {
  const { macro, bubble, holding } = snapshot;

  await execute(
    `INSERT INTO StockReportContext (
       ticker, capturedAt,
       recessionLevel, recessionLabel, recessionLine,
       recessionAlerts, recessionWatches, recessionUnknowns, recessionTotal, macroAsOf,
       fedBias, fedBiasLabel, fedHike, fedHold, fedCut, fedAsOf,
       bubbleScore, bubbleRegime, bubbleStance, bubbleScored, bubbleTotal,
       bubblePriorityFired, bubbleFired,
       inPortfolio, functionType, targetWeight, holdingThesis, updatedAt
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(ticker) DO UPDATE SET
       capturedAt = excluded.capturedAt,
       recessionLevel = excluded.recessionLevel,
       recessionLabel = excluded.recessionLabel,
       recessionLine = excluded.recessionLine,
       recessionAlerts = excluded.recessionAlerts,
       recessionWatches = excluded.recessionWatches,
       recessionUnknowns = excluded.recessionUnknowns,
       recessionTotal = excluded.recessionTotal,
       macroAsOf = excluded.macroAsOf,
       fedBias = excluded.fedBias,
       fedBiasLabel = excluded.fedBiasLabel,
       fedHike = excluded.fedHike,
       fedHold = excluded.fedHold,
       fedCut = excluded.fedCut,
       fedAsOf = excluded.fedAsOf,
       bubbleScore = excluded.bubbleScore,
       bubbleRegime = excluded.bubbleRegime,
       bubbleStance = excluded.bubbleStance,
       bubbleScored = excluded.bubbleScored,
       bubbleTotal = excluded.bubbleTotal,
       bubblePriorityFired = excluded.bubblePriorityFired,
       bubbleFired = excluded.bubbleFired,
       inPortfolio = excluded.inPortfolio,
       functionType = excluded.functionType,
       targetWeight = excluded.targetWeight,
       holdingThesis = excluded.holdingThesis,
       updatedAt = excluded.updatedAt`,
    [
      ticker,
      toStoredDate(snapshot.capturedAt),
      macro.level,
      macro.label,
      macro.line,
      macro.alerts,
      macro.watches,
      macro.unknowns,
      macro.total,
      macro.asOf ? toStoredDate(macro.asOf) : null,
      macro.fed?.bias ?? null,
      macro.fed?.biasLabel ?? null,
      macro.fed?.hike ?? null,
      macro.fed?.hold ?? null,
      macro.fed?.cut ?? null,
      macro.fed?.asOf ? toStoredDate(macro.fed.asOf) : null,
      bubble.score ?? null,
      bubble.regime ?? null,
      bubble.stance ?? null,
      bubble.scored,
      bubble.total,
      bubble.priorityFired ? 1 : 0,
      bubble.firedTriggerKeys.join(","),
      holding.inPortfolio ? 1 : 0,
      holding.functionType ?? null,
      holding.targetWeight ?? null,
      holding.thesis ?? null,
      new Date().toISOString(),
    ],
  );
}

/**
 * 홈 「GLOBAL CAPITAL REGIME」 줄을 **GCRM v2**로 채운다 — 순수 함수(2026-09-25 운영자 결정).
 *
 * ## 왜 바꿨나
 * 이 줄은 v1 점수 저장소(`ScoreValue`)를 읽고 있었다. v1에는 위험 전달·금리 흡수력·달러 역설의 **정의가 없어**
 * 세 칸이 9/16부터 「준비 중」으로 떠 있었다. 그런데 매일 06:00 도는 GCRM v2(9/20 운영 배포)는 이 기둥들을 이미 계산한다 —
 * 위험 전이는 발행(OK), 금리 감내력·달러 네트워크는 **자료 부족**(커버리지 40% · 발행선 60%).
 * 운영자가 「v2로 통일」을 골랐다(v1 유지 + 빈칸만 v2 섞기 안 대신).
 *
 * ## ⚠ 이 파일이 지키는 것
 * - **조류(tide, 1~12개월) 축**의 기둥 값을 쓴다 — GCRM 종합 가중이 가장 큰 축(core 0.5, `config/model.ts`).
 * - `INSUFFICIENT`는 0이 아니다. 「자료 부족 · 커버리지 N%」로 **이유를 적는다**(「준비 중」은 이유가 아니다).
 * - 방향은 약 4주 전 run과 비교하되 불감대(`DIRECTION.deadband.tide`) 안이면 보합. 비교할 run이 없으면 「비교 없음」.
 * - 매수·매도 표현 없음 — 상태 서술까지(regime-summary와 같은 규범).
 * - ⚠ 바로 아래 조류 카드(v1)와 숫자가 다를 수 있다 — 운영자가 알고 고른 것이다(다음 조각에서 조류 카드도 v2로 옮긴다).
 */
import { DIRECTION, GATES, MODEL_VERSION } from "@/lib/gcrm/config/model";
import { levelWord, type TideDirection } from "@/lib/scores/tide";
import {
  COLLAPSE_WHEN_UNPUBLISHED_AT_LEAST,
  MIN_PUBLISHED_TO_SHOW,
  type RegimeChip,
  type RegimeFrame,
} from "@/lib/scores/regime-summary";

/** 홈 칩 — 순서가 화면 순서다. 이름은 v2 기둥 이름을 줄인 것(v1의 「위험 전달」·「금리 흡수력」·「달러 역설」 대신). */
export const GCRM_CHIPS = [
  { pillar: "liquidity", label: "유동성" },
  { pillar: "engine_heat", label: "엔진 온도" },
  { pillar: "market_risk", label: "시장위험·지정학" },
  { pillar: "risk_transmission", label: "위험 전이" },
  { pillar: "rate_absorption", label: "금리 감내력" },
  { pillar: "dollar_network", label: "달러 네트워크" },
] as const;

/** 🟡 낮은 신뢰 — v1과 같은 선(커버리지 60~80%, `lib/scores/composite.ts`). 60% 아래는 GCRM이 발행하지 않는다. */
export const LOW_CONFIDENCE_BELOW = 0.8;

export const HOME_AXIS = "tide" as const;

export type GcrmPillarRow = {
  pillar: string;
  axis: string;
  scoreRaw: number | null;
  coverage: number;
  status: string;
};

export type GcrmSnapshot = {
  asOf: string;
  pillars: GcrmPillarRow[];
  /** 정렬 상태 한글(예: 「판정 보류」). 없으면 null */
  regimeLabel: string | null;
};

function pick(s: GcrmSnapshot | undefined, pillar: string): GcrmPillarRow | undefined {
  return s?.pillars.find((p) => p.pillar === pillar && p.axis === HOME_AXIS);
}

function direction(now: number, before: number | null | undefined): TideDirection {
  if (before == null) return "unknown";
  const d = now - before;
  if (Math.abs(d) < DIRECTION.deadband.tide) return "flat";
  return d > 0 ? "up" : "down";
}

/** 은/는 — 마지막 글자에 받침이 있으면 「은」. 한글이 아니면 「은」으로 둔다. */
function eunNeun(word: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  if (code < 0 || code > 11171) return "은";
  return code % 28 === 0 ? "는" : "은";
}

const DIR_WORD: Record<TideDirection, string> = { up: "오르는 쪽", down: "내리는 쪽", flat: "보합", unknown: "" };

export function buildGcrmFrame(current: GcrmSnapshot, earlier?: GcrmSnapshot): RegimeFrame {
  const compare = earlier && earlier.asOf < current.asOf ? earlier : undefined;
  const chips: RegimeChip[] = GCRM_CHIPS.map(({ pillar, label }) => {
    const row = pick(current, pillar);
    const ok = !!row && row.status === "OK" && row.scoreRaw != null && row.coverage >= GATES.pillarMinCoverage;
    const cov = row ? Math.round(row.coverage * 100) : undefined;
    return {
      scoreKey: pillar,
      label,
      value: ok ? (row!.scoreRaw as number) : undefined,
      coverage: ok ? cov : undefined,
      lowConfidence: ok && row!.coverage < LOW_CONFIDENCE_BELOW,
      dir4: ok ? direction(row!.scoreRaw as number, pick(compare, pillar)?.scoreRaw) : "unknown",
      pendingReason: row ? `자료 부족 · 커버리지 ${cov}%` : "아직 계산 전",
    };
  });

  const shown = chips.filter((c) => c.value !== undefined);
  const missing = chips.filter((c) => c.value === undefined);
  const parts = shown.map((c) => {
    const dir = DIR_WORD[c.dir4];
    return `${c.label} ${Math.round(c.value as number)}(${levelWord(c.value as number)}${dir ? ` · 4주 ${dir}` : ""})`;
  });
  const tail = missing.length
    ? ` · ${missing.map((c) => c.label).join("·")}${eunNeun(missing[missing.length - 1].label)} 자료 부족으로 발행하지 않음`
    : "";

  return {
    show: shown.length >= MIN_PUBLISHED_TO_SHOW,
    chips,
    publishedCount: shown.length,
    totalCount: chips.length,
    collapsed: missing.length >= COLLAPSE_WHEN_UNPUBLISHED_AT_LEAST,
    summary: shown.length ? `${parts.join(" · ")}${tail}` : "발행된 점수가 아직 없습니다.",
    asOf: current.asOf,
    regimeLabel: current.regimeLabel ?? undefined,
    modelLabel: `${MODEL_VERSION.replace("_", " ")} · 조류(1~12개월) 축`,
  };
}

/**
 * Global Capital Regime 프레임의 **한 줄 요약과 칩 목록** — 프로그램이 쓴다(LLM 없음).
 *
 * 개발요구서 G1(`docs/개발요구서_GlobalCapitalRegime_2026-09-16.md`).
 *
 * ## ⚠ 이 파일이 지키는 것
 * - **발행되지 않은 점수는 문장에 넣지 않는다.** 「준비 중」이라고만 적는다 —
 *   숫자가 없는 것을 있는 것처럼 쓰면 프레임 전체가 못 믿을 것이 된다.
 * - **매수·매도 표현을 쓰지 않는다.** 여기서 내는 것은 상태 서술까지다(운영자 원칙 ③).
 *   테스트가 권유 단어를 막는다.
 * - **점수를 다시 계산하지 않는다.** 조류 카드가 읽은 것과 **같은 `ScoreValue` 행**을 받아 문장만 만든다 —
 *   따로 읽으면 같은 화면의 두 자리가 다른 숫자를 말하게 된다.
 */
import { levelWord, type TideDirection, type TideReading } from "./tide";
import type { ScoreKey } from "./config";

/** 프레임이 보여 주는 점수와 그 이름. ⚠ 순서가 화면 순서다. */
export const REGIME_CHIP_KEYS = [
  "global_liquidity",
  "engine_heat",
  "market_risk_geopolitical",
  "risk_transmission",
  "rate_absorption",
  "dollar_network",
] as const satisfies readonly ScoreKey[];

export const REGIME_CHIP_LABEL: Record<(typeof REGIME_CHIP_KEYS)[number], string> = {
  global_liquidity: "유동성",
  engine_heat: "엔진 온도",
  market_risk_geopolitical: "시장위험·지정학",
  risk_transmission: "위험 전달",
  rate_absorption: "금리 흡수력",
  dollar_network: "달러 역설",
};

/** 칩 줄을 접는 기준 — 미발행이 이만큼이면 「발행 N개」만 적는다(빈 칸 여섯 개를 늘어놓지 않는다). */
export const COLLAPSE_WHEN_UNPUBLISHED_AT_LEAST = 4;

/** 프레임이 아예 뜨지 않는 기준. ⚠ 자리부터 만들고 점수를 채우지 않는다(운영자 원칙 ②). */
export const MIN_PUBLISHED_TO_SHOW = 2;

export type RegimeChip = {
  scoreKey: string;
  label: string;
  /** 발행된 점수. 미발행이면 undefined */
  value?: number;
  /** 0~100 커버리지. 미발행이면 undefined */
  coverage?: number;
  /** 🟡 낮은 신뢰로 발행 */
  lowConfidence: boolean;
  dir4: TideDirection;
  /** 미발행일 때 적을 이유(예: 「자료 부족 · 커버리지 40%」). 없으면 「준비 중」 */
  pendingReason?: string;
};

export type RegimeFrame = {
  /** 프레임을 화면에 낼 것인가 */
  show: boolean;
  chips: RegimeChip[];
  publishedCount: number;
  totalCount: number;
  /** 칩 줄을 접을 것인가 */
  collapsed: boolean;
  /** 한 줄 요약. ⚠ 발행 점수만으로 만든다 */
  summary: string;
  /** 점수 기준일(발행된 것 중 가장 늦은 것) */
  asOf?: string;
  /** 레짐 판정 이름(GCRM v2 — 예: 「판정 보류」). 없으면 「판정 준비 중」 */
  regimeLabel?: string;
  /** 모델 표기. 없으면 v1 `MODEL_VERSION` */
  modelLabel?: string;
};

function published(reading: TideReading | undefined): boolean {
  const latest = reading?.latest;
  return !!latest && latest.value !== null && latest.state !== "DO_NOT_PUBLISH";
}

/** 방향을 말로. ⚠ 「비교할 과거 점수가 없다」와 「변화가 없다」를 같게 적지 않는다. */
function directionWord(dir: TideDirection): string {
  if (dir === "up") return "오르는 쪽";
  if (dir === "down") return "내리는 쪽";
  if (dir === "flat") return "보합";
  return "";
}

export function buildRegimeFrame(readings: Map<string, TideReading | undefined>): RegimeFrame {
  const chips: RegimeChip[] = REGIME_CHIP_KEYS.map((key) => {
    const reading = readings.get(key);
    const ok = published(reading);
    const latest = reading?.latest;
    return {
      scoreKey: key,
      label: REGIME_CHIP_LABEL[key],
      value: ok && latest?.value !== null ? latest?.value : undefined,
      coverage: ok ? latest?.coverage : undefined,
      lowConfidence: ok && latest?.state === "LOW_CONFIDENCE",
      dir4: reading?.dir4 ?? "unknown",
    };
  });

  const publishedChips = chips.filter((c) => c.value !== undefined);
  const unpublished = chips.length - publishedChips.length;

  /**
   * 기준일은 **발행된 점수**의 것만 본다 — 미발행 행의 날짜를 적으면
   * 화면이 「그날 계산된 값」처럼 보이는데 그 자리에는 숫자가 없다.
   */
  const asOf = publishedChips
    .map((c) => readings.get(c.scoreKey)?.latest?.asOf)
    .filter((d): d is string => !!d)
    .sort()
    .reverse()[0];

  return {
    show: publishedChips.length >= MIN_PUBLISHED_TO_SHOW,
    chips,
    publishedCount: publishedChips.length,
    totalCount: chips.length,
    collapsed: unpublished >= COLLAPSE_WHEN_UNPUBLISHED_AT_LEAST,
    summary: summarize(chips, readings),
    asOf,
  };
}

/**
 * 한 줄 요약.
 *
 * 「{점수 이름} {값}({수준 말}{, 방향}) · … — {맺음}」
 * ⚠ 맺음은 **상태 서술**이다. 「어떻게 하라」로 넘어가지 않는다.
 */
function summarize(chips: RegimeChip[], readings: Map<string, TideReading | undefined>): string {
  const shown = chips.filter((c) => c.value !== undefined);
  if (shown.length === 0) return "발행된 점수가 아직 없습니다 — 첫 점수는 다음 수집 뒤에 생깁니다.";

  const parts = shown.map((c) => {
    const level = levelWord(c.value as number);
    const dir = directionWord(readings.get(c.scoreKey)?.dir4 ?? "unknown");
    const tail = dir ? `${level} · 4주 ${dir}` : level;
    return `${c.label} ${Math.round(c.value as number)}(${tail})`;
  });

  const missing = chips.filter((c) => c.value === undefined).map((c) => c.label);
  const tail = missing.length > 0 ? ` · ${missing.join("·")}은 준비 중` : "";
  return `${parts.join(" · ")}${tail}`;
}

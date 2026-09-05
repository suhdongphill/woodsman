/**
 * 금리 섹션이 읽는 `rates.json`의 형태와 표시 규칙 — **순수 모듈.**
 *
 * ## 이 파일이 지키는 것
 * - ⚠ **결측(null)은 0이 아니다.** 값이 없으면 「미발표」로 적고, 선은 그 구간에서 **끊는다.**
 *   이어 그리면 없는 관측이 있는 것처럼 보인다(명세 §0-1 · §5).
 * - ⚠ **파생 지표는 입력을 되짚을 수 있어야 한다.** 화면이 `inputs`를 그대로 보여줄 수 있게
 *   타입에 남긴다 — 근거를 못 보여주는 숫자는 이 사이트가 내보내지 않는다.
 * - ⚠ **데이터가 낡았으면 낡았다고 말한다.** `meta.stale`이면 화면 맨 위에서 그 사실부터 말한다.
 *   오래된 값을 최신인 것처럼 보여주는 것이 이 프로젝트가 가장 크게 데인 사고다.
 */

export type RatesObservation = [string, number | null];

export type RatesSeries = {
  name_ko: string;
  unit: string;
  frequency: string;
  layer: string | null;
  definition_ko: string;
  source_url: string;
  last_obs_date: string | null;
  observations: RatesObservation[];
};

export type RatesMetric = {
  value: number | null;
  unit: string;
  band: string | null;
  /** ⚠ 어떤 계열의 어느 관측일·어떤 값을 썼는지. 비면 근거 없는 숫자다. */
  inputs: Record<string, unknown>;
  as_of: string;
};

export type ConflictingSignal = { key: string; value: number; text: string };

export type RatesPayload = {
  meta: {
    asof: string;
    generated_at: string;
    schema_version: number;
    partial: boolean;
    missing_series: string[];
    stale?: boolean;
    stale_since?: string;
  };
  headline: {
    easing_pressure_index: {
      value: number | null;
      band: string | null;
      components: Record<string, number | null>;
      weights_used?: Record<string, number>;
      missing_layers?: string[];
    };
    conflicting_signals: ConflictingSignal[];
  };
  metrics: Record<string, RatesMetric>;
  series: Record<string, RatesSeries>;
  releases: { date: string; indicator: string; period: string; note?: string | null }[];
};

/** 값이 없으면 「—」다. ⚠ 0으로 적으면 미발표가 관측치로 둔갑한다. */
export function formatMetric(value: number | null | undefined, unit: string): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  if (unit === "percent") return `${value.toFixed(2)}%`;
  if (unit === "index" || unit === "percentile") return value.toFixed(1);
  if (unit === "correlation") return value.toFixed(2);
  if (unit === "count") return String(Math.round(value));
  return value.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
}

export const LAYER_LABEL: Record<string, string> = {
  policy: "정책·시장금리",
  inflation: "인플레이션",
  labor: "노동",
  credit: "수요·신용",
  two_speed: "금리 민감 vs 현금 조달",
  liquidity: "유동성",
  krus: "한·미",
};

export const BAND_LABEL: Record<string, string> = {
  easing: "인하 쪽",
  neutral: "중립",
  tightening: "긴축 쪽",
  low_hire_low_fire: "저채용·저해고",
  rate_sensitive: "금리 민감",
  cash_financed: "현금 조달",
};

/**
 * 값이 있는 구간만 이어 그린다.
 *
 * ⚠ **결측에서 선을 끊는 것이 이 함수의 전부다.** 이어 그리면 발표되지 않은 달에 값이
 *   있었던 것처럼 보이고, 그건 화면이 하는 거짓말 중 가장 눈에 안 띄는 종류다.
 */
export function linePath(
  observations: RatesObservation[],
  x: (index: number) => number,
  y: (value: number) => number,
): string {
  const parts: string[] = [];
  let drawing = false;

  observations.forEach(([, value], index) => {
    if (value === null || !Number.isFinite(value)) {
      drawing = false;
      return;
    }
    parts.push(`${drawing ? "L" : "M"}${x(index).toFixed(1)},${y(value).toFixed(1)}`);
    drawing = true;
  });

  return parts.join(" ");
}

/** 축 범위. ⚠ 0을 자르지 않는다 — 자를 때는 화면이 축에 그렇게 적는다(명세 §6). */
export function bounds(
  values: (number | null)[],
  extra: number[] = [],
): { min: number; max: number } {
  const live = [...values.filter((v): v is number => v !== null && Number.isFinite(v)), ...extra];
  if (live.length === 0) return { min: 0, max: 1 };

  let min = Math.min(...live);
  let max = Math.max(...live);
  if (min === max) {
    const pad = Math.abs(min) * 0.05 || 1;
    min -= pad;
    max += pad;
  }
  const margin = (max - min) * 0.12;
  return { min: min - margin, max: max + margin };
}

/** 마지막으로 값이 있는 관측. ⚠ 없으면 null — 가장 가까운 값을 지어내지 않는다. */
export function latestObservation(series: RatesSeries | undefined): RatesObservation | null {
  if (!series) return null;
  for (let i = series.observations.length - 1; i >= 0; i -= 1) {
    const [, value] = series.observations[i];
    if (value !== null && Number.isFinite(value)) return series.observations[i];
  }
  return null;
}

/** 최근 N개월만 잘라 본다(차트가 촘촘해지지 않게). */
export function tail(observations: RatesObservation[], months: number): RatesObservation[] {
  if (observations.length === 0) return [];
  const last = observations[observations.length - 1][0];
  const cutoff = new Date(Date.parse(`${last}T00:00:00Z`));
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months);
  const from = cutoff.toISOString().slice(0, 10);
  return observations.filter(([date]) => date >= from);
}

/**
 * 데이터가 얼마나 묵었나. ⚠ 하루라도 넘으면 화면이 그 사실을 먼저 말한다.
 * (명세 §7 — 실패했을 때 옛 파일을 그대로 서빙하되 최신인 척하지 않는다.)
 */
export function staleness(meta: RatesPayload["meta"], today: string): number {
  return Math.round(
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${meta.asof}T00:00:00Z`)) / 86_400_000,
  );
}

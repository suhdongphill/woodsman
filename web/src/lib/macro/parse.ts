/**
 * 외부 응답 → 시계열 파서. **순수 함수**(네트워크는 features/macro/ingest.ts).
 *
 * 파싱과 호출을 나눈 이유: 응답 형식이 바뀌면 여기가 깨져야 하고, 그건 네트워크 없이
 * 테스트로 잡을 수 있는 종류의 사고다.
 *
 * ⚠ 값이 비어 있는 행(FRED의 `.`)은 **버린다.** 0으로 채우면 휴장일이 폭락으로 보인다.
 */
import type { SeriesPoint } from "./series";

/**
 * FRED CSV.
 *
 *   observation_date,T10Y2Y
 *   2026-07-01,0.31
 *   2026-07-03,.
 */
export function parseFredCsv(text: string): SeriesPoint[] {
  const out: SeriesPoint[] = [];
  const lines = text.split(/\r?\n/);

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const [date, raw] = line.split(",");
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (!raw || raw === "." || raw === "") continue;

    const value = Number(raw);
    if (!Number.isFinite(value)) continue;
    out.push({ date, value });
  }
  return out;
}

type YahooChart = {
  chart?: {
    result?: {
      timestamp?: number[];
      indicators?: { quote?: { close?: (number | null)[] }[] };
    }[];
    error?: unknown;
  };
};

/**
 * Yahoo Finance 차트 응답.
 *
 * ⚠ 휴장일은 close가 null로 온다. 그대로 넣으면 차트에 0으로 꽂힌다.
 */
export function parseYahooChart(json: unknown): SeriesPoint[] {
  const data = json as YahooChart;
  const result = data?.chart?.result?.[0];
  const stamps = result?.timestamp;
  const closes = result?.indicators?.quote?.[0]?.close;
  if (!stamps || !closes) return [];

  const out: SeriesPoint[] = [];
  for (let i = 0; i < stamps.length; i++) {
    const close = closes[i];
    if (close == null || !Number.isFinite(close)) continue;
    const date = new Date(stamps[i] * 1000).toISOString().slice(0, 10);
    out.push({ date, value: close });
  }
  return out;
}

/** 같은 날짜가 두 번 오면 뒤엣것을 남긴다(수정치가 나중에 온다). */
export function dedupeByDate(points: SeriesPoint[]): SeriesPoint[] {
  const byDate = new Map<string, number>();
  for (const p of points) byDate.set(p.date, p.value);
  return [...byDate.entries()]
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

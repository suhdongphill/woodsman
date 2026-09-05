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

/** ECOS 응답에서 오류를 알리는 자리. ⚠ 인증키 오류가 여기로 온다(HTTP는 200이다). */
type EcosResponse = {
  RESULT?: { CODE?: string; MESSAGE?: string };
  StatisticSearch?: { row?: { TIME?: string; DATA_VALUE?: string }[] };
};

/** `202601` · `20260105` · `2026` → `2026-01-01` 꼴로 맞춘다. 형식이 낯설면 버린다. */
function ecosTimeToDate(time: string): string | null {
  if (/^\d{4}$/.test(time)) return `${time}-01-01`;
  if (/^\d{6}$/.test(time)) return `${time.slice(0, 4)}-${time.slice(4, 6)}-01`;
  if (/^\d{8}$/.test(time)) return `${time.slice(0, 4)}-${time.slice(4, 6)}-${time.slice(6, 8)}`;
  return null;
}

/**
 * 한국은행 ECOS 응답.
 *
 * ⚠ **오류도 HTTP 200으로 온다.** 인증키가 틀려도 `{"RESULT":{"CODE":"INFO-100",...}}`가
 *    200으로 돌아온다. 빈 배열로 넘기면 "받을 값이 없었다"와 구분이 안 되므로 **던진다** —
 *    수집 이력(`MacroIngest.detail`)에 한국은행이 준 문장이 그대로 남아야 한다.
 */
export function parseEcosJson(json: unknown): SeriesPoint[] {
  const data = (json ?? {}) as EcosResponse;

  const message = data.RESULT?.MESSAGE;
  if (message) throw new Error(`ECOS ${data.RESULT?.CODE ?? ""} ${message}`.trim());

  const rows = data.StatisticSearch?.row ?? [];
  const out: SeriesPoint[] = [];

  for (const row of rows) {
    const date = ecosTimeToDate(String(row.TIME ?? ""));
    if (!date) continue;

    const value = Number(row.DATA_VALUE);
    // ⚠ 빈 값을 0으로 채우지 않는다. 기준금리 0%는 실제로 있을 법한 값이라 더 위험하다.
    if (row.DATA_VALUE == null || row.DATA_VALUE === "" || !Number.isFinite(value)) continue;

    out.push({ date, value });
  }
  return out;
}

/**
 * 네이버 금융 모바일 통합 API.
 *
 * `totalInfos`가 `{ code, key, value }` 목록으로 온다 — 그중 하나를 골라 숫자만 뽑는다.
 * ⚠ **여기서 파는 것은 「추정PER」**이다(컨센서스 기준 선행 PER). 화면에 "선행"이라고 쓰는
 *    숫자의 출처가 무엇인지 헷갈리지 않게 키 이름을 그대로 지정해서 가져온다.
 * ⚠ 값은 `"4.71배"`·`"1,596,000"`처럼 단위·쉼표가 붙어 온다. 숫자만 남긴다.
 * ⚠ 이 값은 **오늘 시점의 관측**이다. 발표 시계열이 아니라 매일 다시 재는 값이라,
 *    기준일을 호출부가 준다(수집일).
 */
type NaverTotalInfo = { code?: string; key?: string; value?: string };

export function parseNaverTotalInfo(json: unknown, key: string, date: string): SeriesPoint[] {
  const rows = ((json ?? {}) as { totalInfos?: NaverTotalInfo[] }).totalInfos ?? [];
  const hit = rows.find((r) => r.key === key || r.code === key);

  if (!hit) throw new Error(`네이버 응답에 「${key}」 항목이 없습니다`);

  const value = Number(String(hit.value ?? "").replace(/[^0-9.\-]/g, ""));
  // ⚠ 0이나 NaN을 그대로 넣지 않는다. PER 0배는 "모른다"이지 "싸다"가 아니다.
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`네이버 「${key}」 값을 숫자로 읽지 못했습니다`);
  }
  return [{ date, value }];
}

/**
 * DefiLlama 스테이블코인 잔액을 받아 오고 해석한다. 무료·키 없음(2026-09-26 확인).
 *
 * ## 왜 붙였나 (2026-09-26, GCRM 자료 채우기 ③)
 * GCRM 「달러 네트워크 지배력」의 `stablecoin_dollar_network`(가중 0.15). COFER(0.15)만으로는 커버리지 55%라
 * 발행선(60%)에 못 닿는다 — 둘 다 있어야 한다.
 *
 * ⚠ 이 파일은 **D1·워커 전용 모듈을 import 하지 않는다**(`imf.ts`·`treasury-fetch.ts`와 같은 이유).
 *
 * ## `sourceId` 꼴
 * `stablecoins:peggedUSD` — 달러에 고정된 스테이블코인 전체의 유통 잔액(달러 환산). 원값은 **달러**다.
 *
 * ## ⚠ 날짜
 * 응답의 `date`는 유닉스 초(문자열)이고 **UTC 자정**이다(2026-09-26 실측: 3,224점 전부). 자정이 아니면 던진다 —
 * 하루가 밀렸는지 알 수 없게 되기 때문이다. 오늘 점은 하루 중에도 바뀐다 — 수집이 60일을 되감아 다시 쓰므로 다음 날 고쳐진다.
 */
import type { SeriesPoint } from "./series";

const STABLECOIN_ALL_URL = "https://stablecoins.llama.fi/stablecoincharts/all";
const FETCH_TIMEOUT_MS = 20_000;

/** `fetchDefiLlama`가 아는 소스 ID. ⚠ 카탈로그의 DEFILLAMA 지표는 이 중 하나여야 한다(테스트가 대조한다). */
export const DEFILLAMA_SOURCE_IDS = ["stablecoins:peggedUSD"] as const;

type ChartRow = {
  date?: string | number;
  totalCirculatingUSD?: Record<string, number | undefined>;
};

/**
 * 전체 차트 응답 → `peg` 하나의 달러 환산 잔액.
 * ⚠ 값이 없는 날은 결측으로 건너뛴다(0으로 채우지 않는다). 날짜가 겹치면 던진다.
 */
export function parseStablecoinChart(json: unknown, peg: string, from: string): SeriesPoint[] {
  if (!Array.isArray(json)) throw new Error("DefiLlama 응답이 배열이 아닙니다");
  const out: SeriesPoint[] = [];
  const seen = new Set<string>();
  for (const row of json as ChartRow[]) {
    const sec = Number(row.date);
    if (!Number.isFinite(sec)) throw new Error(`DefiLlama 날짜를 읽지 못했습니다: ${String(row.date)}`);
    if (sec % 86_400 !== 0) throw new Error(`DefiLlama 날짜가 UTC 자정이 아닙니다: ${sec}`);
    const date = new Date(sec * 1000).toISOString().slice(0, 10);
    if (date < from) continue;
    const value = row.totalCirculatingUSD?.[peg];
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    if (seen.has(date)) throw new Error(`DefiLlama 응답에 ${date}가 두 번 있습니다`);
    seen.add(date);
    out.push({ date, value });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** DefiLlama 계열 한 개. ⚠ 결과가 비면 성공으로 넘기지 않는다. 5xx·시간 초과는 3초 뒤 한 번만 다시 받는다. */
export async function fetchDefiLlama(sourceId: string, from: string): Promise<SeriesPoint[]> {
  if (!(DEFILLAMA_SOURCE_IDS as readonly string[]).includes(sourceId)) {
    throw new Error(`DefiLlama 소스 ID를 모릅니다: ${sourceId}`);
  }
  const peg = sourceId.split(":")[1];

  let res: Response | undefined;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      res = await fetch(STABLECOIN_ALL_URL, {
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; WoodsmanMacroBot/1.0)", Accept: "application/json" },
      });
      if (res.ok || res.status < 500) break;
      console.error(`[defillama] 응답 ${res.status} (${attempt}회)`);
    } catch (error) {
      console.error(`[defillama] 받기 실패 (${attempt}회)`, error);
      if (attempt === 2) throw error;
    } finally {
      clearTimeout(timer);
    }
    if (attempt === 1) await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  if (!res || !res.ok) throw new Error(`DefiLlama 응답 ${res?.status ?? "없음"}`);
  const points = parseStablecoinChart(await res.json(), peg, from);
  if (points.length === 0) throw new Error(`DefiLlama ${sourceId}: ${from} 이후 값이 없습니다`);
  return points;
}

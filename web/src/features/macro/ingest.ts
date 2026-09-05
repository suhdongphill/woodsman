/**
 * 자료 가져오기 — 외부에서 받아 D1에 **누적**한다.
 *
 * ## 왜 서버가 직접 가져오나
 * 지금까지는 윈도우 PC의 작업 스케줄러가 주 1회 돌면서 옵시디언 볼트의 HTML을 고쳤다.
 * PC가 꺼져 있으면 멈추고, 사이트는 그 사실을 알 수 없다. 사이트가 스스로 받아 오면
 * **어디서든 버튼 하나로** 갱신되고, 실패도 사이트가 기록한다.
 *
 * FRED CSV와 Yahoo 차트 API는 **키가 필요 없다.** 그래서 시크릿 없이 동작한다.
 *
 * ## 규칙
 * - ⚠ 지표 하나가 실패해도 나머지는 계속 간다. 다만 **반드시 기록**한다
 *   (`MacroIngest.detail`). 조용히 옛 값을 보여주는 것이 이 프로젝트에서 가장 크게 데인 사고다.
 * - ⚠ 받은 값은 **원값 그대로** 넣는다. YoY 같은 변환은 읽을 때 한다.
 * - 처음 받을 때는 오래된 것까지, 이미 쌓여 있으면 최근 구간만 받는다(왕복을 줄인다).
 */
import { resolveApiEnv } from "@/features/ai/credentials";
import { autoIndicators, findIndicator, type MacroIndicator } from "@/lib/macro/catalog";
import {
  dedupeByDate,
  parseEcosJson,
  parseFredCsv,
  parseNaverTotalInfo,
  parseYahooChart,
} from "@/lib/macro/parse";
import type { SeriesPoint } from "@/lib/macro/series";
import {
  finishIngest,
  loadMaxDates,
  startIngest,
  upsertPoints,
  type IngestDetail,
} from "./repository";

/** 처음 받을 때 어디까지 거슬러 올라갈지. 사이클을 보려면 최소 두 번의 침체가 필요하다. */
const HISTORY_START = "1990-01-01";
/** 이미 쌓여 있을 때 받는 구간(일). 통계 수정본까지 다시 받으려면 넉넉해야 한다. */
const REFRESH_DAYS = 500;

const FETCH_TIMEOUT_MS = 20_000;

/** ECOS 한 번 요청으로 받는 최대 행 수. 월간 계열 30년치가 360행이라 넉넉하다. */
const ECOS_MAX_ROWS = 1_000;

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

/** 응답이 안 오면 영원히 매달리지 않는다 — 한 지표가 전체 수집을 잡아먹는다. */
async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        // Yahoo는 브라우저 UA가 아니면 막는 경우가 있다.
        "User-Agent": "Mozilla/5.0 (compatible; WoodsmanMacroBot/1.0)",
        Accept: "text/csv,application/json,*/*",
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchFred(seriesId: string, from: string): Promise<SeriesPoint[]> {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(seriesId)}&cosd=${from}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`FRED ${seriesId} 응답 ${res.status}`);

  const points = parseFredCsv(await res.text());
  if (points.length === 0) throw new Error(`FRED ${seriesId} 응답에 값이 없습니다`);
  return points;
}

/**
 * Yahoo 시세.
 *
 * 기본은 **월봉**이다 — 거시 비교에 일봉은 필요 없고 점 수가 40배 늘어난다.
 * ⚠ 다만 **발표 주기가 일간(`freq: "d"`)인 지표는 일봉으로 받는다**(2026-08-22).
 *   달러인덱스·금·주가지수를 월봉으로 받으면 `asOf`가 늘 월초로 찍혀서,
 *   신선도 판정이 **매일 "기한초과"라고 거짓말을 한다.** 판정을 붙였으면 입력도 맞춰야 한다.
 *   일봉은 `max`가 너무 크므로 최초 수집도 10년으로 자른다.
 */
async function fetchYahoo(symbol: string, full: boolean, daily: boolean): Promise<SeriesPoint[]> {
  const interval = daily ? "1d" : "1mo";
  const range = full ? (daily ? "10y" : "max") : daily ? "1y" : "2y";
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`Yahoo ${symbol} 응답 ${res.status}`);

  const points = parseYahooChart(await res.json());
  if (points.length === 0) throw new Error(`Yahoo ${symbol} 응답에 값이 없습니다`);
  return points;
}

/** ECOS 주기 코드 — 발표 주기를 한국은행의 표기로 바꾼다. */
const ECOS_CYCLE: Record<string, string> = { d: "D", m: "M", q: "Q" };

/** 주기별 기간 표기. `M`이면 `202601`, `D`면 `20260105`. */
function ecosPeriod(day: string, cycle: string): string {
  const digits = day.replace(/-/g, "");
  if (cycle === "D") return digits;
  if (cycle === "Q" || cycle === "M") return digits.slice(0, 6);
  return digits.slice(0, 4);
}

/**
 * 한국은행 ECOS.
 *
 * ⚠ **인증키가 필요하다**(`ECOS_API_KEY`). 없으면 이 지표만 실패로 남긴다 —
 *    키가 없는 것과 한국은행이 값을 안 준 것이 같아 보이면 안 된다.
 * ⚠ 오류도 **HTTP 200**으로 오기 때문에 판정은 `parseEcosJson`이 한다.
 * `sourceId`는 `통계표/항목` 꼴이다(예: `722Y001/0101000` = 한국은행 기준금리).
 */
async function fetchEcos(
  sourceId: string,
  freq: string,
  apiKey: string,
  from: string,
): Promise<SeriesPoint[]> {
  if (!apiKey) {
    throw new Error("ECOS_API_KEY가 없습니다 — 한국은행 오픈API 키를 등록하세요");
  }

  const [stat, item] = sourceId.split("/");
  if (!stat || !item) throw new Error(`ECOS 소스 ID 형식이 틀렸습니다: ${sourceId}`);

  const cycle = ECOS_CYCLE[freq];
  if (!cycle) throw new Error(`ECOS가 지원하지 않는 주기입니다: ${freq}`);

  const start = ecosPeriod(from, cycle);
  const end = ecosPeriod(new Date().toISOString().slice(0, 10), cycle);
  const url = `https://ecos.bok.or.kr/api/StatisticSearch/${encodeURIComponent(apiKey)}/json/kr/1/${ECOS_MAX_ROWS}/${stat}/${cycle}/${start}/${end}/${item}`;

  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`ECOS ${stat} 응답 ${res.status}`);

  const points = parseEcosJson(await res.json());
  if (points.length === 0) throw new Error(`ECOS ${stat} 응답에 값이 없습니다`);
  return points;
}

/**
 * 인증키를 읽는다 — **관리자 화면 보관함(암호화 DB) 우선, 없으면 시크릿·`.env`.**
 * ⚠ 판단을 여기서 다시 구현하지 않는다. AI 키와 **같은 보관함·같은 순서**를 쓴다
 *    (`features/ai/credentials.ts`) — 순서가 갈리면 "등록했는데 안 먹네"가 생긴다.
 */
async function readEcosKey(): Promise<string> {
  const env = await resolveApiEnv();
  return (env.ECOS_API_KEY ?? "").trim();
}

/**
 * 네이버 금융 — 컨센서스 기반 「추정PER」처럼 **공표 시계열이 없는 값**을 오늘 시점으로 잰다.
 *
 * ⚠ 발표 계열이 아니라 **매일 다시 재는 관측**이다. 그래서 기준일이 관측일(KST)이고,
 *    과거를 소급해 받을 수 없다 — 오늘부터 하루씩 쌓인다.
 * ⚠ 공개 웹 화면이 쓰는 것과 같은 응답이다. 키가 필요 없다.
 * `sourceId`는 `종목코드/항목이름` 꼴이다(예: `000660/추정PER`).
 */
async function fetchNaver(sourceId: string): Promise<SeriesPoint[]> {
  const [code, key] = sourceId.split("/");
  if (!code || !key) throw new Error(`네이버 소스 ID 형식이 틀렸습니다: ${sourceId}`);

  const res = await fetchWithTimeout(
    `https://m.stock.naver.com/api/stock/${encodeURIComponent(code)}/integration`,
  );
  if (!res.ok) throw new Error(`네이버 ${code} 응답 ${res.status}`);

  // 관측일은 **KST 기준 오늘**이다. UTC로 찍으면 밤에 받은 값이 어제로 들어간다.
  const today = new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);
  return parseNaverTotalInfo(await res.json(), key, today);
}

async function fetchIndicator(
  indicator: MacroIndicator,
  hasHistory: boolean,
  ecosKey: string,
): Promise<SeriesPoint[]> {
  if (!indicator.sourceId) throw new Error("소스 ID가 없습니다(수동 지표)");

  if (indicator.source === "FRED") {
    return fetchFred(indicator.sourceId, hasHistory ? daysAgo(REFRESH_DAYS) : HISTORY_START);
  }
  if (indicator.source === "YAHOO") {
    return fetchYahoo(indicator.sourceId, !hasHistory, indicator.freq === "d");
  }
  if (indicator.source === "NAVER") {
    return fetchNaver(indicator.sourceId);
  }
  if (indicator.source === "ECOS") {
    return fetchEcos(
      indicator.sourceId,
      indicator.freq,
      ecosKey,
      hasHistory ? daysAgo(REFRESH_DAYS) : HISTORY_START,
    );
  }
  throw new Error(`알 수 없는 출처: ${indicator.source}`);
}

/** 이미 가진 마지막 기준일에서 며칠까지 되돌려 다시 쓸 것인가. */
const REWRITE_BACK_DAYS = 60;

/**
 * 무엇을 쓸지 고른다.
 *
 * 처음이면 전부. 이미 있으면 **마지막 기준일에서 60일 전부터**만 쓴다.
 * 60일을 되감는 이유: 고용·물가 통계는 발표 뒤 한두 번 수정된다. 새로 생긴 점만 쓰면
 * 옛 값이 영원히 틀린 채로 남는다. 반대로 전 구간을 매번 다시 쓰면 한 번 수집에 3분이
 * 넘게 걸린다(실제로 그랬다). 그 사이를 60일로 잡았다.
 */
export function pointsToWrite(
  points: SeriesPoint[],
  known: string | undefined,
): { toWrite: SeriesPoint[]; added: number } {
  if (!known) return { toWrite: points, added: points.length };

  const from = new Date(Date.parse(`${known}T00:00:00.000Z`) - REWRITE_BACK_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);

  return {
    toWrite: points.filter((p) => p.date >= from),
    added: points.filter((p) => p.date > known).length,
  };
}

export type IngestResult = {
  runId: string;
  okCount: number;
  failCount: number;
  addedPoints: number;
  detail: IngestDetail[];
};

/**
 * 자동 지표를 받아 누적한다.
 *
 * `keys`를 주면 그것만(그룹 단위 재시도용), 없으면 전부.
 * 한 번에 여러 개를 병렬로 받되 동시 수를 제한한다 — 한 번에 40개를 던지면 상대가 막는다.
 */
export async function ingestMacro(
  options: { trigger?: string; keys?: string[]; concurrency?: number } = {},
): Promise<IngestResult> {
  /**
   * ⚠ 동시 요청 수. 2026-09-05에 4 → 6으로 올렸다.
   *    무료 플랜의 subrequest 한도(요청당 50)가 풀리면서 60개 지표가 한 번에 나가게 됐고,
   *    4개씩 15물결이면 한 번 수집에 30초 가까이 걸린다. 다만 **상대 서버가 기준**이라
   *    무한정 올리지 않는다 — FRED·Yahoo는 같은 IP의 폭주에 429로 답한다.
   *    DB 쓰기는 여전히 순차다(2026-08-06에 연결이 끊겼던 자리).
   */
  const { trigger = "MANUAL", concurrency = 6 } = options;

  const targets = options.keys?.length
    ? options.keys
        .map((k) => findIndicator(k))
        .filter((i): i is MacroIndicator => !!i && i.source !== "MANUAL")
    : autoIndicators();

  const runId = await startIngest(trigger);
  /** 지표별로 이미 가진 마지막 기준일. 여기부터 새로 쓴다. */
  const maxDates = await loadMaxDates();
  // 한 번만 읽는다 — 지표마다 읽으면 같은 값을 수십 번 꺼내게 된다.
  const ecosKey = targets.some((t) => t.source === "ECOS") ? await readEcosKey() : "";
  const detail: IngestDetail[] = [];
  let addedPoints = 0;

  /**
   * ⚠ **네트워크는 병렬, DB 쓰기는 순차.**
   *    처음엔 지표 4개를 통째로 병렬 처리했더니 D1 연결이 끊겼다(`fetch failed`/ECONNRESET,
   *    2026-08-06). 시계열은 한 지표가 수천 점이라 동시에 쓰면 연결이 버티지 못한다.
   *    받아 오는 동안 기다리는 시간은 병렬로 줄이고, 쓰기는 한 번에 하나씩 한다.
   *
   * 한 번에 받는 개수를 제한하는 또 다른 이유는 메모리다 — 35개 시계열을 통째로 들고 있으면
   * Worker 메모리에 부담이 된다. 물결 단위로 받아서 쓰고 버린다.
   */
  for (let i = 0; i < targets.length; i += concurrency) {
    const wave = targets.slice(i, i + concurrency);

    const fetched = await Promise.all(
      wave.map(async (indicator) => {
        try {
          const known = maxDates.get(indicator.key);
          const raw = await fetchIndicator(indicator, !!known, ecosKey);
          return { indicator, points: dedupeByDate(raw), known };
        } catch (error) {
          // ⚠ 실패를 삼키지 않는다. 로그와 이력 양쪽에 남긴다.
          const message = error instanceof Error ? error.message : String(error);
          console.error(`[macro] ${indicator.key} 받기 실패`, error);
          detail.push({ key: indicator.key, ok: false, error: message });
          return null;
        }
      }),
    );

    for (const item of fetched) {
      if (!item) continue;
      try {
        const { toWrite, added } = pointsToWrite(item.points, item.known);
        await upsertPoints(item.indicator.key, item.indicator.source, toWrite);
        addedPoints += added;
        detail.push({
          key: item.indicator.key,
          ok: true,
          added,
          total: item.points.length,
          latest: item.points[item.points.length - 1]?.date,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[macro] ${item.indicator.key} 저장 실패`, error);
        detail.push({ key: item.indicator.key, ok: false, error: `저장 실패: ${message}` });
      }
    }
  }

  const okCount = detail.filter((d) => d.ok).length;
  const failCount = detail.length - okCount;
  await finishIngest(runId, { okCount, failCount, addedPoints, detail });

  return { runId, okCount, failCount, addedPoints, detail };
}

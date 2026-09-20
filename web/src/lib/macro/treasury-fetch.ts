/**
 * 재무부 계열을 **받아 오는** 부분. 해석은 `treasury.ts`(순수·테스트)가 한다.
 *
 * ## 왜 `ingest.ts`에서 떼어냈나 (2026-09-16, S2-c)
 * 워커 → treasury.gov가 **525·시간 초과**로 계속 막혔다(로컬·일반 네트워크는 성공). 2026-09-13부터
 * 매 수집마다 네 계열이 전부 실패했고, Fiscal Data·TreasuryDirect 두 경로 모두 같았다.
 * 그래서 이 수집만 **워커 밖**(GitHub Actions 예약 작업)에서 돌린다 —
 * `web/scripts/treasury-daily.mjs`가 이 파일을 그대로 부른다.
 *
 * ⚠ 이 파일은 **D1·워커 전용 모듈을 import 하지 않는다.** 평범한 Node에서도 돌아야 한다
 *   (`fetch`·`AbortController`만 쓴다). 여기에 저장 코드를 들이면 스크립트가 워커 런타임을 끌고 온다.
 * ⚠ 판단을 두 곳에 두지 않으려고 `ingest.ts`도 이 파일을 쓴다 — 워커에서 다시 열리게 되면
 *   그쪽 호출만 되살리면 된다(운영지침 §1).
 */
import {
  NOMINAL_TEN_YEAR_TERMS,
  TREASURY_DIRECT_MAX_ROWS,
  mspdShares,
  nominalTenYearAuctions,
  treasuryDirectToAuctionRow,
  type AuctionRow,
  type MspdRow,
  type TreasuryDirectSecurity,
} from "./treasury";
import type { SeriesPoint } from "./series";

const FISCAL_BASE = "https://api.fiscaldata.treasury.gov/services/api/fiscal_service";

/** 응답이 안 오면 영원히 매달리지 않는다. */
const FETCH_TIMEOUT_MS = 20_000;

/** `fetchTreasury`가 아는 소스 ID. ⚠ 카탈로그의 TREASURY 지표는 이 중 하나여야 한다(테스트가 대조한다). */
export const TREASURY_SOURCE_IDS = [
  "mspd:bill_share",
  "mspd:coupon_share",
  "mspd:total_marketable",
  "auction10y:bid_to_cover",
  "auction10y:high_yield",
] as const;

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; WoodsmanMacroBot/1.0)",
        Accept: "text/csv,application/json,*/*",
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fiscal Data 한 데이터셋을 페이지 끝까지 받는다.
 * ⚠ 페이지가 50을 넘으면 멈춘다 — 필터가 풀려 전 기간을 긁는 것을 조용히 넘기지 않는다.
 * ⚠ Fiscal Data는 **간헐적으로** 멈춘다(2026-09-14 측정: 같은 요청이 241초 뒤 504, 몇 분 뒤 2초 만에 200).
 *   그래서 ① 서버에서 먼저 거르고 ② 5xx·시간 초과는 3초 뒤 한 번만 다시 받는다.
 * ⚠ 서버 필터는 **줄이는 용도**다 — TIPS·재발행 판정의 권위는 여전히 `treasury.ts`다.
 */
async function fetchFiscalAll<T>(path: string, params: Record<string, string>): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; ; page++) {
    if (page > 50) throw new Error(`재무부 ${path} 페이지가 50을 넘었습니다 — 필터를 확인하세요`);
    const qs = new URLSearchParams({ ...params, "page[size]": "1000", "page[number]": String(page) });
    const url = `${FISCAL_BASE}/${path}?${qs}`;
    let res: Response | undefined;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        res = await fetchWithTimeout(url);
        // 4xx는 다시 보내도 같다 — 재시도는 5xx(서버 쪽 장애)만
        if (res.ok || res.status < 500) break;
        console.error(`[treasury] ${path} 응답 ${res.status} (${attempt}회)`);
      } catch (error) {
        console.error(`[treasury] ${path} 받기 실패 (${attempt}회)`, error);
        if (attempt === 2) throw error;
      }
      if (attempt === 1) await new Promise((resolve) => setTimeout(resolve, 3000));
    }
    if (!res || !res.ok) throw new Error(`재무부 ${path} 응답 ${res?.status ?? "없음"}`);
    const json = (await res.json()) as { data?: T[]; meta?: { "total-pages"?: number } };
    if (!Array.isArray(json.data)) throw new Error(`재무부 ${path} 응답에 data가 없습니다`);
    out.push(...json.data);
    const pages = json.meta?.["total-pages"] ?? 1;
    if (page >= pages || json.data.length === 0) break;
  }
  return out;
}

/**
 * 재무부 계열 한 개. 해석은 **테스트된 순수 함수**가 한다 — 여기서는 받기만 한다.
 * ⚠ 결과가 비면 성공으로 넘기지 않는다(조용한 실패 금지).
 */
export async function fetchTreasury(sourceId: string, from: string): Promise<SeriesPoint[]> {
  const [dataset, field] = sourceId.split(":");
  if (dataset === "mspd") {
    const rows = await fetchFiscalAll<MspdRow>("v1/debt/mspd/mspd_table_1", {
      filter: `security_type_desc:in:(Marketable,Total Marketable),record_date:gte:${from}`,
      fields: "record_date,security_type_desc,security_class_desc,total_mil_amt",
      sort: "record_date",
    });
    const shares = mspdShares(rows);
    const series =
      field === "bill_share"
        ? shares.billShare
        : field === "coupon_share"
          ? shares.couponShare
          : field === "total_marketable"
            ? shares.totalMarketable
            : undefined;
    if (!series) throw new Error(`재무부 MSPD 필드를 모릅니다: ${sourceId}`);
    if (series.length === 0) throw new Error(`재무부 MSPD ${field}: 「Total Marketable」 행이 있는 달이 없습니다`);
    return series;
  }
  if (dataset === "auction10y") {
    /**
     * ⭐ **Fiscal Data를 먼저 쓴다**(2026-09-16 되살림). 서버에서 명목 10년물 만기로 거르고 **페이지네이션이 된다** —
     *   TreasuryDirect의 **250행 상한**이 없다. 상한이 왜 문제였나: 10년물 입찰은 연 12회 남짓인데 `type=Note`가
     *   2·3·5·7년물을 함께 주어, 250행이면 **4년치도 안 된다.** 명세 §1의 최소 창(5년)을 못 채워
     *   **값이 들어와도 점수에 못 들어갔다**(2026-09-16 운영에서 확인 — `auction_quality` 결측).
     * ⚠ S2-b에서 TreasuryDirect로 갈아탄 이유는 **워커**에서 Fiscal Data가 525였기 때문이다.
     *   이 코드는 이제 워커 밖(GitHub Actions)에서 돌고, 같은 러너에서 MSPD가 Fiscal Data로 잘 받아진다.
     * ⚠ 그래도 TreasuryDirect 경로는 **지우지 않고 대비로 남긴다** — 두 경로의 판정은 같은 함수다.
     */
    try {
      const rows = await fetchFiscalAll<AuctionRow>("v1/accounting/od/auctions_query", {
        filter: `security_type:eq:Note,security_term:in:(${NOMINAL_TEN_YEAR_TERMS.join(",")}),auction_date:gte:${from}`,
        fields:
          "auction_date,security_type,security_term,original_security_term,inflation_index_security,floating_rate,bid_to_cover_ratio,high_yield",
        sort: "auction_date",
      });
      const auctions = nominalTenYearAuctions(rows);
      const series =
        field === "bid_to_cover" ? auctions.bidToCover : field === "high_yield" ? auctions.highYield : undefined;
      if (!series) throw new Error(`재무부 입찰 필드를 모릅니다: ${sourceId}`);
      if (series.length > 0) return series;
      // ⚠ 빈 결과는 성공이 아니다 — 대비 경로로 넘어가 이유를 남긴다.
      throw new Error(`Fiscal Data 입찰 결과가 비었다(제외 ${auctions.excluded} · 대기 ${auctions.pending})`);
    } catch (error) {
      console.error(`[treasury] Fiscal Data 입찰 실패 — TreasuryDirect로 넘어간다: ${String(error).slice(0, 160)}`);
    }
    /**
     * 대비 경로. ⚠ `securities/search`의 기간 조건은 믿지 않는다(빈 결과·부분 결과) — `auctioned?days=N`만 쓴다.
     *   ⚠ 최대 250행이라 **5년을 못 채울 수 있다.** 판정은 Fiscal Data와 같은 함수다 — 행 모양만 옮긴다.
     */
    const days = Math.min(
      4500,
      Math.max(30, Math.ceil((Date.now() - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 7),
    );
    const url = `https://www.treasurydirect.gov/TA_WS/securities/auctioned?format=json&type=Note&days=${days}`;
    let res: Response | undefined;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        res = await fetchWithTimeout(url);
        if (res.ok || res.status < 500) break;
        console.error(`[treasury] TreasuryDirect 입찰 응답 ${res.status} (${attempt}회)`);
      } catch (error) {
        console.error(`[treasury] TreasuryDirect 입찰 받기 실패 (${attempt}회)`, error);
        if (attempt === 2) throw error;
      }
      if (attempt === 1) await new Promise((resolve) => setTimeout(resolve, 3000));
    }
    if (!res || !res.ok) throw new Error(`TreasuryDirect 입찰 응답 ${res?.status ?? "없음"}`);
    const json = (await res.json()) as unknown;
    if (!Array.isArray(json)) throw new Error("TreasuryDirect 입찰 응답이 배열이 아닙니다");
    if (json.length >= TREASURY_DIRECT_MAX_ROWS) {
      // ⚠ 조용히 잘리지 않게 남긴다 — 처음 받을 때(4,500일)는 2021년 무렵에서 잘리는 것이 정상이다.
      console.warn(
        `[treasury] TreasuryDirect 입찰이 ${json.length}행에서 잘렸습니다(요청 ${days}일) — 더 오래된 입찰은 받지 못했습니다`,
      );
    }
    const rows = (json as TreasuryDirectSecurity[]).map(treasuryDirectToAuctionRow);
    const auctions = nominalTenYearAuctions(rows);
    const series =
      field === "bid_to_cover" ? auctions.bidToCover : field === "high_yield" ? auctions.highYield : undefined;
    if (!series) throw new Error(`재무부 입찰 필드를 모릅니다: ${sourceId}`);
    if (series.length === 0) {
      throw new Error(
        `재무부 명목 10년물 입찰 ${field}: 결과가 있는 입찰이 없습니다(제외 ${auctions.excluded} · 대기 ${auctions.pending})`,
      );
    }
    return series;
  }
  throw new Error(`재무부 소스 ID를 모릅니다: ${sourceId}`);
}

/**
 * 미 재무부 Fiscal Data 응답 → 시계열 — 순수 함수. Capital Regime Engine R2b-2 (2026-09-14).
 *
 * 무료·키 없음. 이 파일은 **받은 JSON을 해석하는 규칙**만 둔다(네트워크·DB 없음 — CLAUDE.md §1).
 *
 * ## ⚠ 이 파일이 지키는 함정 셋 (2026-09-14 실데이터로 확인)
 *
 * ### 1. 「10-Year Note」에는 **물가연동국채(TIPS)가 섞여 있다**
 * Fiscal Data는 10년 TIPS도 `security_type: "Note"` · `security_term: "10-Year"`로 적는다. 그대로 모으면
 * 명목 10년물 입찰(고금리 4%대)과 TIPS 입찰(실질금리 2%대)이 **한 계열로 조용히 섞인다**.
 * 구분은 명시 필드 `inflation_index_security: "Yes"`로 한다(CPI 기준값 필드와 65건 모두 일치를 확인했다).
 *
 * ### 2. 재발행(reopening)은 **만기가 줄어든 이름**으로 온다
 * 10년물은 한 달 뒤·두 달 뒤 「9-Year 11-Month」「9-Year 10-Month」로 다시 입찰한다. 「10-Year」만 고르면 **셋 중 둘을 빠뜨린다.**
 * ⚠ 그런데 TIPS 재발행도 「9-Year 10-Month」를 쓴다 — 그래서 만기 이름만으로도, TIPS 표시만으로도 부족하고 **둘 다** 본다.
 *
 * ### 3. 문자열 `"null"`은 0이 아니다
 * 아직 결과가 안 나온 입찰(발표 전)은 응찰률·금리가 `"null"` **문자열**로 온다. 숫자로 바꾸면 NaN이거나 0이 된다 — 결측으로 버린다.
 *
 * ### 4. 「원래 10년물」이 **3년물 입찰**로 나오기도 한다 — 오류가 아니다
 * 2019-11-05 입찰(CUSIP 912828TY6, 만기 2022-11-15)은 `original_security_term: "10-Year"` · `security_term: "3-Year"` ·
 * `reopening: "Yes"`다. 처음엔 데이터 이상으로 봤는데, **만기가 3년 남은 옛 10년물을 3년물 입찰에서 재발행한 실제 입찰**이다.
 * 그러니 이 입찰은 3년물 계열이다. 그래서 계열은 **원래 만기가 아니라 입찰 만기 이름**으로 고른다 — 원래 만기로 고르면 3년물
 * 입찰이 10년물 계열에 섞인다. 테스트로 박았다.
 */
import type { SeriesPoint } from "./series";

/** 명목 10년물 계열(신규 + 두 번의 재발행). ⚠ 정확히 이 이름만. */
export const NOMINAL_TEN_YEAR_TERMS = ["10-Year", "9-Year 11-Month", "9-Year 10-Month"] as const;

export type AuctionRow = {
  auction_date: string;
  security_type: string;
  security_term: string;
  original_security_term?: string;
  inflation_index_security?: string;
  floating_rate?: string;
  bid_to_cover_ratio?: string;
  high_yield?: string;
};

/** `"null"`·빈 문자열·숫자가 아닌 값은 결측(undefined). ⚠ 0으로 만들지 않는다. */
export function fiscalNumber(raw: string | undefined): number | undefined {
  if (raw === undefined || raw === null) return undefined;
  const t = String(raw).trim();
  if (t === "" || t.toLowerCase() === "null") return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

/** 이 입찰이 명목 10년물 계열인가 — 함정 1·2를 함께 막는다. */
export function isNominalTenYear(row: AuctionRow): boolean {
  if (row.security_type !== "Note") return false;
  if (!(NOMINAL_TEN_YEAR_TERMS as readonly string[]).includes(row.security_term)) return false;
  if ((row.inflation_index_security ?? "").toLowerCase() === "yes") return false;
  if ((row.floating_rate ?? "").toLowerCase() === "yes") return false;
  return true;
}

export type AuctionSeries = {
  bidToCover: SeriesPoint[];
  highYield: SeriesPoint[];
  /** 결과가 아직 없어(`"null"`) 버린 입찰 수 */
  pending: number;
  /** 명목 10년물이 아니라 걸러낸 행 수(TIPS · 다른 만기) */
  excluded: number;
};

/**
 * 명목 10년물 입찰의 응찰률(bid-to-cover)·낙찰금리 계열. 날짜는 **입찰일**, 오름차순.
 * ⚠ 같은 날 두 건이면(없어야 한다) 뒤의 값으로 덮지 않고 **평균하지도 않는다** — 던진다. 같은 날 두 입찰은 규칙이 틀렸다는 신호다.
 */
export function nominalTenYearAuctions(rows: AuctionRow[]): AuctionSeries {
  const bidToCover = new Map<string, number>();
  const highYield = new Map<string, number>();
  let pending = 0;
  let excluded = 0;
  for (const r of rows) {
    if (!isNominalTenYear(r)) {
      excluded += 1;
      continue;
    }
    const btc = fiscalNumber(r.bid_to_cover_ratio);
    const hy = fiscalNumber(r.high_yield);
    if (btc === undefined && hy === undefined) {
      pending += 1;
      continue;
    }
    if (bidToCover.has(r.auction_date) || highYield.has(r.auction_date)) {
      throw new Error(`명목 10년물 입찰이 같은 날 두 건이다(${r.auction_date}) — 계열 정의를 다시 본다`);
    }
    if (btc !== undefined) bidToCover.set(r.auction_date, btc);
    if (hy !== undefined) highYield.set(r.auction_date, hy);
  }
  const toSeries = (m: Map<string, number>) =>
    [...m].map(([date, value]) => ({ date, value })).sort((a, b) => a.date.localeCompare(b.date));
  return { bidToCover: toSeries(bidToCover), highYield: toSeries(highYield), pending, excluded };
}

export type MspdRow = {
  record_date: string;
  security_type_desc: string;
  security_class_desc: string;
  total_mil_amt: string;
};

export type MspdShares = {
  /** 시장성 국채 중 단기물(Bills) 비중 % */
  billShare: SeriesPoint[];
  /** 시장성 국채 중 이표채(Notes + Bonds) 비중 % — ⚠ TIPS·FRN·FFB는 넣지 않는다 */
  couponShare: SeriesPoint[];
  /** 시장성 국채 총액(조 달러) */
  totalMarketable: SeriesPoint[];
};

/**
 * MSPD 표 1(월말 잔액) → 단기물·이표채 비중.
 *
 * ⚠ 분모는 **「Total Marketable」 행**이다 — 구성요소를 더해 만들지 않는다(재무부가 낸 합계와 우리가 더한 합계가 갈리면 어느 쪽이
 *   맞는지 알 수 없게 된다). 그 행이 없는 달은 **비중을 내지 않는다.**
 * ⚠ 「이표채」는 Notes + Bonds만. TIPS·변동금리(FRN)·연방금융은행(FFB)은 성격이 달라 빼고, 그렇다고 이름에 적는다.
 */
export function mspdShares(rows: MspdRow[]): MspdShares {
  const byDate = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const v = fiscalNumber(r.total_mil_amt);
    if (v === undefined) continue;
    const key =
      r.security_type_desc === "Total Marketable" ? "TOTAL" : r.security_type_desc === "Marketable" ? r.security_class_desc : undefined;
    if (!key) continue;
    const m = byDate.get(r.record_date) ?? new Map<string, number>();
    m.set(key, v);
    byDate.set(r.record_date, m);
  }
  const billShare: SeriesPoint[] = [];
  const couponShare: SeriesPoint[] = [];
  const totalMarketable: SeriesPoint[] = [];
  for (const [date, m] of [...byDate].sort((a, b) => a[0].localeCompare(b[0]))) {
    const total = m.get("TOTAL");
    if (total === undefined || total <= 0) continue;
    totalMarketable.push({ date, value: total / 1_000_000 });
    const bills = m.get("Bills");
    if (bills !== undefined) billShare.push({ date, value: (bills / total) * 100 });
    const notes = m.get("Notes");
    const bonds = m.get("Bonds");
    if (notes !== undefined && bonds !== undefined) couponShare.push({ date, value: ((notes + bonds) / total) * 100 });
  }
  return { billShare, couponShare, totalMarketable };
}

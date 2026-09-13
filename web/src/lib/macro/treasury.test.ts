/**
 * 재무부 Fiscal Data 해석 — 픽스처는 **2026-09-14에 받은 실제 응답의 행**이다(필요한 필드만 남겼다).
 * 지어낸 모양이 아니라 실제로 걸렸던 함정을 그대로 되돌려 본다.
 */
import { describe, expect, it } from "vitest";
import {
  fiscalNumber,
  isNominalTenYear,
  mspdShares,
  nominalTenYearAuctions,
  type AuctionRow,
  type MspdRow,
} from "./treasury";

/** 명목 10년물 신규 — 2026-08-12 */
const NOMINAL_NEW: AuctionRow = {
  auction_date: "2026-08-12",
  security_type: "Note",
  security_term: "10-Year",
  original_security_term: "10-Year",
  inflation_index_security: "No",
  floating_rate: "No",
  bid_to_cover_ratio: "2.530000",
  high_yield: "4.6830",
};

/** ⚠ 10년 TIPS — 이름은 똑같이 「Note · 10-Year」다. 2026-07-23 */
const TIPS_NEW: AuctionRow = {
  auction_date: "2026-07-23",
  security_type: "Note",
  security_term: "10-Year",
  original_security_term: "10-Year",
  inflation_index_security: "Yes",
  floating_rate: "No",
  bid_to_cover_ratio: "2.300000",
  high_yield: "2.4380",
};

/** ⚠ TIPS 재발행 — 명목 재발행과 같은 「9-Year 10-Month」, 아직 결과 없음(`"null"`). 2026-09-17 */
const TIPS_REOPEN_PENDING: AuctionRow = {
  auction_date: "2026-09-17",
  security_type: "Note",
  security_term: "9-Year 10-Month",
  original_security_term: "10-Year",
  inflation_index_security: "Yes",
  floating_rate: "No",
  bid_to_cover_ratio: "null",
  high_yield: "null",
};

/** ⚠ 옛 10년물을 3년물 입찰에서 재발행 — 3년물 계열이다. 2019-11-05 · CUSIP 912828TY6 */
const THREE_YEAR_REOPENING_OF_OLD_TEN: AuctionRow = {
  auction_date: "2019-11-05",
  security_type: "Note",
  security_term: "3-Year",
  original_security_term: "10-Year",
  inflation_index_security: "No",
  floating_rate: "No",
  bid_to_cover_ratio: "2.600000",
  high_yield: "1.6300",
};

/**
 * 명목 10년물 재발행(한 달 뒤) — 이름이 줄어 온다. 2026-09-09 · CUSIP 91282CRF0
 * ⚠ 처음 넣었을 때는 **날짜만 실제이고 값(2.48 · 4.901)은 지어낸 것**이었다. 실데이터 스모크의 마지막 점(2.710 · 4.834)과 맞지 않아
 *   드러났고, 실제 행으로 바꿨다 — 「실제 응답의 행」이라고 적어 둔 파일에 지어낸 값을 두지 않는다.
 */
const NOMINAL_REOPEN: AuctionRow = {
  auction_date: "2026-09-09",
  security_type: "Note",
  security_term: "9-Year 11-Month",
  original_security_term: "10-Year",
  inflation_index_security: "No",
  floating_rate: "No",
  bid_to_cover_ratio: "2.710000",
  high_yield: "4.8340",
};

describe("「null」 문자열", () => {
  it("⚠ 0이 아니라 결측이다", () => {
    expect(fiscalNumber("null")).toBeUndefined();
    expect(fiscalNumber("")).toBeUndefined();
    expect(fiscalNumber(undefined)).toBeUndefined();
    expect(fiscalNumber("2.530000")).toBe(2.53);
  });
});

describe("명목 10년물 입찰 계열", () => {
  it("⚠ 이름이 같은 10년 TIPS를 섞지 않는다", () => {
    expect(isNominalTenYear(NOMINAL_NEW)).toBe(true);
    expect(isNominalTenYear(TIPS_NEW)).toBe(false);
  });

  it("⚠ TIPS 재발행도 「9-Year 10-Month」다 — 만기 이름만으로는 거를 수 없다", () => {
    expect(isNominalTenYear(TIPS_REOPEN_PENDING)).toBe(false);
  });

  it("⚠ 재발행(이름이 줄어든 10년물)을 빠뜨리지 않는다", () => {
    expect(isNominalTenYear(NOMINAL_REOPEN)).toBe(true);
  });

  it("⚠ 원래 10년물이라도 3년물 입찰에서 재발행한 것은 10년물 계열이 아니다", () => {
    expect(isNominalTenYear(THREE_YEAR_REOPENING_OF_OLD_TEN)).toBe(false);
  });

  it("응찰률·낙찰금리를 입찰일 오름차순으로 낸다 — 걸러낸 수를 함께", () => {
    const s = nominalTenYearAuctions([NOMINAL_REOPEN, TIPS_NEW, NOMINAL_NEW, THREE_YEAR_REOPENING_OF_OLD_TEN, TIPS_REOPEN_PENDING]);
    expect(s.bidToCover).toEqual([
      { date: "2026-08-12", value: 2.53 },
      { date: "2026-09-09", value: 2.71 },
    ]);
    expect(s.highYield.map((p) => p.value)).toEqual([4.683, 4.834]);
    // TIPS 둘 + 3년물 재발행 하나. ⚠ 결과가 없는 TIPS 재발행은 「대기」가 아니라 「제외」다 — 애초에 우리 계열이 아니다.
    expect(s.excluded).toBe(3);
    expect(s.pending).toBe(0);
  });

  it("⚠ 결과가 아직 없는 명목 입찰은 버리고 세어 둔다", () => {
    const s = nominalTenYearAuctions([{ ...NOMINAL_NEW, auction_date: "2026-10-08", bid_to_cover_ratio: "null", high_yield: "null" }]);
    expect(s.bidToCover).toHaveLength(0);
    expect(s.pending).toBe(1);
  });

  it("⚠ 같은 날 명목 10년물이 두 건이면 덮거나 평균하지 않고 멈춘다", () => {
    expect(() => nominalTenYearAuctions([NOMINAL_NEW, { ...NOMINAL_NEW, bid_to_cover_ratio: "2.1" }])).toThrow(/같은 날 두 건/);
  });
});

describe("MSPD 표 1 — 단기물·이표채 비중 (2026-08-31 실제 값)", () => {
  const m = (cls: string, amt: string, type = "Marketable"): MspdRow => ({
    record_date: "2026-08-31",
    security_type_desc: type,
    security_class_desc: cls,
    total_mil_amt: amt,
  });
  const rows: MspdRow[] = [
    m("Bills", "7248070.0207"),
    m("Notes", "16218420.9377"),
    m("Bonds", "5525284.0943"),
    m("Treasury Inflation-Protected Securities", "2152659.84411264"),
    m("Floating Rate Notes", "679975.6013"),
    m("Federal Financing Bank", "3590.9655"),
    m("_", "31828001.4636126", "Total Marketable"),
    m("Government Account Series", "8106163.24559558", "Nonmarketable"),
    m("_", "40175641.1294333", "Total Public Debt Outstanding"),
  ];

  it("단기물 비중 = Bills ÷ Total Marketable", () => {
    const s = mspdShares(rows);
    expect(s.billShare[0].value).toBeCloseTo((7248070.0207 / 31828001.4636126) * 100, 6);
    expect(s.billShare[0].value).toBeCloseTo(22.77, 2);
  });

  it("⚠ 이표채 = Notes + Bonds만 — TIPS·FRN·FFB는 넣지 않는다", () => {
    const s = mspdShares(rows);
    expect(s.couponShare[0].value).toBeCloseTo(((16218420.9377 + 5525284.0943) / 31828001.4636126) * 100, 6);
  });

  it("⚠ 분모는 재무부가 낸 「Total Marketable」 행이다 — 비시장성·총부채를 섞지 않는다", () => {
    expect(mspdShares(rows).totalMarketable[0].value).toBeCloseTo(31.828, 3);
  });

  it("⚠ 합계 행이 없는 달은 비중을 만들지 않는다 — 구성요소를 더해 지어내지 않는다", () => {
    const s = mspdShares(rows.filter((r) => r.security_type_desc !== "Total Marketable"));
    expect(s.billShare).toHaveLength(0);
    expect(s.couponShare).toHaveLength(0);
  });
});

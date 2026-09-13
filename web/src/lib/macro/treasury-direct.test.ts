/**
 * TreasuryDirect 입찰 응답 → 명목 10년물 계열. 픽스처는 **2026-09-14에 받은 실제 `TA_WS` 응답의 행**이다(필요한 필드만).
 * ⚠ 워커에서 Fiscal Data가 525로 막혀(운영 9/13 22:43) 입찰만 이 경로로 받는다 — 판정 함수는 Fiscal Data와 **같은 것**을 쓴다.
 */
import { describe, expect, it } from "vitest";
import {
  TREASURY_DIRECT_MAX_ROWS,
  nominalTenYearAuctions,
  treasuryDirectToAuctionRow,
  type TreasuryDirectSecurity,
} from "./treasury";

/** 명목 10년물 재발행 — 2026-09-09 (Fiscal Data 픽스처와 같은 입찰: 응찰률 2.710 · 낙찰 4.834 · CUSIP 91282CRF0) */
const NOMINAL_REOPEN: TreasuryDirectSecurity = {
  auctionDate: "2026-09-09T00:00:00",
  securityType: "Note",
  securityTerm: "9-Year 11-Month",
  originalSecurityTerm: "10-Year",
  tips: "No",
  floatingRate: "No",
  bidToCoverRatio: "2.710000",
  highYield: "4.8340",
};

/** 명목 10년물 신규 — 2026-08-12 */
const NOMINAL_NEW: TreasuryDirectSecurity = {
  auctionDate: "2026-08-12T00:00:00",
  securityType: "Note",
  securityTerm: "10-Year",
  originalSecurityTerm: "10-Year",
  tips: "No",
  floatingRate: "No",
  bidToCoverRatio: "2.530000",
  highYield: "4.6830",
};

/** ⚠ 10년 TIPS — 이름은 똑같이 「Note · 10-Year」다. 2026-07-23 (TreasuryDirect는 type=TIPS로 분류) */
const TIPS_TEN: TreasuryDirectSecurity = {
  auctionDate: "2026-07-23T00:00:00",
  securityType: "Note",
  securityTerm: "10-Year",
  originalSecurityTerm: "10-Year",
  tips: "Yes",
  floatingRate: "No",
  bidToCoverRatio: "2.300000",
  highYield: "2.4380",
};

describe("TreasuryDirect → 입찰 행", () => {
  it("날짜는 입찰일 10자, 값은 문자열 그대로 옮긴다", () => {
    expect(treasuryDirectToAuctionRow(NOMINAL_REOPEN)).toEqual({
      auction_date: "2026-09-09",
      security_type: "Note",
      security_term: "9-Year 11-Month",
      original_security_term: "10-Year",
      inflation_index_security: "No",
      floating_rate: "No",
      bid_to_cover_ratio: "2.710000",
      high_yield: "4.8340",
    });
  });

  it("⭐ Fiscal Data와 같은 판정 함수 — 재발행은 넣고, TIPS는 뺀다(함정 1·2)", () => {
    const series = nominalTenYearAuctions([NOMINAL_NEW, NOMINAL_REOPEN, TIPS_TEN].map(treasuryDirectToAuctionRow));
    expect(series.bidToCover).toEqual([
      { date: "2026-08-12", value: 2.53 },
      { date: "2026-09-09", value: 2.71 },
    ]);
    expect(series.highYield.at(-1)).toEqual({ date: "2026-09-09", value: 4.834 });
    expect(series.excluded).toBe(1);
  });

  it("⚠ 결과 발표 전 입찰(빈 값)은 0이 아니라 대기로 센다", () => {
    const pending = treasuryDirectToAuctionRow({ ...NOMINAL_NEW, auctionDate: "2026-10-08T00:00:00", bidToCoverRatio: "", highYield: "" });
    const series = nominalTenYearAuctions([pending]);
    expect(series.bidToCover).toEqual([]);
    expect(series.pending).toBe(1);
  });

  it("한 번에 250행까지 — 이만큼 오면 더 오래된 입찰이 잘린 것이다", () => {
    expect(TREASURY_DIRECT_MAX_ROWS).toBe(250);
  });
});

import { describe, expect, it } from "vitest";
import {
  daysInMonth,
  effectiveDate,
  fedFuturesSentence,
  impliedFromFutures,
  monthPrefix,
  resolveFrontContract,
} from "./fedfutures";

/**
 * ⚠ 실측값이다. 2026-09-13에 Yahoo `ZQ=F`를 직접 받아 확인했다.
 *   `shortName`은 **31자에서 잘려** `30 Day Federal Funds Futures,Oc`로 온다.
 *   시세일은 2026-09-11(금), 가격 96.14 → 10월물 내재 평균 3.86%.
 */
const YAHOO_2026_09_11 = {
  shortName: "30 Day Federal Funds Futures,Oc",
  quoteDate: "2026-09-11",
  /** 가격 96.14 → 내재 평균금리 3.86%(표시 변환 `price100`이 하는 일). */
  impliedAvg: 100 - 96.14,
};

/** 캘린더(`MacroEvent`)에 실제로 들어 있는 2026년 하반기 FOMC 결정일. */
const MEETINGS = ["2026-09-16", "2026-10-28", "2026-12-09"];

describe("계약월 읽기 — 이름표가 잘려 온다", () => {
  it("9월 시세의 근월물은 10월물이다", () => {
    const c = resolveFrontContract(YAHOO_2026_09_11.shortName, YAHOO_2026_09_11.quoteDate)!;
    expect(c.month).toBe("2026-10");
    expect(c.ambiguous).toBe(false);
  });

  it("이름표가 이번 달에 붙으면 이번 달로 읽는다", () => {
    const c = resolveFrontContract("30 Day Federal Funds Futures,Se", "2026-09-11")!;
    expect(c.month).toBe("2026-09");
    expect(c.ambiguous).toBe(false);
  });

  it("12월이면 다음 달은 이듬해 1월이다", () => {
    expect(resolveFrontContract("… ,Ja", "2026-12-20")!.month).toBe("2027-01");
  });

  /**
   * ⚠ 두 글자로 가릴 수 없는 달은 **6월 하나뿐**이다(Jun/Jul 둘 다 `Ju`).
   *   나머지 열한 달은 이번 달·다음 달의 앞 두 글자가 갈린다 — 그 사실 자체를 못으로 박는다.
   */
  it("앞 두 글자가 겹치는 달은 6월뿐이다", () => {
    const collide: number[] = [];
    for (let m = 1; m <= 12; m++) {
      const next = m === 12 ? 1 : m + 1;
      if (monthPrefix(m) === monthPrefix(next)) collide.push(m);
    }
    expect(collide).toEqual([6]);
  });

  it("6월은 못 가렸다고 말한다", () => {
    const c = resolveFrontContract("30 Day Federal Funds Futures,Ju", "2026-06-15")!;
    expect(c.month).toBe("2026-07");
    expect(c.ambiguous).toBe(true);
  });

  /** ⚠ 어느 후보에도 안 붙으면 추측하지 않는다 — `^MOVE`가 다른 상품이었던 일과 같은 종류다. */
  it("두 후보 어느 쪽도 아니면 아무것도 내지 않는다", () => {
    expect(resolveFrontContract("30 Day Federal Funds Futures,De", "2026-09-11")).toBeUndefined();
    expect(resolveFrontContract("이름표가 없다", "2026-09-11")).toBeUndefined();
    expect(resolveFrontContract("… ,Oc", "2026-9-11")).toBeUndefined();
  });
});

describe("보조 계산", () => {
  it("결정은 이튿날부터 적용된다", () => {
    expect(effectiveDate("2026-09-16")).toBe("2026-09-17");
    expect(effectiveDate("2026-10-31")).toBe("2026-11-01");
  });

  it("달의 날수", () => {
    expect(daysInMonth("2026-10")).toBe(31);
    expect(daysInMonth("2026-02")).toBe(28);
    expect(daysInMonth("2028-02")).toBe(29);
  });
});

describe("내재 금리 — 2026-09-11 실측", () => {
  const contract = resolveFrontContract(YAHOO_2026_09_11.shortName, YAHOO_2026_09_11.quoteDate)!;
  const r = impliedFromFutures({
    impliedAvg: YAHOO_2026_09_11.impliedAvg,
    contractMonth: contract.month,
    currentRate: 3.63,
    meetings: MEETINGS,
    quoteDate: YAHOO_2026_09_11.quoteDate,
  })!;

  it("100 − 가격이 그 달 평균 내재금리다", () => {
    expect(r.impliedAvg).toBeCloseTo(3.86, 3);
  });

  it("10월 전에 열리는 9/16 회의만 온전히 반영된다", () => {
    expect(r.reflected).toEqual(["2026-09-16"]);
    expect(r.singleMeeting).toBe(true);
  });

  /** 10/28 결정은 10/29부터 — 10월 31일 중 3일(29·30·31)에 걸린다. */
  it("계약월 안의 10/28 회의는 변화 없음으로 두고, 그 몫을 말한다", () => {
    expect(r.assumedFlat).toEqual(["2026-10-28"]);
    expect(r.assumedWeight).toBeCloseTo(3 / 31, 6);
  });

  it("현재 금리와의 차이를 25bp로 나눈 비중을 낸다", () => {
    expect(r.impliedChange).toBeCloseTo(0.23, 3);
    expect(r.hikeShare).toBeCloseTo(0.92, 3);
  });

  it("한 문장 요약에 가정이 같이 들어간다", () => {
    const s = fedFuturesSentence(r);
    expect(s).toContain("3.860%");
    expect(s).toContain("2026-09-16");
    expect(s).toContain("92%");
    expect(s).toContain("변화 없음으로 가정");
    expect(s).toContain("CME 페드워치가 아니라");
  });
});

describe("⚠ 안 내는 경우", () => {
  const contractMonth = "2026-10";

  it("현재 금리를 모르면 계산하지 않는다", () => {
    expect(
      impliedFromFutures({
        impliedAvg: 100 - 96.14,
        contractMonth,
        currentRate: undefined,
        meetings: MEETINGS,
        quoteDate: "2026-09-11",
      }),
    ).toBeUndefined();
  });

  /** ⚠ 캘린더가 비면 「모른다」가 맞는 답이다. 현재 금리를 되풀이해 보여주지 않는다. */
  it("붙는 회의가 하나도 없으면 계산하지 않는다", () => {
    expect(
      impliedFromFutures({
        impliedAvg: 100 - 96.14,
        contractMonth,
        currentRate: 3.63,
        meetings: [],
        quoteDate: "2026-09-11",
      }),
    ).toBeUndefined();
  });

  it("지난 회의는 이미 현재 금리에 들어 있으므로 세지 않는다", () => {
    const r = impliedFromFutures({
      impliedAvg: 100 - 96.14,
      contractMonth,
      currentRate: 3.63,
      meetings: ["2026-09-16", "2026-10-28"],
      quoteDate: "2026-09-20",
    })!;
    expect(r.reflected).toEqual([]);
    expect(r.assumedFlat).toEqual(["2026-10-28"]);
    expect(r.singleMeeting).toBe(false);
  });

  it("반영된 회의가 둘 이상이면 하나의 몫으로 나누지 않는다", () => {
    const r = impliedFromFutures({
      impliedAvg: 100 - 95.9,
      contractMonth: "2027-01",
      currentRate: 3.63,
      meetings: ["2026-10-28", "2026-12-09"],
      quoteDate: "2026-09-11",
    })!;
    expect(r.reflected).toEqual(["2026-10-28", "2026-12-09"]);
    expect(r.singleMeeting).toBe(false);
    expect(fedFuturesSentence(r)).toContain("나눌 수 없습니다");
  });

  it("인하 쪽도 같은 식으로 읽는다", () => {
    const r = impliedFromFutures({
      impliedAvg: 100 - 96.62,
      contractMonth,
      currentRate: 3.63,
      meetings: ["2026-09-16"],
      quoteDate: "2026-09-11",
    })!;
    expect(r.impliedChange).toBeCloseTo(-0.25, 3);
    expect(r.hikeShare).toBeCloseTo(-1, 3);
    expect(fedFuturesSentence(r)).toContain("인하");
  });
});

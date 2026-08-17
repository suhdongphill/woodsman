import { describe, expect, it } from "vitest";
import {
  adminReportLink,
  buildReportIndex,
  findReportFor,
  isNonStock,
  publicReportHref,
  tickerKey,
  type ReportLinkEntry,
} from "./link";

const ENTRIES: ReportLinkEntry[] = [
  { ticker: "NVDA", name: "NVIDIA", status: "PUBLISHED" },
  { ticker: "005930", name: "삼성전자", status: "DRAFT" },
];
const INDEX = buildReportIndex(ENTRIES);

describe("tickerKey", () => {
  it("대소문자를 무시하려고 대문자로 맞춘다", () => {
    expect(tickerKey("nvda")).toBe("NVDA");
  });

  it("앞뒤 공백을 버린다 — 붙여넣기 공백 하나가 링크를 끊는다", () => {
    expect(tickerKey("  NVDA ")).toBe("NVDA");
  });

  it("⚠ 국내 티커의 앞자리 0을 지키지 않으면 종목이 바뀐다", () => {
    expect(tickerKey("005930")).toBe("005930");
  });

  it("비었으면 키가 없다", () => {
    expect(tickerKey("")).toBeUndefined();
    expect(tickerKey("   ")).toBeUndefined();
    expect(tickerKey(undefined)).toBeUndefined();
  });
});

describe("buildReportIndex", () => {
  it("티커로 찾을 수 있게 담는다", () => {
    expect(INDEX.get("NVDA")?.name).toBe("NVIDIA");
    expect(INDEX.get("005930")?.name).toBe("삼성전자");
  });

  it("같은 키가 겹치면 먼저 온 것을 남긴다", () => {
    const index = buildReportIndex([
      { ticker: "NVDA", name: "먼저", status: "PUBLISHED" },
      { ticker: "nvda", name: "나중", status: "DRAFT" },
    ]);
    expect(index.get("NVDA")?.name).toBe("먼저");
  });
});

describe("findReportFor", () => {
  it("대소문자가 달라도 찾는다", () => {
    expect(findReportFor({ ticker: "nvda" }, INDEX)?.name).toBe("NVIDIA");
  });

  it("없으면 undefined", () => {
    expect(findReportFor({ ticker: "TSLA" }, INDEX)).toBeUndefined();
  });

  it("티커가 없으면 찾지 않는다", () => {
    expect(findReportFor({ market: "KOSPI" }, INDEX)).toBeUndefined();
  });

  it("⚠ 현금성 자리는 잇지 않는다 — 엉뚱한 보고서가 붙는다", () => {
    expect(findReportFor({ ticker: "NVDA", market: "CASH" }, INDEX)).toBeUndefined();
    expect(findReportFor({ ticker: "NVDA", market: "bond" }, INDEX)).toBeUndefined();
  });
});

describe("isNonStock", () => {
  it("CASH·BOND를 대소문자 무시하고 본다", () => {
    expect(isNonStock({ market: "CASH" })).toBe(true);
    expect(isNonStock({ market: "cash" })).toBe(true);
    expect(isNonStock({ market: "BOND" })).toBe(true);
  });

  it("보통 거래소는 아니다", () => {
    expect(isNonStock({ market: "KOSPI" })).toBe(false);
    expect(isNonStock({})).toBe(false);
  });
});

describe("publicReportHref — ⚠ 발행본에만 링크한다", () => {
  it("발행된 보고서면 링크를 준다", () => {
    expect(publicReportHref({ ticker: "NVDA" }, INDEX)).toBe("/stocks/NVDA");
  });

  it("초안이면 링크를 주지 않는다 — /stocks는 발행본만 읽고 나머지는 404다", () => {
    expect(publicReportHref({ ticker: "005930" }, INDEX)).toBeUndefined();
  });

  it("보고서가 아예 없으면 링크를 주지 않는다 — 이게 404의 원인이었다", () => {
    expect(publicReportHref({ ticker: "TSLA" }, INDEX)).toBeUndefined();
  });
});

describe("adminReportLink", () => {
  it("보고서가 있으면 편집 화면으로 — 초안이어도 잇는다", () => {
    const link = adminReportLink({ ticker: "005930" }, INDEX);
    expect(link).toEqual({
      kind: "edit",
      href: "/admin/stocks/005930",
      status: "DRAFT",
      name: "삼성전자",
    });
  });

  it("없으면 만들러 가는 길을 준다", () => {
    expect(adminReportLink({ ticker: "TSLA" }, INDEX)).toEqual({
      kind: "create",
      href: "/admin/stocks",
    });
  });

  it("현금성 자리는 이유를 적어 준다", () => {
    const link = adminReportLink({ ticker: "CASH", market: "CASH" }, INDEX);
    expect(link.kind).toBe("none");
    if (link.kind === "none") expect(link.reason).toContain("현금성");
  });

  it("티커가 없으면 이유를 적어 준다", () => {
    const link = adminReportLink({ name: "예금" } as never, INDEX);
    expect(link.kind).toBe("none");
    if (link.kind === "none") expect(link.reason).toContain("티커");
  });
});

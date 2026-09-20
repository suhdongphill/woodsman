/**
 * 입력 계열 조립 — ⚠ **2026-09-20(54)에 데인 자리를 문장으로 고정한다.**
 * 첫 실계산에서 파생 지표 넷이 통째로 빠졌다. 원인은 산식이 아니라 **읽는 키**였다.
 */
import { describe, it, expect } from "vitest";
import { buildGcrmSeries, seriesKeysToRead, type MacroRow } from "./series";

const rows = (key: string, pts: [string, number][]): MacroRow[] =>
  pts.map(([date, value]) => ({ seriesKey: key, date, value }));

describe("seriesKeysToRead", () => {
  it("⚠ 파생 지표를 달라고 하면 성분 키까지 읽어 온다", () => {
    const keys = seriesKeysToRead(["fed_outlays_receipts"]);
    expect(keys).toContain("fed_outlays");
    expect(keys).toContain("fed_receipts");
  });

  it("⚠ baa_spread의 성분도 넓혀진다 — 빠지면 CREDIT 채널에 30년 이력이 사라진다", () => {
    expect(seriesKeysToRead(["baa_spread"])).toContain("baa_yield");
  });

  it("저장된 지표만 달라고 하면 그대로다", () => {
    expect(seriesKeysToRead(["fed_receipts"])).toContain("fed_receipts");
  });
});

describe("buildGcrmSeries", () => {
  it("저장된 계열은 날짜를 10자로 잘라 그대로 낸다", () => {
    const out = buildGcrmSeries(
      ["fed_receipts"],
      rows("fed_receipts", [
        ["2026-01-01T12:00:00.000Z", 4_500],
        ["2026-04-01T12:00:00.000Z", 4_600],
      ]),
    );
    expect(out.get("fed_receipts")).toEqual([
      { date: "2026-01-01", value: 4_500 },
      { date: "2026-04-01", value: 4_600 },
    ]);
  });

  it("★ 저장돼 있지 않은 파생은 성분에서 합성된다 — 지출 6,000 ÷ 세입 4,500 = 133.3%", () => {
    const out = buildGcrmSeries(
      ["fed_outlays_receipts"],
      [
        ...rows("fed_outlays", [["2026-01-01", 6_000]]),
        ...rows("fed_receipts", [["2026-01-01", 4_500]]),
      ],
    );
    const made = out.get("fed_outlays_receipts");
    expect(made).toHaveLength(1);
    expect(made![0].value).toBeCloseTo((6_000 / 4_500) * 100, 6);
  });

  it("⚠ 성분이 하나라도 없으면 **키 자체가 없다** — 빈 배열을 넣지 않는다", () => {
    const out = buildGcrmSeries(["fed_outlays_receipts"], rows("fed_outlays", [["2026-01-01", 6_000]]));
    // 「없다」가 「0이다」가 되면 안 된다. has()가 false여야 한다.
    expect(out.has("fed_outlays_receipts")).toBe(false);
  });

  it("⚠ 분모가 0인 날은 버린다 — 무한대는 값이 아니다", () => {
    const out = buildGcrmSeries(
      ["fed_outlays_receipts"],
      [...rows("fed_outlays", [["2026-01-01", 6_000]]), ...rows("fed_receipts", [["2026-01-01", 0]])],
    );
    expect(out.has("fed_outlays_receipts")).toBe(false);
  });

  it("행이 없으면 빈 Map이다", () => {
    expect(buildGcrmSeries(["fed_receipts"], []).size).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import { MACRO_INDICATORS } from "./catalog";
import { IMF_SOURCE_IDS, dateToImfQuarter, imfPeriodToDate, parseImfCsv } from "./imf";

// 2026-09-26 운영 응답의 앞머리와 같은 꼴(열은 줄였다 — 파서는 머리글 이름으로 찾는다)
const HEAD = "DATAFLOW,COUNTRY,INDICATOR,FXR_CURRENCY,TYPE_OF_TRANSFORMATION,FREQUENCY,TIME_PERIOD,OBS_VALUE,SCALE";
const row = (p: string, v: string) => `IMF.STA:COFER(7.0.1),G001,AFXRA,CI_USD,SHRO_PT,Q,${p},${v},`;

describe("IMF SDMX — COFER", () => {
  it("분기는 FRED와 같게 분기 첫날로 적는다", () => {
    expect(imfPeriodToDate("2026-Q1")).toBe("2026-01-01");
    expect(imfPeriodToDate("2025-Q4")).toBe("2025-10-01");
    expect(imfPeriodToDate("2025-07")).toBe("2025-07-01");
    expect(imfPeriodToDate("2025")).toBe("2025-01-01");
    expect(imfPeriodToDate("2025-W3")).toBeUndefined();
  });

  it("요청 범위는 날짜가 든 분기부터", () => {
    expect(dateToImfQuarter("2025-06-30")).toBe("2025-Q2");
    expect(dateToImfQuarter("1990-01-01")).toBe("1990-Q1");
  });

  it("머리글 이름으로 값을 찾고, 날짜순으로 돌려준다", () => {
    const csv = [HEAD, row("2026-Q1", "57.130786895752"), row("1999-Q1", "71.1888689871011")].join("\r\n");
    expect(parseImfCsv(csv)).toEqual([
      { date: "1999-01-01", value: 71.1888689871011 },
      { date: "2026-01-01", value: 57.130786895752 },
    ]);
  });

  it("빈 값·숫자 아닌 값은 결측으로 건너뛴다", () => {
    expect(parseImfCsv([HEAD, row("2025-Q4", ""), row("2026-Q1", "NaN"), row("2025-Q3", "56.6")].join("\n"))).toEqual([
      { date: "2025-07-01", value: 56.6 },
    ]);
  });

  it("⚠ 같은 날짜가 두 번이면 던진다 — 키가 여러 계열을 받았다", () => {
    expect(() => parseImfCsv([HEAD, row("2026-Q1", "57"), row("2026-Q1", "20")].join("\n"))).toThrow(/두 번/);
  });

  it("⚠ 설명문(따옴표)이 섞인 응답·열 없는 응답은 던진다", () => {
    expect(() => parseImfCsv(`${HEAD}\nIMF.STA:COFER(7.0.1),,,,,,,,"설명"`)).toThrow(/따옴표/);
    expect(() => parseImfCsv("A,B\n1,2")).toThrow(/TIME_PERIOD/);
  });

  it("⚠ 카탈로그의 IMF 지표는 수집기가 아는 소스 ID만 쓴다", () => {
    const known = new Set<string>(IMF_SOURCE_IDS);
    const imf = MACRO_INDICATORS.filter((i) => i.source === "IMF");
    expect(imf.length).toBeGreaterThan(0);
    for (const i of imf) expect(known.has(i.sourceId ?? ""), `${i.key} → ${i.sourceId}`).toBe(true);
  });
});

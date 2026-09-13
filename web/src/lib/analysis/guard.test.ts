/**
 * 그날의 분석 점검 — 픽스처는 **운영자가 준 9/13 Global Capital Regime Monitor 보고서의 실제 줄**이다.
 */
import { describe, expect, it } from "vitest";
import { findUnsourcedScores } from "./guard";

const REPORT_LINES = [
  "Global Liquidity Score: 52/100 →",
  "Market Risk & Geopolitical Stress: 74/100 ↑2",
  "현재 상황의 설명    Confidence",
  "Geopolitical Energy Supply Shock    98%",
  "ETF Institutional Flow    90%",
  "Brent는 금요일 $104.61, -2.81%, WTI는 $100.05, -2.37%로 내려왔습니다.",
  "Reserve balances: $2.991T",
  "8월 CPI는 +0.4% MoM, +3.4% YoY, core는 +0.3% MoM이었습니다.",
  "오늘의 한 줄 결론: 금융시장은 CPI 충격을 흡수했지만 중동의 실제 원유 공급망은 주말에 더 악화됐다.",
  "Engine Heat    95    94    ↑    CPI sticky + Brent $100+ + 공급경로 악화",
  "0.7 × 63 + 0.3 × 99 ≈ 74",
].join("\n");

describe("외부 보고서 점검 — 운영자 결정(산식 없는 점수 · Confidence % 제외)", () => {
  it("⭐ 산식 없는 점수 · Confidence · 퍼센트 표 줄 · 점수 표 줄 · 점수 가중 계산을 줄 번호와 함께 찾는다", () => {
    const f = findUnsourcedScores(REPORT_LINES);
    expect(f.map((x) => [x.line, x.kind])).toEqual([
      [1, "score_out_of_100"],
      [2, "score_out_of_100"],
      [3, "confidence"],
      [4, "percent_table_row"],
      [5, "percent_table_row"],
      [10, "score_table_row"],
      [11, "score_arithmetic"],
    ]);
  });

  it("⚠ 출처 있는 사실의 숫자(유가 −2.81% · 준비금 $2.991T · CPI +0.4%)는 건드리지 않는다", () => {
    const lines = findUnsourcedScores(REPORT_LINES).map((x) => x.line);
    expect(lines).not.toContain(6);
    expect(lines).not.toContain(7);
    expect(lines).not.toContain(8);
    expect(lines).not.toContain(9);
  });
});

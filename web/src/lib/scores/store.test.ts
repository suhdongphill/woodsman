import { describe, expect, it } from "vitest";
import { evaluationDates, toScoreRow } from "./store";
import { buildScoreSeries, historyStart, scoreIndicatorKeys, scoreSeriesKeys } from "./series-input";
import { findIndicator } from "../macro/catalog";
import type { ScoreResult } from "./engine";

describe("평가일", () => {
  it("⭐ 오늘(LIVE) · 4주 전 · 13주 전(RECOMPUTED) — 방향을 첫날부터 낸다", () => {
    expect(evaluationDates("2026-09-14")).toEqual([
      { asOf: "2026-09-14", basis: "LIVE" },
      { asOf: "2026-08-17", basis: "RECOMPUTED" },
      { asOf: "2026-06-15", basis: "RECOMPUTED" },
    ]);
  });

  it("읽는 구간은 가장 이른 평가일의 12년 전부터", () => {
    expect(historyStart("2026-06-15")).toBe("2014-06-15");
  });
});

describe("저장 행", () => {
  const base: ScoreResult = {
    scoreKey: "funding",
    label: "Funding",
    modelVersion: "v1.0",
    asOf: "2026-09-14",
    coverage: 35,
    state: "DO_NOT_PUBLISH",
    contributions: [{ key: "inverted_sofr_iorb", weight: 0.35, effectiveWeight: 1, score: 61.234, points: 61.234 }],
    components: [
      {
        key: "repo_stability",
        weight: 0.2,
        indicators: [],
        missingReason: "무료 출처 없음",
      },
    ],
  };

  it("⚠ 발행하지 않은 점수는 null이다 — 0점으로 저장하지 않는다", () => {
    const row = toScoreRow(base, "LIVE");
    expect(row.value).toBeNull();
    expect(row.state).toBe("DO_NOT_PUBLISH");
  });

  it("⚠ 결측 이유를 문장 그대로 남긴다", () => {
    const detail = JSON.parse(toScoreRow(base, "RECOMPUTED").detail);
    expect(detail.components[0].missingReason).toBe("무료 출처 없음");
    expect(detail.contributions[0].points).toBe(61.2);
  });
});

describe("점수 입력 계열", () => {
  it("⚠ 파생 지표는 성분을 함께 읽는다 — 파생은 DB에 자기 행이 없다", () => {
    const keys = scoreSeriesKeys();
    for (const k of ["baa_yield", "ust10y", "sofr", "iorb"]) expect(keys).toContain(k);
  });

  it("⚠ 측정에 쓰는 지표는 모두 카탈로그에 있다", () => {
    for (const k of scoreIndicatorKeys()) expect(findIndicator(k), k).toBeDefined();
  });

  it("⭐ 화면과 같은 변환 — 파생은 성분 변환 뒤 합성, 전년비는 카탈로그 변환", () => {
    const days = ["2025-09-10", "2026-09-09", "2026-09-10"];
    const raw = new Map([
      ["baa_yield", days.map((d, i) => ({ date: d, value: 6 + i }))],
      ["ust10y", days.map((d) => ({ date: d, value: 4 }))],
    ]);
    const series = buildScoreSeries(raw);
    expect(series.get("baa_spread")?.points.at(-1)).toEqual({ date: "2026-09-10", value: 4 });
    expect(series.get("baa_spread")?.freq).toBe(findIndicator("baa_spread")!.freq);
    // 값이 없는 지표는 넣지 않는다 — 엔진이 「수집 전」으로 센다
    expect(series.has("reserves")).toBe(false);
  });
});

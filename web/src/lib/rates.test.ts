import { describe, expect, it } from "vitest";
import {
  bounds,
  formatMetric,
  latestObservation,
  linePath,
  staleness,
  tail,
  type RatesObservation,
  type RatesSeries,
} from "./rates";

const x = (i: number) => i * 10;
const y = (v: number) => 100 - v;

function series(observations: RatesObservation[]): RatesSeries {
  return {
    name_ko: "테스트",
    unit: "percent",
    frequency: "M",
    layer: "policy",
    definition_ko: "설명",
    source_url: "https://example.com",
    last_obs_date: observations[observations.length - 1]?.[0] ?? null,
    observations,
  };
}

describe("결측을 다루는 법", () => {
  /**
   * ⚠ 이 테스트가 이 모듈의 존재 이유다. 결측 구간을 이어 그리면 발표되지 않은 달에 값이
   *    있었던 것처럼 보인다 — 화면이 하는 거짓말 중 가장 눈에 안 띄는 종류다.
   */
  it("⚠ 결측에서 선을 끊는다 — 이어 그리지 않는다", () => {
    const path = linePath(
      [
        ["2026-01-01", 10],
        ["2026-02-01", null],
        ["2026-03-01", 30],
      ],
      x,
      y,
    );
    // M … (끊김) M … — 두 번째 구간이 L이 아니라 M으로 시작해야 한다.
    expect(path).toBe("M0.0,90.0 M20.0,70.0");
    expect(path).not.toContain("L20.0");
  });

  it("값이 이어지면 하나의 선이다", () => {
    expect(
      linePath(
        [
          ["2026-01-01", 10],
          ["2026-02-01", 20],
        ],
        x,
        y,
      ),
    ).toBe("M0.0,90.0 L10.0,80.0");
  });

  it("⚠ 결측은 0이 아니라 「—」로 적는다", () => {
    expect(formatMetric(null, "percent")).toBe("—");
    expect(formatMetric(undefined, "index")).toBe("—");
    expect(formatMetric(Number.NaN, "percent")).toBe("—");
    expect(formatMetric(0, "percent")).toBe("0.00%");
  });

  it("마지막 값이 결측이면 그 앞의 관측을 돌려준다 — 지어내지 않는다", () => {
    expect(
      latestObservation(
        series([
          ["2026-01-01", 10],
          ["2026-02-01", null],
        ]),
      ),
    ).toEqual(["2026-01-01", 10]);
  });

  it("값이 하나도 없으면 null이다", () => {
    expect(latestObservation(series([["2026-01-01", null]]))).toBeNull();
  });

  it("축 범위 계산에서 결측을 빼고, 기준선은 포함한다", () => {
    const { min, max } = bounds([10, null, 20], [0]);
    expect(min).toBeLessThan(0);
    expect(max).toBeGreaterThan(20);
  });
});

describe("표시 규칙", () => {
  it("단위별 자릿수", () => {
    expect(formatMetric(1.348, "percent")).toBe("1.35%");
    expect(formatMetric(64.152, "index")).toBe("64.2");
    expect(formatMetric(-0.42, "correlation")).toBe("-0.42");
    expect(formatMetric(4, "count")).toBe("4");
  });

  it("최근 N개월만 자른다", () => {
    const rows: RatesObservation[] = [
      ["2025-01-01", 1],
      ["2026-06-01", 2],
      ["2026-08-01", 3],
    ];
    expect(tail(rows, 6).map((r) => r[0])).toEqual(["2026-06-01", "2026-08-01"]);
  });

  /** ⚠ 오래된 값을 최신인 것처럼 보여주지 않는다(명세 §7). */
  it("데이터가 며칠 묵었는지 센다", () => {
    expect(
      staleness(
        {
          asof: "2026-09-01",
          generated_at: "",
          schema_version: 1,
          partial: false,
          missing_series: [],
        },
        "2026-09-05",
      ),
    ).toBe(4);
  });
});

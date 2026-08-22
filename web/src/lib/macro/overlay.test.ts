import { describe, expect, it } from "vitest";
import {
  OVERLAY_MAX,
  buildOverlay,
  canOverlayRaw,
  normalize,
  overlayTable,
  parseOverlayKeys,
  rebase100,
  resolveMode,
  sliceYears,
  zscore,
  type OverlayInput,
} from "./overlay";
import type { SeriesPoint } from "./series";

const NOW = new Date("2026-08-22T00:00:00.000Z");

const pts = (...vals: [string, number][]): SeriesPoint[] =>
  vals.map(([date, value]) => ({ date, value }));

const series = (key: string, unit: string, points: SeriesPoint[]): OverlayInput => ({
  key,
  label: key,
  unit,
  points,
});

describe("계열 고르기", () => {
  it("모르는 키는 버린다 — 있는 척하지 않는다", () => {
    expect(parseOverlayKeys("ust10y,없는키,dxy", ["ust10y", "dxy"])).toEqual(["ust10y", "dxy"]);
  });

  it("중복은 한 번만, 개수는 상한에서 자른다", () => {
    const valid = ["a", "b", "c", "d", "e"];
    expect(parseOverlayKeys("a,a,b", valid)).toEqual(["a", "b"]);
    expect(parseOverlayKeys("a,b,c,d,e", valid)).toHaveLength(OVERLAY_MAX);
  });

  it("비어 있으면 빈 목록", () => {
    expect(parseOverlayKeys(null, ["a"])).toEqual([]);
  });
});

describe("⚠ 이중축 금지 (볼트 사양서 1-2)", () => {
  it("단위가 같을 때만 원값으로 겹칠 수 있다", () => {
    expect(canOverlayRaw(["%", "%"])).toBe(true);
    expect(canOverlayRaw(["%", "$"])).toBe(false);
    expect(canOverlayRaw([])).toBe(false);
  });

  it("⚠ 단위가 다르면 원값 요청을 조용히 그려 주지 않고 환산하고 이유를 밝힌다", () => {
    const r = resolveMode("raw", ["%", "$"]);
    expect(r.mode).toBe("rebase");
    expect(r.changed).toContain("축을 두 개");
  });

  it("환산 모드는 단위와 무관하게 그대로 쓴다", () => {
    expect(resolveMode("zscore", ["%", "$"])).toEqual({ mode: "zscore" });
  });
});

describe("척도 환산", () => {
  it("기준=100은 시작점을 100으로 맞춘다", () => {
    expect(rebase100(pts(["2026-01-01", 50], ["2026-02-01", 75]))).toEqual(
      pts(["2026-01-01", 100], ["2026-02-01", 150]),
    );
  });

  it("⚠ 첫 값이 0이나 음수면 기준=100이 성립하지 않는다 — 억지로 그리지 않는다", () => {
    expect(rebase100(pts(["2026-01-01", 0], ["2026-02-01", 1]))).toEqual([]);
    expect(rebase100(pts(["2026-01-01", -0.5], ["2026-02-01", 0.2]))).toEqual([]);
  });

  it("⚠ 되지 않는 환산은 원값으로 떨어지지 않고 표준화로 올라간다", () => {
    // 금리차처럼 음수로 시작하는 계열
    const out = normalize(pts(["2026-01-01", -0.5], ["2026-02-01", 0.5]), "rebase");
    expect(out).toHaveLength(2);
    expect(out[0].value).toBeLessThan(0);
    expect(out[1].value).toBeGreaterThan(0);
  });

  it("표준화는 평균 0 표준편차 1", () => {
    const out = zscore(pts(["a", 1], ["b", 2], ["c", 3]));
    expect(out.map((p) => p.value)).toEqual([-Math.SQRT2 / Math.SQRT2 * 1.224744871391589, 0, 1.224744871391589]);
  });

  it("전부 같은 값이면 전부 0이다 — 평평해도 거짓말은 아니다", () => {
    expect(zscore(pts(["a", 5], ["b", 5])).map((p) => p.value)).toEqual([0, 0]);
  });
});

describe("기간 자르기", () => {
  it("최근 N년만 남는다", () => {
    const out = sliceYears(pts(["2015-01-01", 1], ["2025-01-01", 2], ["2026-08-01", 3]), 3, NOW);
    expect(out.map((p) => p.date)).toEqual(["2025-01-01", "2026-08-01"]);
  });
});

describe("오버레이 조립", () => {
  const a = series("a", "%", pts(["2026-01-01", 10], ["2026-06-01", 12], ["2026-08-01", 11]));
  const b = series("b", "$", pts(["2026-01-01", 100], ["2026-06-01", 90], ["2026-08-01", 95]));

  it("단위가 다르면 환산하고 이유를 남긴다", () => {
    const r = buildOverlay({ series: [a, b], mode: "raw", years: 3, now: NOW });
    expect(r.mode).toBe("rebase");
    expect(r.modeNotice).toBeTruthy();
    expect(r.lines).toHaveLength(2);
    expect(r.lines[0].points[0].value).toBe(100);
  });

  it("단위가 같으면 원값 그대로 간다", () => {
    const a2 = series("a2", "%", pts(["2026-01-01", 3], ["2026-08-01", 4]));
    const r = buildOverlay({ series: [a, a2], mode: "raw", years: 3, now: NOW });
    expect(r.mode).toBe("raw");
    expect(r.modeNotice).toBeUndefined();
    expect(r.lines[0].points[0].value).toBe(10);
  });

  it("표에는 사람이 아는 원값을 낸다 — 환산값만 주면 읽을 수 없다", () => {
    const r = buildOverlay({ series: [b], mode: "rebase", years: 3, now: NOW });
    expect(r.lines[0].rawLast).toBe(95);
    expect(r.lines[0].changePct).toBeCloseTo(-5, 5);
  });

  it("점이 모자란 계열은 그리지 않고 이름을 남긴다 — 조용히 빠지지 않는다", () => {
    const thin = series("thin", "%", pts(["2026-08-01", 1]));
    const r = buildOverlay({ series: [a, thin], mode: "rebase", years: 3, now: NOW });
    expect(r.lines).toHaveLength(1);
    expect(r.tooShort).toEqual(["thin"]);
  });

  it("구간을 밝힌다", () => {
    const r = buildOverlay({ series: [a], mode: "raw", years: 3, now: NOW });
    expect(r.from).toBe("2026-01-01");
    expect(r.to).toBe("2026-08-01");
  });
});

describe("표로 보기 — 색만으로 식별하지 않기 위한 대체 표현", () => {
  it("날짜별로 계열 값을 나란히 편다. 없는 날은 빈칸이다", () => {
    const r = buildOverlay({
      series: [
        series("a", "%", pts(["2026-01-01", 1], ["2026-02-01", 2], ["2026-03-01", 3])),
        // ⚠ 시작이 늦은 계열 — 앞 구간은 빈칸이어야 한다(0으로 채우면 없는 사건이 생긴다)
        series("b", "%", pts(["2026-02-01", 9], ["2026-03-01", 8])),
      ],
      mode: "raw",
      years: 3,
      now: NOW,
    });
    const table = overlayTable(r.lines, 10);
    expect(table).toEqual([
      { date: "2026-01-01", values: [1, undefined] },
      { date: "2026-02-01", values: [2, 9] },
      { date: "2026-03-01", values: [3, 8] },
    ]);
  });
});

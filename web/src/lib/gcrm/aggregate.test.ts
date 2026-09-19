/**
 * GCRM v2 — 시간축 합성 · 유효 가중치 · 기둥 집계 테스트 (명세 §2-4 ~ §2-6 · 단계 4).
 *
 * ⚠ 이 단계에서 가장 틀리기 쉬운 셋을 기계가 지킨다.
 * 1. `horizon_weight`를 `effective_weight`에 다시 곱하는 이중 계산 (B-6)
 * 2. 저빈도 지표를 쓸 수 없는 축에 올리는 것
 * 3. 커버리지를 **개수 비율**로 세는 것 — 가중치 비율이어야 한다
 */
import { describe, it, expect } from "vitest";
import type { SeriesPoint } from "@/lib/macro/series";
import { axisScore, allAxes, rollingMeans } from "./horizon";
import { stalenessOf, effectiveWeight, daysBetween } from "./weights";
import { computePillarAxis, computeAxis, type IndicatorInput } from "./pillar";
import { flattenPillar, designWeightSum, type GcrmPillar } from "./config/pillars";
import type { NormalizeSpec } from "./normalize";
import { HORIZON_WEIGHTS, GATES, STALENESS_FACTOR, CYCLE_DAYS, STALENESS_CYCLES, HORIZON_GUARD } from "./config/model";
import { STALE_RULE } from "@/lib/macro/freshness";

function dates(n: number, start = "2000-01-01"): string[] {
  const base = Date.parse(`${start}T00:00:00Z`);
  return Array.from({ length: n }, (_, i) =>
    new Date(base + i * 86_400_000).toISOString().slice(0, 10),
  );
}
function series(values: number[], start = "2000-01-01"): SeriesPoint[] {
  const ds = dates(values.length, start);
  return values.map((value, i) => ({ date: ds[i], value }));
}

const SPEC: NormalizeSpec = {
  portalTransform: "level",
  transform: "level",
  polarity: 1,
  scaler: "pct_rank",
  window: "expanding",
  minObs: 100,
  maxWindow: 5000,
  winsor: [0, 1],
};
const spec = (over: Partial<NormalizeSpec> = {}): NormalizeSpec => ({ ...SPEC, ...over });

/** 3,000점짜리 진동 계열 — 12개월 창도 독립 관측 10개를 넘는다(3000 ÷ 252 ≈ 11). */
const LONG = series(Array.from({ length: 3000 }, (_, i) => 50 + Math.sin(i / 23) * 10 + i * 0.002));
const LAST = LONG[LONG.length - 1].date;

// ─────────────────────────────────────────────────────────────────────────
describe("§2-4 시간축 합성", () => {
  it("이동 평균의 개수와 값이 맞는다", () => {
    expect(rollingMeans([1, 2, 3, 4, 5], 1)).toEqual([1, 2, 3, 4, 5]);
    expect(rollingMeans([1, 2, 3, 4, 5], 3)).toEqual([2, 3, 4]);
    expect(rollingMeans([1, 2], 5)).toEqual([]);
  });

  it("조류는 네 창, 바람은 세 창, 파도는 세 창을 쓴다", () => {
    const tide = axisScore(LONG, spec(), "d", "tide", LAST);
    const wind = axisScore(LONG, spec(), "d", "wind", LAST);
    const wave = axisScore(LONG, spec(), "d", "wave", LAST);
    expect(tide.status).toBe("OK");
    if (tide.status !== "OK") return;
    expect(tide.horizons.map((h) => h.key)).toEqual(["M1", "M3", "M6", "M12"]);
    expect(wind.status === "OK" && wind.horizons.map((h) => h.key)).toEqual(["W1", "W4", "W13"]);
    expect(wave.status === "OK" && wave.horizons.map((h) => h.key)).toEqual(["D1", "D3", "D5"]);
  });

  it("창 가중치대로 합성한다", () => {
    const r = axisScore(LONG, spec(), "d", "tide", LAST);
    expect(r.status).toBe("OK");
    if (r.status !== "OK") return;
    const ok = r.horizons.filter((h) => h.status === "OK") as Extract<
      (typeof r.horizons)[number],
      { status: "OK" }
    >[];
    const expected =
      ok.reduce((s, h) => s + h.weight * h.value, 0) / ok.reduce((s, h) => s + h.weight, 0);
    expect(r.pctRank).toBeCloseTo(expected, 10);
    expect(r.horizonCoverage).toBeCloseTo(1, 10);
  });

  it("⚠ 못 쓰는 창은 0이 아니라 분모에서 빠진다 — 남은 창으로 재정규화한다", () => {
    // 700점이면 M1(21)·M3(63)는 독립 관측 10개를 넘지만 M6(126)·M12(252)는 못 넘는다
    const short = series(Array.from({ length: 700 }, (_, i) => Math.sin(i / 11) * 5 + i * 0.01));
    const r = axisScore(short, spec(), "d", "tide", short[short.length - 1].date);
    expect(r.status).toBe("OK");
    if (r.status !== "OK") return;
    expect(r.horizons.find((h) => h.key === "M12")!.status).toBe("MISSING");
    expect(r.horizons.find((h) => h.key === "M6")!.status).toBe("MISSING");
    // M1·M3만 남으면 0.35+0.30 = 0.65
    expect(r.horizonCoverage).toBeCloseTo(0.65, 10);
    // 재정규화됐으므로 0으로 끌려 내려가지 않았다
    expect(r.pctRank).toBeGreaterThan(0);
    expect(r.pctRank).toBeLessThanOrEqual(100);
  });

  it("⚠ 겹치지 않는 창이 모자라면 그 창을 쓰지 않는다 — 창이 많아 보여도 독립 관측은 적다", () => {
    const short = series(Array.from({ length: 400 }, (_, i) => Math.sin(i / 11) * 5));
    const r = axisScore(short, spec(), "d", "tide", short[short.length - 1].date);
    // 남은 창이 M1뿐(0.35)이라 축 자체가 MISSING이다 — 그래도 창별 사유는 남는다
    expect(r.status).toBe("MISSING");
    if (r.status !== "MISSING") return;
    expect(r.reason).toBe("THIN_WINDOWS");
    const m12 = r.horizons.find((h) => h.key === "M12")!;
    expect(m12.status).toBe("MISSING");
    if (m12.status !== "MISSING") return;
    // 창 자체는 149개나 나온다(400−252+1) — 개수로 판정했으면 통과했을 것이다
    expect(m12.reason).toContain("겹치지 않는 창");
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe("§2-4 ⚠ 저빈도 지표를 억지로 올리지 않는다", () => {
  const quarterly = series(Array.from({ length: 200 }, (_, i) => 100 + Math.sin(i / 3) * 8));

  it("분기 지표는 조류에만 참여한다", () => {
    const last = quarterly[quarterly.length - 1].date;
    const axes = allAxes(quarterly, spec({ minObs: 20 }), "q", last);
    expect(axes.tide.status).toBe("OK");
    expect(axes.wind.status).toBe("MISSING");
    expect(axes.wave.status).toBe("MISSING");
    if (axes.wind.status !== "MISSING") return;
    expect(axes.wind.reason).toBe("NOT_APPLICABLE");
  });

  it("주간 지표는 조류·바람에만 참여한다", () => {
    const last = quarterly[quarterly.length - 1].date;
    const axes = allAxes(quarterly, spec({ minObs: 20 }), "w", last);
    expect(axes.tide.status).toBe("OK");
    expect(axes.wind.status).toBe("OK");
    expect(axes.wave.status).toBe("MISSING");
  });

  it("⚠ 분기 지표에는 1개월 창이 없다 — 남은 창으로 재정규화한다", () => {
    const last = quarterly[quarterly.length - 1].date;
    const r = axisScore(quarterly, spec({ minObs: 20 }), "q", "tide", last);
    expect(r.status).toBe("OK");
    if (r.status !== "OK") return;
    const m1 = r.horizons.find((h) => h.key === "M1")!;
    expect(m1.status).toBe("MISSING");
    // M3·M6·M12만 남는다 → 0.30+0.20+0.15 = 0.65
    expect(r.horizonCoverage).toBeCloseTo(0.65, 10);
  });

  it("결측 축은 0점이 아니다 — 점수 칸 자체가 없다", () => {
    const axes = allAxes(quarterly, spec({ minObs: 20 }), "q", quarterly[quarterly.length - 1].date);
    expect(axes.wave).not.toHaveProperty("score");
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe("⚠ 같은 숫자를 두 곳에 적었으면 테스트가 대조한다 (CLAUDE.md §2-1)", () => {
  it("포털이 먼저 「묵음」을 띄우고, 그보다 더 지나야 GCRM이 계산에서 뺀다", () => {
    for (const f of ["d", "w", "m", "q"] as const) {
      const gcrmDrops = STALENESS_CYCLES.twoCyclesLate * CYCLE_DAYS[f];
      expect(gcrmDrops, `${f}: GCRM 제외 ${gcrmDrops}일 vs 포털 경고 ${STALE_RULE[f]}일`).toBeGreaterThanOrEqual(
        STALE_RULE[f],
      );
    }
  });

  it("⚠ 겹침 가드는 실제로 무언가를 걸러야 한다 — 걸리지 않는 문턱은 근거도 일도 없다", () => {
    // 2026-09-19: minNonOverlap을 3으로 뒀을 때 어떤 지표의 어떤 창도 걸리지 않았다.
    // 5점 단위로 반올림해 보여 주므로 백분위는 최소 십분위를 가릴 수 있어야 한다.
    expect(HORIZON_GUARD.minNonOverlap).toBeGreaterThanOrEqual(10);
  });
});

describe("§2-5 유효 가중치", () => {
  it("날짜 차이를 센다", () => {
    expect(daysBetween("2026-09-01", "2026-09-19")).toBe(18);
  });

  it("신선도는 공표 주기 기준이다 — 같은 5일이 주기마다 다르다", () => {
    // 일간(주기 4일): 5일 지나면 1.25주기 → 한 주기 경과
    expect(stalenessOf("d", "2026-09-14", "2026-09-19")).toMatchObject({
      status: "OK",
      factor: STALENESS_FACTOR.oneCycleLate,
    });
    // 분기(주기 92일): 5일은 0.05주기 → 최신
    expect(stalenessOf("q", "2026-09-14", "2026-09-19")).toMatchObject({
      status: "OK",
      factor: STALENESS_FACTOR.fresh,
    });
  });

  it("⚠ 세 주기 이상 지나면 작은 계수가 아니라 MISSING이다", () => {
    const s = stalenessOf("d", "2026-08-01", "2026-09-19"); // 49일 = 12주기
    expect(s.status).toBe("MISSING");
  });

  it("⚠ 관측일이 기준일보다 뒤면 미래 값이다 — 계수를 주지 않는다", () => {
    const s = stalenessOf("m", "2026-10-01", "2026-09-19");
    expect(s.status).toBe("MISSING");
    if (s.status !== "MISSING") return;
    expect(s.detail).toContain("미래");
  });

  it("⚠ horizon_weight는 유효 가중치에 들어가지 않는다 (B-6 이중 계산)", () => {
    const fresh = stalenessOf("d", "2026-09-19", "2026-09-19");
    const { effWeight } = effectiveWeight(0.2, fresh, "official");
    // base 0.20 × staleness 1.00 × evidence 1.00 = 0.20. 창 가중치가 곱해지면 0.07~0.09가 된다
    expect(effWeight).toBeCloseTo(0.2, 12);
    for (const w of Object.values(HORIZON_WEIGHTS.tide)) {
      expect(effWeight).not.toBeCloseTo(0.2 * w, 6);
    }
  });

  it("evidence가 낮으면 유효 가중치도 낮다", () => {
    const fresh = stalenessOf("d", "2026-09-19", "2026-09-19");
    expect(effectiveWeight(0.2, fresh, "market").effWeight).toBeCloseTo(0.19, 12);
    expect(effectiveWeight(0.2, fresh, "judgment").effWeight).toBeCloseTo(0.14, 12);
  });

  it("⚠ presence_weight에는 신선도가 들어가지 않는다 — 커버리지 분모가 흔들리면 안 된다", () => {
    const stale = stalenessOf("d", "2026-09-10", "2026-09-19");
    const fresh = stalenessOf("d", "2026-09-19", "2026-09-19");
    expect(effectiveWeight(0.2, stale, "official").presenceWeight).toBe(
      effectiveWeight(0.2, fresh, "official").presenceWeight,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe("§2-6 기둥 집계와 커버리지 게이트", () => {
  /** 지표 12개, 설계 가중치 합 1.00. 앞 여섯이 0.52, 뒤 여섯이 0.48. */
  const W = [0.12, 0.1, 0.1, 0.08, 0.07, 0.05, 0.1, 0.1, 0.09, 0.08, 0.06, 0.05];
  const CODES = W.map((_, i) => `x${i + 1}`);

  const PILLAR: GcrmPillar = {
    code: "risk_transmission_demo",
    nameKo: "위험 전이(예시)",
    polarity: "stress",
    axisWeight: 1,
    summaryWeights: { tide: 0.5, wind: 0.35, wave: 0.15 },
    from: "명세 Part 3 예시 4 재현용",
    members: Object.fromEntries(
      CODES.map((c, i) => [c, { kind: "indicators" as const, weight: W[i], indicators: [c] }]),
    ),
  };

  const FRESH = stalenessOf("d", "2026-09-19", "2026-09-19");
  const input = (code: string, score?: number): IndicatorInput => ({
    code,
    score,
    polarity: 1,
    evidence: "official",
    staleness: FRESH,
    enabled: true,
    ...(score === undefined ? { missingReason: "시험용 결측" } : {}),
  });

  /** `missing`에 든 코드만 결측으로 만든다. 나머지는 전부 60점. */
  const inputs = (missing: string[] = []) =>
    new Map(CODES.map((c) => [c, input(c, missing.includes(c) ? undefined : 60)]));

  it("예시 기둥의 설계 가중치 합이 1.00이다", () => {
    expect(designWeightSum(PILLAR)).toBeCloseTo(1, 10);
    expect(flattenPillar(PILLAR)).toHaveLength(12);
  });

  it("전부 있으면 커버리지가 1.00이다", () => {
    const r = computePillarAxis(PILLAR, "tide", inputs());
    expect(r.status).toBe("OK");
    expect(r.coverage).toBeCloseTo(1, 10);
    expect(r.nUsed).toBe(12);
    expect(r.nTotal).toBe(12);
  });

  it("★ 명세 예시 4 — 12개 중 6개만 쓰면 커버리지 0.52, INSUFFICIENT", () => {
    const r = computePillarAxis(PILLAR, "tide", inputs(CODES.slice(6)));
    expect(r.coverage).toBeCloseTo(0.52, 10);
    expect(r.status).toBe("INSUFFICIENT");
    expect(r.nUsed).toBe(6);
    expect(r.nTotal).toBe(12);
  });

  it("★ INSUFFICIENT는 0이 아니다 — 점수 칸 자체가 없다", () => {
    const r = computePillarAxis(PILLAR, "tide", inputs(CODES.slice(6)));
    expect(r.scoreRaw).toBeUndefined();
    expect(r.scoreOri).toBeUndefined();
  });

  it("★ 결측 지표를 하나 늘릴 때마다 커버리지가 정확히 그 지표의 유효 가중치만큼 준다", () => {
    let expected = 1;
    const missing: string[] = [];
    for (let i = 0; i < CODES.length; i++) {
      missing.push(CODES[i]);
      expected -= W[i];
      const r = computePillarAxis(PILLAR, "tide", inputs(missing));
      expect(r.coverage, `${i + 1}개 결측`).toBeCloseTo(expected, 10);
    }
    expect(expected).toBeCloseTo(0, 10);
  });

  it("⚠ 커버리지는 개수 비율이 아니라 가중치 비율이다", () => {
    // 가장 무거운 하나(0.12)만 빠져도 11/12 = 0.917이 아니라 0.88이다
    const r = computePillarAxis(PILLAR, "tide", inputs(["x1"]));
    expect(r.coverage).toBeCloseTo(0.88, 10);
    expect(r.coverage).not.toBeCloseTo(11 / 12, 3);
  });

  it("게이트 경계에서 갈린다", () => {
    // x7(0.10)+x8(0.10)+x9(0.09)+x10(0.08)+x11(0.06) = 0.43 결측 → 0.57 < 0.60
    const below = computePillarAxis(PILLAR, "tide", inputs(["x7", "x8", "x9", "x10", "x11"]));
    expect(below.coverage).toBeCloseTo(0.57, 10);
    expect(below.status).toBe("INSUFFICIENT");
    // x11(0.06) 하나를 되살리면 0.63 ≥ 0.60
    const above = computePillarAxis(PILLAR, "tide", inputs(["x7", "x8", "x9", "x10"]));
    expect(above.coverage).toBeCloseTo(0.63, 10);
    expect(above.status).toBe("OK");
    expect(GATES.pillarMinCoverage).toBe(0.6);
  });

  it("⚠ 스트레스 기둥은 raw와 oriented가 뒤집혀 있다", () => {
    const r = computePillarAxis(PILLAR, "tide", inputs());
    expect(r.status).toBe("OK");
    if (r.status !== "OK") return;
    expect(r.scoreOri).toBeCloseTo(60, 10); // 지표 점수(우호 방향)의 가중 평균
    expect(r.scoreRaw).toBeCloseTo(40, 10); // 화면이 보는 값 — 위험이 낮다
    expect(r.scoreRaw! + r.scoreOri!).toBeCloseTo(100, 10);
  });

  it("빠진 것과 그 사유를 함께 돌려준다 — 보이지 않으면 설명이 아니다", () => {
    const r = computePillarAxis(PILLAR, "tide", inputs(["x1", "x2"]));
    expect(r.excluded.map((e) => e.indicator)).toEqual(["x1", "x2"]);
    expect(r.excluded[0].kind).toBe("MISSING");
    expect(r.excluded[0].reason).toBe("시험용 결측");
    expect(r.excluded[0].presenceWeight).toBeCloseTo(0.12, 10);
  });

  it("기여도는 유효 가중치 내림차순이다", () => {
    const r = computePillarAxis(PILLAR, "tide", inputs());
    const ws = r.contributions.map((c) => c.effWeight);
    expect([...ws].sort((a, b) => b - a)).toEqual(ws);
    expect(r.contributions[0].indicator).toBe("x1");
  });

  it("묵은 값은 점수 평균에서 덜 세지만 커버리지는 깎지 않는다", () => {
    const stale = stalenessOf("d", "2026-09-14", "2026-09-19"); // 0.70
    const map = inputs();
    map.set("x1", { ...input("x1", 100), staleness: stale });
    const r = computePillarAxis(PILLAR, "tide", map);
    expect(r.status).toBe("OK");
    if (r.status !== "OK") return;
    expect(r.coverage).toBeCloseTo(1, 10); // ⚠ 신선도는 커버리지에 들어가지 않는다
    const c = r.contributions.find((x) => x.indicator === "x1")!;
    expect(c.effWeight).toBeCloseTo(0.12 * 0.7, 10);
    expect(c.presenceWeight).toBeCloseTo(0.12, 10);
  });

  it("⚠ 못 채우는 자리(unavailable)도 분모에 남는다", () => {
    const withGap: GcrmPillar = {
      ...PILLAR,
      members: {
        a: { kind: "indicators", weight: 0.7, indicators: ["x1"] },
        gap: { kind: "unavailable", weight: 0.3, reason: "무료 출처 없음" },
      },
    };
    const r = computePillarAxis(withGap, "tide", new Map([["x1", input("x1", 50)]]));
    expect(r.coverage).toBeCloseTo(0.7, 10); // 1.00이 아니다
    expect(r.excluded.find((e) => e.kind === "UNAVAILABLE")?.presenceWeight).toBeCloseTo(0.3, 10);
  });

  it("⚠ 기둥이 부호를 덮어쓰면 점수를 되돌린다", () => {
    const flipped: GcrmPillar = {
      ...PILLAR,
      polarity: "favorable",
      members: {
        a: {
          kind: "indicators",
          weight: 1,
          indicators: ["x1"],
          polarity: 1,
          polarityReason: "시험",
        },
      },
    };
    // 지표 자신은 −1인데 기둥이 +1로 덮어썼다 → 70점이 30점으로 들어간다
    const r = computePillarAxis(
      flipped,
      "tide",
      new Map([["x1", { ...input("x1", 70), polarity: -1 as const }]]),
    );
    expect(r.status).toBe("OK");
    if (r.status !== "OK") return;
    expect(r.scoreOri).toBeCloseTo(30, 10);
    expect(r.contributions[0].polarityFlipped).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe("§2-6 축 집계 — INSUFFICIENT 기둥은 분모에서 빠진다", () => {
  const mk = (code: string, axisWeight: number): GcrmPillar => ({
    code,
    nameKo: code,
    polarity: "favorable",
    axisWeight,
    summaryWeights: { tide: 0.5, wind: 0.35, wave: 0.15 },
    from: "시험",
    members: { a: { kind: "indicators", weight: 1, indicators: [`${code}_i`] } },
  });
  const P = [mk("p1", 0.5), mk("p2", 0.3), mk("p3", 0.2)];

  const res = (
    pillar: string,
    status: "OK" | "INSUFFICIENT",
    score: number,
    coverage: number,
    axis: "tide" | "wind" | "wave" = "tide",
  ) => ({
    pillar,
    axis,
    status,
    ...(status === "OK" ? { scoreRaw: score, scoreOri: score } : {}),
    coverage,
    nUsed: 1,
    nTotal: 1,
    contributions: [],
    excluded: [],
    notApplicable: [],
  });

  it("⚠ 자료 부족 기둥을 0점으로 넣지 않는다", () => {
    const withGap = computeAxis(P, [
      res("p1", "OK", 80, 1),
      res("p2", "OK", 60, 1),
      res("p3", "INSUFFICIENT", 0, 0.3),
    ], "tide");
    // 0을 넣었다면 (0.5×80 + 0.3×60 + 0.2×0) / 1.0 = 58
    // 분모에서 빼면 (0.5×80 + 0.3×60) / 0.8 = 72.5
    expect(withGap.score).toBeCloseTo(72.5, 10);
    expect(withGap.used).toEqual(["p1", "p2"]);
    expect(withGap.dropped.map((d) => d.pillar)).toEqual(["p3"]);
  });

  it("⚠ 축 커버리지는 기둥 커버리지를 전파하지 않는다 — 같은 부족분을 두 번 깎지 않는다", () => {
    const r = computeAxis(P, [
      res("p1", "OK", 80, 0.8),
      res("p2", "OK", 60, 1),
      res("p3", "OK", 50, 1),
    ], "tide");
    // 점수를 낸 기둥이 전부이므로 커버리지는 1.00이다
    expect(r.coverage).toBeCloseTo(1, 10);
    expect(r.status).toBe("OK");
    // 전파한 값은 버리지 않고 depth로 남긴다: 0.5×0.8 + 0.3×1 + 0.2×1 = 0.90
    expect(r.depth).toBeCloseTo(0.9, 10);
  });

  it("축 커버리지가 0.70 미만이면 축도 INSUFFICIENT다", () => {
    const r = computeAxis(P, [
      res("p1", "OK", 80, 1),
      res("p2", "INSUFFICIENT", 0, 0.2),
      res("p3", "INSUFFICIENT", 0, 0.2),
    ], "tide");
    expect(r.coverage).toBeCloseTo(0.5, 10);
    expect(r.status).toBe("INSUFFICIENT");
    expect(r.score).toBeUndefined();
    expect(GATES.axisMinCoverage).toBe(0.7);
  });

  it("⚠ 그 축에 참여하지 않는 기둥은 분모에서도 빠진다", () => {
    const slow: GcrmPillar = {
      ...mk("p3", 0.2),
      summaryWeights: { tide: 0.7, wind: 0.3, wave: 0 },
    };
    const r = computeAxis([P[0], P[1], slow], [
      res("p1", "OK", 80, 1, "wave"),
      res("p2", "OK", 60, 1, "wave"),
    ], "wave");
    // p3는 파도가 없다 → 분모 0.8, 둘 다 냈으므로 커버리지 1.00
    expect(r.notApplicable).toEqual(["p3"]);
    expect(r.coverage).toBeCloseTo(1, 10);
    expect(r.status).toBe("OK");
    // 없는 것을 결측으로 셌다면 0.8이 되어 게이트에 걸렸을 것이다
    expect(r.score).toBeCloseTo((0.5 * 80 + 0.3 * 60) / 0.8, 10);
  });
});

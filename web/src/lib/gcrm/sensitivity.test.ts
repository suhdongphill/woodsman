/**
 * GCRM v2 — 민감도 분석 테스트 (명세 §2-15 · 단계 10).
 *
 * ★ 명세가 든 예시를 그대로 재현한다 —
 * 「tide 50→55일 때, wind:wave = 35:15 이므로 wind = 45 × 35/50 = 31.5, wave = 45 × 15/50 = 13.5」
 */
import { describe, it, expect } from "vitest";
import {
  redistributeAxisWeights,
  axisWeightSensitivity,
  indicatorSensitivity,
  pillarWeightSensitivity,
  fragility,
  dominantWarnings,
  leaveOneOutSensitivity,
} from "./sensitivity";
import { AXIS_WEIGHTS, SENSITIVITY } from "./config/model";
import type { PillarAxisResult, Contribution } from "./pillar";

const contribution = (indicator: string, effWeight: number, score: number): Contribution => ({
  indicator,
  path: indicator,
  baseWeight: effWeight,
  effWeight,
  presenceWeight: effWeight,
  score,
  share: 0,
  polarityFlipped: false,
});

const pillar = (contributions: Contribution[]): PillarAxisResult => ({
  pillar: "liquidity",
  axis: "tide",
  status: "OK",
  scoreRaw: 60,
  scoreOri: 60,
  coverage: 0.8,
  nUsed: contributions.length,
  nTotal: contributions.length,
  contributions,
  excluded: [],
  notApplicable: [],
});

// ═════════════════════════════════════════════════════════════════════════
describe("★ 축 가중치 재배분 — 명세 §2-15 예시", () => {
  it("tide 50 → 55면 wind 31.5 · wave 13.5", () => {
    const w = redistributeAxisWeights({ tide: 0.5, wind: 0.35, wave: 0.15 }, "tide", 5);
    expect(w.tide).toBeCloseTo(0.55, 10);
    expect(w.wind).toBeCloseTo(0.315, 10);
    expect(w.wave).toBeCloseTo(0.135, 10);
  });

  it("⚠ 균등 차감이 아니다 — 원래 비율(35:15)이 유지된다", () => {
    const w = redistributeAxisWeights({ tide: 0.5, wind: 0.35, wave: 0.15 }, "tide", 5);
    expect(w.wind / w.wave).toBeCloseTo(0.35 / 0.15, 10);
    // 균등 차감이었다면 wind 0.325 · wave 0.125로 비율이 2.6이 된다
    expect(w.wind).not.toBeCloseTo(0.325, 4);
  });

  it("어느 방향으로 흔들어도 합이 1이다", () => {
    for (const axis of ["tide", "wind", "wave"] as const) {
      for (const d of [5, -5]) {
        const w = redistributeAxisWeights(AXIS_WEIGHTS.core, axis, d);
        expect(Object.values(w).reduce((a, b) => a + b, 0), `${axis} ${d}`).toBeCloseTo(1, 10);
      }
    }
  });

  it("섭동 여섯 번(축 3개 × ±5pp)을 돌린다", () => {
    const r = axisWeightSensitivity({ tide: 70, wind: 50, wave: 30 });
    expect(r.runs).toHaveLength(6);
    expect(r.baseline).toBeCloseTo(0.5 * 70 + 0.35 * 50 + 0.15 * 30, 10);
  });

  it("조류를 올리면 종합이 조류 쪽으로 끌린다", () => {
    const r = axisWeightSensitivity({ tide: 90, wind: 50, wave: 10 });
    const up = r.runs.find((x) => x.axis === "tide" && x.deltaPp === 5)!;
    expect(up.shift).toBeGreaterThan(0);
    const down = r.runs.find((x) => x.axis === "tide" && x.deltaPp === -5)!;
    expect(down.shift).toBeLessThan(0);
  });

  it("축 점수가 하나라도 없으면 종합을 내지 않는다", () => {
    const r = axisWeightSensitivity({ tide: 70, wind: undefined, wave: 30 });
    expect(r.baseline).toBeUndefined();
    expect(r.runs.every((x) => x.overall === undefined)).toBe(true);
  });

  it("⚠ 축 가중치는 축 점수를 바꾸지 않는다 — 정렬도·레짐은 흔들리지 않는다", () => {
    // 그래서 이 섭동으로는 MODEL_FRAGILITY_WARNING의 세 조건 중 「overall 5점」만 걸릴 수 있다
    const scores = { tide: 70, wind: 50, wave: 30 };
    const r = axisWeightSensitivity(scores);
    // 입력 점수 자체는 그대로다
    expect(scores).toEqual({ tide: 70, wind: 50, wave: 30 });
    // 축 간 차이가 클수록 종합이 많이 움직인다
    const maxShift = Math.max(...r.runs.map((x) => Math.abs(x.shift ?? 0)));
    expect(maxShift).toBeGreaterThan(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════
describe("지표 가중치 섭동 ±10%", () => {
  it("⚠ 근사가 아니라 같은 식을 다시 푼다", () => {
    const cs = [contribution("a", 0.5, 80), contribution("b", 0.5, 40)];
    const r = indicatorSensitivity(pillar(cs));
    const a = r.find((x) => x.indicator === "a")!;
    // 기준 = (0.5×80 + 0.5×40) / 1.0 = 60
    // +10% = (0.55×80 + 0.5×40) / 1.05 = 61.904…
    expect(a.up).toBeCloseTo((0.55 * 80 + 0.5 * 40) / 1.05, 10);
    expect(a.down).toBeCloseTo((0.45 * 80 + 0.5 * 40) / 0.95, 10);
  });

  it("이동폭 내림차순으로 준다", () => {
    const cs = [contribution("big", 0.7, 90), contribution("small", 0.3, 55)];
    const r = indicatorSensitivity(pillar(cs));
    expect(r[0].maxShift).toBeGreaterThanOrEqual(r[1].maxShift);
  });

  it("★ ⚠ 명세의 3점 임계는 **어떤 경우에도 뜰 수 없다**", () => {
    // 가중평균이라 한 지표를 ±10% 흔든 이동폭은 (0.1w / (1 ∓ 0.1w)) × |점수 − 기둥점수|로 묶인다.
    // 가중치를 0.01~0.99로 쓸어도 최대가 2.63점이다 — 3점에 닿지 않는다.
    let worst = 0;
    for (let w = 0.01; w < 1; w += 0.01) {
      const cs = [contribution("a", w, 100), contribution("b", 1 - w, 0)];
      for (const x of indicatorSensitivity(pillar(cs))) worst = Math.max(worst, x.maxShift);
    }
    expect(worst).toBeLessThan(SENSITIVITY.dominantPillarDelta);
    expect(worst).toBeCloseTo(2.63, 1);
  });

  it("⚠ 그래서 ±10% 섭동은 지배를 판정하지 않는다 — 항상 false", () => {
    const cs = [contribution("a", 0.5, 100), contribution("b", 0.5, 0)];
    expect(indicatorSensitivity(pillar(cs)).every((x) => x.dominant === false)).toBe(true);
  });

  it("점수가 모두 같으면 가중치를 흔들어도 움직이지 않는다", () => {
    const cs = [contribution("a", 0.5, 60), contribution("b", 0.5, 60)];
    const r = indicatorSensitivity(pillar(cs));
    for (const x of r) expect(x.maxShift).toBeCloseTo(0, 10);
  });

  it("자료 부족 기둥은 섭동하지 않는다", () => {
    const p = { ...pillar([]), status: "INSUFFICIENT" as const };
    expect(indicatorSensitivity(p)).toEqual([]);
  });

});

// ═════════════════════════════════════════════════════════════════════════
describe("★ 빼고 재기 — 지배 판정은 이쪽이 한다", () => {
  it("지표를 빼면 기둥이 얼마나 움직이는지 정확히 낸다", () => {
    const cs = [contribution("a", 0.5, 100), contribution("b", 0.5, 0)];
    const r = leaveOneOutSensitivity(pillar(cs));
    // 기준 50. a를 빼면 0, b를 빼면 100 → 둘 다 50점 이동
    expect(r[0].shift).toBeCloseTo(50, 10);
    expect(r[0].dominant).toBe(true);
  });

  it("⚠ 마지막 하나를 빼면 기둥이 사라진다 — 그 사실 자체가 지배의 증거다", () => {
    const r = leaveOneOutSensitivity(pillar([contribution("only", 1, 70)]));
    expect(r[0].without).toBeUndefined();
    expect(r[0].dominant).toBe(true);
    expect(r[0].weightShare).toBeCloseTo(1, 10);
  });

  it("고르게 퍼져 있으면 지배적이지 않다", () => {
    const cs = [
      contribution("a", 0.25, 60),
      contribution("b", 0.25, 58),
      contribution("c", 0.25, 62),
      contribution("d", 0.25, 59),
    ];
    const r = leaveOneOutSensitivity(pillar(cs));
    expect(r.every((x) => !x.dominant)).toBe(true);
  });

  it("⚠ 경고는 「가중치를 고치라」가 아니라 「왜 그런지 보라」고 말한다", () => {
    const cs = [contribution("a", 0.5, 100), contribution("b", 0.5, 0)];
    const w = dominantWarnings(leaveOneOutSensitivity(pillar(cs)));
    expect(w).toHaveLength(2);
    expect(w[0].advice).toContain("먼저 본다");
    expect(w[0].advice).toContain("빠진 지표");
  });

  it("혼자 이고 있으면 그렇게 말한다", () => {
    const w = dominantWarnings(leaveOneOutSensitivity(pillar([contribution("only", 1, 70)])));
    expect(w[0].advice).toContain("혼자 기둥을 이고 있다");
  });
});

// ═════════════════════════════════════════════════════════════════════════
describe("★ 기둥 간 가중치 — provenance D-1 검증", () => {
  const scores = {
    liquidity: 70,
    rate_absorption: 50,
    engine_power: 60,
    market_risk: 40,
    risk_transmission: 45,
    engine_heat: 35,
    monetary_discipline: 55,
    debasement: 50,
  };
  const equal = Object.fromEntries(Object.keys(scores).map((k) => [k, 0.1]));
  const tilted = {
    liquidity: 0.18,
    rate_absorption: 0.12,
    engine_power: 0.12,
    market_risk: 0.12,
    risk_transmission: 0.14,
    engine_heat: 0.12,
    monetary_discipline: 0.05,
    debasement: 0.03,
  };

  it("균등과 차등을 나란히 비교한다", () => {
    const r = pillarWeightSensitivity(scores, [
      { label: "균등", weights: equal },
      { label: "차등(처음 안)", weights: tilted },
    ]);
    expect(r).toHaveLength(2);
    expect(r[0].shift).toBe(0);
    expect(r[1].shift).toBeDefined();
  });

  it("⚠ 자료 부족 기둥은 분모에서 빠진다 — 0으로 넣지 않는다", () => {
    const partial = { liquidity: 70, engine_heat: 30 };
    const r = pillarWeightSensitivity(partial, [{ label: "균등", weights: equal }]);
    // (0.1×70 + 0.1×30) / 0.2 = 50. 열 기둥으로 나눴다면 10이 된다
    expect(r[0].overall).toBeCloseTo(50, 10);
  });

  it("가중치가 없는 기둥은 건너뛴다", () => {
    const r = pillarWeightSensitivity({ liquidity: 70, 없는기둥: 10 }, [
      { label: "균등", weights: { liquidity: 1 } },
    ]);
    expect(r[0].overall).toBeCloseTo(70, 10);
  });
});

// ═════════════════════════════════════════════════════════════════════════
describe("MODEL_FRAGILITY_WARNING", () => {
  const base = { overall: 60, regimeCode: "R2", alignmentState: "MIXED" };

  it("레짐이 바뀌면 경고", () => {
    const w = fragility({ label: "tide +5pp", baseline: base, perturbed: { ...base, regimeCode: "R3" } })!;
    expect(w.code).toBe("MODEL_FRAGILITY_WARNING");
    expect(w.triggers[0]).toContain("R2 → R3");
  });

  it("종합이 5점 이상 변하면 경고", () => {
    expect(fragility({ label: "x", baseline: base, perturbed: { ...base, overall: 65 } })).not.toBeNull();
    expect(fragility({ label: "x", baseline: base, perturbed: { ...base, overall: 64.9 } })).toBeNull();
    expect(SENSITIVITY.fragileOverallDelta).toBe(5);
  });

  it("정렬 상태가 바뀌면 경고", () => {
    const w = fragility({ label: "x", baseline: base, perturbed: { ...base, alignmentState: "TRANSITION" } })!;
    expect(w.triggers[0]).toContain("MIXED → TRANSITION");
  });

  it("아무것도 안 바뀌면 경고가 아니다", () => {
    expect(fragility({ label: "x", baseline: base, perturbed: { ...base } })).toBeNull();
  });

  it("⚠ 종합을 못 내면 그 조건은 건너뛴다 — 모르는 것을 변동으로 세지 않는다", () => {
    const w = fragility({
      label: "x",
      baseline: { ...base, overall: undefined },
      perturbed: { ...base, overall: undefined },
    });
    expect(w).toBeNull();
  });
});

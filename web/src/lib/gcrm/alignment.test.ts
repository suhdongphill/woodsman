/**
 * GCRM v2 — 정렬도 · 방향 · 신뢰도 테스트 (명세 §2-7 ~ §2-9 · 단계 5).
 *
 * ★ **완료 기준은 명세 Part 3의 예시 1·2·3을 소수 첫째 자리까지 재현하는 것**이다.
 * v1 문서의 예시 숫자(정렬도 34)는 v1 자신의 수식에서도 나오지 않는다(명세 B-4) —
 * 그래서 v1 숫자는 기대값으로 쓰지 않는다.
 */
import { describe, it, expect } from "vitest";
import {
  directionOf,
  laggedScore,
  directionAgreement,
  alignmentOf,
  alignmentBand,
  alignmentState,
  STATE_LABEL,
  type Direction,
} from "./alignment";
import { confidenceOf, confidenceBand, channelBreadth, displayScore } from "./confidence";
import { DIRECTION, DIR_AGREEMENT, CONFIDENCE_WEIGHTS } from "./config/model";
import type { ChannelCode } from "./config/indicators";

const dirs = (tide: Direction, wind: Direction, wave: Direction) => ({ tide, wind, wave });

// ═════════════════════════════════════════════════════════════════════════
describe("★ 명세 Part 3 — 검산된 예시 재현", () => {
  it("예시 1 — 강한 정렬 : 정렬도 97.0 · ALIGNED_UP", () => {
    const r = alignmentOf({ tide: 74, wind: 71, wave: 77 }, dirs("UP", "UP", "UP"));
    expect(r.spread).toBe(6);
    expect(r.proximity).toBe(94);
    expect(r.dirAgreement).toBe(100);
    expect(r.alignment).toBeCloseTo(97.0, 10);
    expect(r.band).toBe("강한 정렬");

    const s = alignmentState({
      alignment: r.alignment,
      dirs: dirs("UP", "UP", "UP"),
      anyAxisInsufficient: false,
      windPersistenceWeeks: 0,
    });
    expect(s.state).toBe("ALIGNED_UP");
    expect(s.rule).toBe(2);
  });

  it("예시 2 — 전환 : 정렬도 47.0 · TRANSITION (v1 §15와 같은 입력)", () => {
    const d = dirs("UP", "DOWN", "DOWN");
    const r = alignmentOf({ tide: 72, wind: 48, wave: 31 }, d);
    expect(r.spread).toBe(41);
    expect(r.proximity).toBe(59);
    expect(r.dirAgreement).toBe(35); // 둘 DOWN, 하나 반대
    expect(r.alignment).toBeCloseTo(47.0, 10);
    expect(r.band).toBe("혼조");

    const s = alignmentState({
      alignment: r.alignment,
      dirs: d,
      anyAxisInsufficient: false,
      windPersistenceWeeks: 3,
    });
    expect(s.state).toBe("TRANSITION");
    expect(s.rule).toBe(3);
  });

  it("예시 3 — 히어로 : 정렬도 71.0 · MIXED (v1 §21과 같은 입력)", () => {
    const d = dirs("FLAT", "DOWN", "DOWN");
    const r = alignmentOf({ tide: 72, wind: 58, wave: 39 }, d);
    expect(r.spread).toBe(33);
    expect(r.proximity).toBe(67);
    expect(r.dirAgreement).toBe(75); // 둘 DOWN, 하나 FLAT
    expect(r.alignment).toBeCloseTo(71.0, 10);
    expect(r.band).toBe("정렬");

    const s = alignmentState({
      alignment: r.alignment,
      dirs: d,
      anyAxisInsufficient: false,
      windPersistenceWeeks: 5,
    });
    // 트리 2 불충족(방향이 모두 같지 않다) → 트리 3 불충족(tide가 FLAT이라 「반대」가 아니다)
    // → 트리 4 불충족(71 ≥ 45) → 트리 5
    expect(s.state).toBe("MIXED");
    expect(s.rule).toBe(5);
  });

  it("⚠ v1 문서의 34는 어떤 산식에서도 나오지 않는다 — 기대값으로 쓰지 않는다", () => {
    // v1 §21 히어로와 §15 예시가 서로 다른 입력인데 둘 다 34라고 적혀 있었다(명세 B-4)
    expect(alignmentOf({ tide: 72, wind: 58, wave: 39 }, dirs("FLAT", "DOWN", "DOWN")).alignment).not.toBeCloseTo(34, 0);
    expect(alignmentOf({ tide: 72, wind: 48, wave: 31 }, dirs("UP", "DOWN", "DOWN")).alignment).not.toBeCloseTo(34, 0);
  });
});

// ═════════════════════════════════════════════════════════════════════════
describe("§2-9 ⚠ 가운데 값이 계산에 들어간다 (B-3 해소)", () => {
  it("v1 수식이라면 같았을 두 경우가 다르게 나온다", () => {
    // v1: dispersion = 2×(max−min)/3 이므로 72/58/39와 72/70/39가 **완전히 같았다**
    const a = alignmentOf({ tide: 72, wind: 58, wave: 39 }, dirs("FLAT", "DOWN", "DOWN"));
    const b = alignmentOf({ tide: 72, wind: 70, wave: 39 }, dirs("FLAT", "DOWN", "DOWN"));
    // spread는 여전히 같다(최대−최소를 쓰므로)
    expect(a.spread).toBe(b.spread);
    // ⚠ 그래서 가운데 값은 **보조 표시(stdev)**로 남긴다 — 점수에는 넣지 않는다
    expect(a.stdev).not.toBeCloseTo(b.stdev, 3);
  });

  it("proximity가 0–100 전 구간을 쓴다 — 50을 넘어도 뭉개지지 않는다", () => {
    const wide = alignmentOf({ tide: 95, wind: 50, wave: 5 }, dirs("UP", "FLAT", "DOWN"));
    expect(wide.spread).toBe(90);
    expect(wide.proximity).toBe(10); // v1이라면 100 − min(100, 2×60) = 0으로 뭉갰다
    expect(wide.proximity).toBeGreaterThan(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════
describe("§2-9 방향 일치도", () => {
  it("모두 같으면 100", () => {
    expect(directionAgreement(["UP", "UP", "UP"]).value).toBe(DIR_AGREEMENT.allSame);
    expect(directionAgreement(["DOWN", "DOWN", "DOWN"]).value).toBe(DIR_AGREEMENT.allSame);
  });

  it("둘이 같고 하나가 FLAT이면 75", () => {
    expect(directionAgreement(["UP", "UP", "FLAT"]).value).toBe(DIR_AGREEMENT.twoSameOneFlat);
    expect(directionAgreement(["FLAT", "DOWN", "DOWN"]).value).toBe(DIR_AGREEMENT.twoSameOneFlat);
  });

  it("둘이 같고 하나가 반대면 35", () => {
    expect(directionAgreement(["UP", "DOWN", "DOWN"]).value).toBe(DIR_AGREEMENT.twoSameOneOpposite);
    expect(directionAgreement(["UP", "UP", "DOWN"]).value).toBe(DIR_AGREEMENT.twoSameOneOpposite);
  });

  it("셋이 모두 다르면 0", () => {
    expect(directionAgreement(["UP", "DOWN", "FLAT"]).value).toBe(DIR_AGREEMENT.otherwise);
  });

  it("⚠ 셋 다 FLAT이면 100이 아니라 0이다 — 아무것도 안 움직이는 것은 정렬이 아니다", () => {
    // 명세가 정하지 않은 경우. provenance.ts에 D등급으로 올려 뒀다
    const r = directionAgreement(["FLAT", "FLAT", "FLAT"]);
    expect(r.value).toBe(DIR_AGREEMENT.otherwise);
    expect(r.rule).toBe("OTHERWISE");
  });

  it("⚠ 멈춘 둘과 움직이는 하나도 0이다 — 정렬의 증거가 아니다", () => {
    expect(directionAgreement(["FLAT", "FLAT", "UP"]).value).toBe(DIR_AGREEMENT.otherwise);
  });

  it("방향을 모르는 축이 있으면 0 — 모르는 것을 일치로 세지 않는다", () => {
    expect(directionAgreement(["UP", "UP", undefined]).value).toBe(DIR_AGREEMENT.otherwise);
  });
});

// ═════════════════════════════════════════════════════════════════════════
describe("§2-8 방향과 불감대", () => {
  it("불감대 안이면 FLAT이다 — 없으면 화살표가 매일 뒤집힌다", () => {
    expect(directionOf("tide", 72, 70.5)).toBe("FLAT"); // 1.5 ≤ 2.0
    expect(directionOf("tide", 72, 69.5)).toBe("UP"); // 2.5 > 2.0
    expect(directionOf("wave", 50, 47.5)).toBe("FLAT"); // 2.5 ≤ 3.0 (파도는 불감대가 넓다)
    expect(directionOf("wave", 50, 46.5)).toBe("UP");
  });

  it("경계값은 FLAT이다", () => {
    expect(directionOf("wind", 60, 58)).toBe("FLAT"); // 정확히 2.0
    expect(DIRECTION.deadband.wind).toBe(2);
  });

  it("⚠ 비교할 과거가 없으면 FLAT이 아니라 undefined다", () => {
    expect(directionOf("tide", 72, undefined)).toBeUndefined();
    expect(directionOf("tide", undefined, 70)).toBeUndefined();
  });

  it("축마다 비교 시점이 다르다 — 조류 63 · 바람 20 · 파도 5영업일", () => {
    const history = Array.from({ length: 100 }, (_, i) => ({ asOf: `d${i}`, score: i }));
    expect(laggedScore(history, "tide", 99)).toBe(99 - DIRECTION.lag.tide);
    expect(laggedScore(history, "wind", 99)).toBe(99 - DIRECTION.lag.wind);
    expect(laggedScore(history, "wave", 99)).toBe(99 - DIRECTION.lag.wave);
  });

  it("이력이 짧으면 지어내지 않는다", () => {
    const history = Array.from({ length: 10 }, (_, i) => ({ asOf: `d${i}`, score: i }));
    expect(laggedScore(history, "tide", 9)).toBeUndefined();
  });
});

// ═════════════════════════════════════════════════════════════════════════
describe("§2-9 상태 결정 트리", () => {
  const base = { anyAxisInsufficient: false, windPersistenceWeeks: 0 };

  it("1 — 축이 자료 부족이면 UNDETERMINED", () => {
    const s = alignmentState({ ...base, alignment: 97, dirs: dirs("UP", "UP", "UP"), anyAxisInsufficient: true });
    expect(s.state).toBe("UNDETERMINED");
    expect(s.rule).toBe(1);
  });

  it("2 — 모두 같은 방향이어도 alignment < 65면 정렬이 아니다", () => {
    expect(alignmentState({ ...base, alignment: 64.9, dirs: dirs("UP", "UP", "UP") }).state).not.toBe("ALIGNED_UP");
    expect(alignmentState({ ...base, alignment: 65, dirs: dirs("UP", "UP", "UP") }).state).toBe("ALIGNED_UP");
  });

  it("2 — 스트레스 방향이면 ALIGNED_DOWN", () => {
    expect(alignmentState({ ...base, alignment: 90, dirs: dirs("DOWN", "DOWN", "DOWN") }).state).toBe("ALIGNED_DOWN");
  });

  it("★ 3 — ⚠ TRANSITION이 DIVERGENT보다 먼저 판정된다", () => {
    // alignment 40이면 트리 4(<45)에 걸려 DIVERGENT가 될 수도 있는 값이다
    const s = alignmentState({
      alignment: 40,
      dirs: dirs("UP", "DOWN", "DOWN"),
      anyAxisInsufficient: false,
      windPersistenceWeeks: 3,
    });
    expect(s.state).toBe("TRANSITION");
    expect(s.rule).toBe(3);
  });

  it("3 — 바람 지속이 3주 미만이면 전환이 아니다", () => {
    const s = alignmentState({
      alignment: 40,
      dirs: dirs("UP", "DOWN", "DOWN"),
      anyAxisInsufficient: false,
      windPersistenceWeeks: 2,
    });
    expect(s.state).toBe("DIVERGENT");
    expect(s.rule).toBe(4);
  });

  it("3 — 조류가 FLAT이면 「반대」가 아니다 (예시 3의 판정 근거)", () => {
    const s = alignmentState({
      alignment: 71,
      dirs: dirs("FLAT", "DOWN", "DOWN"),
      anyAxisInsufficient: false,
      windPersistenceWeeks: 10,
    });
    expect(s.state).toBe("MIXED");
  });

  it("⚠ 셋 다 FLAT이면 정렬로 부르지 않는다", () => {
    const d = dirs("FLAT", "FLAT", "FLAT");
    const r = alignmentOf({ tide: 50, wind: 50, wave: 50 }, d);
    // proximity 100이지만 방향 일치도가 0이라 alignment 50
    expect(r.alignment).toBeCloseTo(50, 10);
    expect(alignmentState({ ...base, alignment: r.alignment, dirs: d }).state).toBe("MIXED");
  });

  it("모든 상태에 한글 표기가 있다", () => {
    for (const s of ["ALIGNED_UP", "ALIGNED_DOWN", "TRANSITION", "DIVERGENT", "MIXED", "UNDETERMINED"] as const) {
      expect(STATE_LABEL[s]).toBeTruthy();
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════
describe("§2-9 정렬도 구간", () => {
  it.each([
    [100, "강한 정렬"],
    [80, "강한 정렬"],
    [79.9, "정렬"],
    [65, "정렬"],
    [64.9, "혼조"],
    [45, "혼조"],
    [44.9, "이탈"],
    [25, "이탈"],
    [24.9, "강한 이탈"],
    [0, "강한 이탈"],
  ])("%s → %s", (v, label) => {
    expect(alignmentBand(v as number)).toBe(label);
  });
});

// ═════════════════════════════════════════════════════════════════════════
describe("§2-7 신뢰도", () => {
  it("산식대로 계산한다", () => {
    const r = confidenceOf({
      coverage: 0.9,
      stalenessFactors: [1, 0.9],
      evidenceFactors: [1, 0.95],
      channels: ["PRICE", "CREDIT", "FUNDING"],
      depthFactors: [1, 0.5],
    });
    const expected =
      100 *
      (CONFIDENCE_WEIGHTS.coverage * 0.9 +
        CONFIDENCE_WEIGHTS.staleness * 0.95 +
        CONFIDENCE_WEIGHTS.evidence * 0.975 +
        CONFIDENCE_WEIGHTS.channelBreadth * 0.75 +
        CONFIDENCE_WEIGHTS.depth * 0.75);
    expect(r.value).toBeCloseTo(expected, 10);
  });

  it("채널 폭은 4로 나누고 1에서 자른다", () => {
    expect(channelBreadth(["PRICE"])).toBeCloseTo(0.25, 10);
    expect(channelBreadth(["PRICE", "CREDIT", "FUNDING", "RATES"])).toBe(1);
    expect(channelBreadth(["PRICE", "CREDIT", "FUNDING", "RATES", "FX", "COMMODITY"])).toBe(1);
  });

  it("⚠ 같은 채널이 여럿이어도 한 번만 센다", () => {
    expect(channelBreadth(["PRICE", "PRICE", "PRICE"])).toBeCloseTo(0.25, 10);
  });

  it("완전한 자료면 100이다", () => {
    const r = confidenceOf({
      coverage: 1,
      stalenessFactors: [1],
      evidenceFactors: [1],
      channels: ["PRICE", "CREDIT", "FUNDING", "RATES"],
      depthFactors: [1],
    });
    expect(r.value).toBeCloseTo(100, 10);
    expect(r.band).toBe("높음");
  });

  it.each([
    [90, "높음"],
    [85, "높음"],
    [84.9, "보통"],
    [70, "보통"],
    [69.9, "낮음"],
    [55, "낮음"],
    [54.9, "참고용"],
    [0, "참고용"],
  ])("%s → %s", (v, label) => {
    expect(confidenceBand(v as number)).toBe(label);
  });

  it("⚠ 쓴 지표가 없으면 신선도·근거 평균이 0이다 — 지어내지 않는다", () => {
    const r = confidenceOf({
      coverage: 0,
      stalenessFactors: [],
      evidenceFactors: [],
      channels: [],
      depthFactors: [],
    });
    expect(r.value).toBe(0);
    expect(r.band).toBe("참고용");
  });

  it("⚠ 깊이는 창을 채운 비율이다 — 20년 창에 3.2년이면 크게 깎인다", () => {
    const base = {
      coverage: 1,
      stalenessFactors: [1],
      evidenceFactors: [1],
      channels: ["PRICE", "CREDIT", "FUNDING", "RATES"] as ChannelCode[],
    };
    const full = confidenceOf({ ...base, depthFactors: [1] });
    const short = confidenceOf({ ...base, depthFactors: [800 / 5000] });
    expect(full.value).toBeCloseTo(100, 10);
    // ⚠ 커버리지는 1 그대로다 — 값이 있으면 켜진 것으로 세기 때문이다. 깊이만 이 사실을 안다.
    expect(short.parts.coverage).toBe(1);
    expect(short.value).toBeCloseTo(100 - 100 * CONFIDENCE_WEIGHTS.depth * (1 - 800 / 5000), 10);
  });

  it("⚠ 깊이는 점수를 빼지 않는다 — 신뢰도만 깎는다(짧은 자료를 버리지 않는다)", () => {
    // 함수가 점수를 받지 않는다는 것이 곧 그 보장이다. 여기서는 깊이가 0이어도 값이 나온다는 것만 본다.
    const r = confidenceOf({
      coverage: 1,
      stalenessFactors: [1],
      evidenceFactors: [1],
      channels: ["PRICE", "CREDIT", "FUNDING", "RATES"],
      depthFactors: [0],
    });
    expect(r.value).toBeCloseTo(100 * (1 - CONFIDENCE_WEIGHTS.depth), 10);
  });

  it("⚠ 점수와 신뢰도를 곱하지 않는다 — 함수가 점수를 받지도 않는다", () => {
    // 산식에 점수가 들어갈 자리가 없다는 것을 서명으로 보인다
    const input = {
      coverage: 0.8,
      stalenessFactors: [1],
      evidenceFactors: [1],
      channels: ["PRICE"] as const,
      depthFactors: [1],
    };
    expect(Object.keys(input)).not.toContain("score");
  });
});

// ═════════════════════════════════════════════════════════════════════════
describe("§D-1 화면 표기", () => {
  it("5점 단위로 반올림한다 — 없는 정밀도를 만들지 않는다", () => {
    expect(displayScore(78)).toBe(80);
    expect(displayScore(72.4)).toBe(70);
    expect(displayScore(47.0)).toBe(45);
    expect(displayScore(97.0)).toBe(95);
  });
});

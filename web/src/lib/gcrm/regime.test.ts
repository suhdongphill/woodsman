/**
 * GCRM v2 — 레짐 상태 기계 테스트 (명세 §2-13 · §2-14 · 단계 7).
 *
 * ★ 단계 7이 요구한 둘:
 * 1. `evaluate_regime_transition`이 **`wave`를 받지 않는다** — 서명을 검사한다
 * 2. **이력현상** — R5 진입 후 위험전이를 69로 낮춰도 체류 기간 안에는 R5를 유지한다
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  evaluateRegimeTransition,
  enterCandidates,
  slowSummary,
  rteOf,
  initialRegimeState,
  type RegimeState,
  type SignalContext,
  type RegimeTransitionInput,
} from "./regime";
import { GCRM_REGIME_BY_CODE, REGIME_PRIORITY, REGIME_EDGES } from "./config/regimes";
import { AXIS_WEIGHTS } from "./config/model";

const SIGNALS: SignalContext = {
  confirmedChannels: [],
  windPersistenceWeeks: 0,
  windImprovingWeeks: 0,
  fundingNormalWeeks: 0,
  tideDeteriorating: false,
};

const state = (code: RegimeState["code"], dwellDays: number): RegimeState => ({
  code,
  nameKo: GCRM_REGIME_BY_CODE.get(code)!.nameKo,
  enteredAt: "2026-01-01",
  dwellDays,
  entryReason: [],
});

const run = (over: Partial<RegimeTransitionInput>) =>
  evaluateRegimeTransition({
    asOf: "2026-09-19",
    tide: { score: 50, coverage: 1, status: "OK" },
    wind: { score: 50, coverage: 1, status: "OK" },
    pillarsSlow: {},
    signals: SIGNALS,
    prev: initialRegimeState("2026-01-01"),
    overallCoverage: 1,
    ...over,
  });

/** R5 진입 조건: 위험전이 ≥ 70 · 엔진온도 ≥ 70 · 금리감내력 < 45 */
const R5_PILLARS = { risk_transmission: 72, engine_heat: 75, rate_absorption: 40 };
const R5_SIGNALS: SignalContext = { ...SIGNALS, windPersistenceWeeks: 3, tideDeteriorating: true };

// ═════════════════════════════════════════════════════════════════════════
describe("★ 1. 함수 서명에 wave가 없다 (§2-11 하드 게이트)", () => {
  const source = readFileSync(fileURLToPath(new URL("./regime.ts", import.meta.url)), "utf8");

  /** `RegimeTransitionInput` 타입 선언의 본문만 떼어낸다. */
  function inputTypeBody(): string {
    const start = source.indexOf("export type RegimeTransitionInput = {");
    expect(start).toBeGreaterThan(-1);
    const end = source.indexOf("\n};", start);
    return source.slice(start, end);
  }

  it("⚠ RegimeTransitionInput 어디에도 wave가 없다", () => {
    const body = inputTypeBody();
    // 주석에서 「wave」를 설명하는 줄은 뺀다 — 검사 대상은 **필드**다
    const fields = body
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("*") && !l.trimStart().startsWith("//") && !l.includes("/**"));
    expect(fields.join("\n").toLowerCase()).not.toContain("wave");
  });

  it("⚠ SignalContext에도 파도 점수가 없다 — 옆문으로도 들어오지 못한다", () => {
    const start = source.indexOf("export type SignalContext = {");
    const end = source.indexOf("\n};", start);
    const fields = source
      .slice(start, end)
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("*") && !l.includes("/**"));
    expect(fields.join("\n").toLowerCase()).not.toContain("wave");
  });

  it("런타임 인자 키에도 wave가 없다", () => {
    const input: RegimeTransitionInput = {
      asOf: "2026-09-19",
      tide: { score: 50, coverage: 1, status: "OK" },
      wind: { score: 50, coverage: 1, status: "OK" },
      pillarsSlow: {},
      signals: SIGNALS,
      prev: initialRegimeState("2026-01-01"),
      overallCoverage: 1,
    };
    expect(Object.keys(input)).not.toContain("wave");
    expect(Object.keys(input.signals)).not.toContain("wave");
  });

  it("⚠ RTE 계산에도 파도가 들어가지 않는다 (§2-14)", () => {
    expect(AXIS_WEIGHTS.transition.wave).toBe(0);
    // 같은 tide·wind면 언제나 같은 RTE다 — 파도가 달라도 바뀔 자리가 없다
    expect(rteOf(70, 40)).toBeCloseTo(rteOf(70, 40), 12);
    const w = AXIS_WEIGHTS.transition;
    const rts = (0.2 / 0.65) * 70 + (0.45 / 0.65) * 40;
    expect(rteOf(70, 40)).toBeCloseTo(w.tide * 70 + w.wind * 40 + w.rts_slow * rts, 10);
  });
});

// ═════════════════════════════════════════════════════════════════════════
describe("★ 2. 이력현상 — 진입 후 살짝 낮춰도 나가지 않는다", () => {
  it("R5 진입", () => {
    const r = run({ pillarsSlow: R5_PILLARS, signals: R5_SIGNALS, prev: state("R4", 20) });
    expect(r.changed).toBe(true);
    expect(r.state.code).toBe("R5");
    expect(r.state.dwellDays).toBe(0);
  });

  it("★ 위험전이를 69로 낮춰도 체류 기간 안이면 R5를 유지한다", () => {
    // 진입 임계 70을 밑돌지만 해제 임계 55에는 한참 못 미친다
    const r = run({
      pillarsSlow: { ...R5_PILLARS, risk_transmission: 69 },
      signals: R5_SIGNALS,
      prev: state("R5", 5),
    });
    expect(r.state.code).toBe("R5");
    expect(r.changed).toBe(false);
    expect(r.state.dwellDays).toBe(6);
  });

  it("★ 체류 20일을 넘겨도 해제 임계(55)에 닿기 전에는 나가지 않는다", () => {
    const r = run({
      pillarsSlow: { ...R5_PILLARS, risk_transmission: 69 },
      signals: R5_SIGNALS,
      prev: state("R5", 40),
    });
    expect(r.state.code).toBe("R5");
    expect(r.reason).toContain("이력현상");
    expect(GCRM_REGIME_BY_CODE.get("R5")!.minDwellDays).toBe(20);
  });

  it("해제 조건이 **전부** 충족되고 체류도 채우면 나간다", () => {
    // R5 해제: 위험전이 < 55 · 엔진온도 < 60 · 금리감내력 > 55 · 바람 2주 개선 (exitMode: all)
    const r = run({
      // R5 해제 셋이 모두 풀리고, 동시에 R4 진입 조건(엔진출력<45 · 엔진온도<45 · 위험전이<60)을 만족한다
      pillarsSlow: {
        risk_transmission: 50,
        engine_heat: 40,
        rate_absorption: 60,
        engine_power: 40,
      },
      signals: { ...SIGNALS, windImprovingWeeks: 2 },
      prev: state("R5", 25),
    });
    expect(r.changed).toBe(true);
    expect(r.state.code).toBe("R4"); // R5의 인접 레짐
  });

  it("⚠ 해제 조건 셋 중 둘만 풀리면 나가지 않는다 (exitMode: all)", () => {
    const r = run({
      pillarsSlow: { risk_transmission: 50, engine_heat: 55, rate_absorption: 50 },
      signals: { ...SIGNALS, windImprovingWeeks: 2 },
      prev: state("R5", 25),
    });
    expect(r.changed).toBe(false);
    expect(r.state.code).toBe("R5");
  });

  it("⚠ 바람이 2주 개선되지 않으면 점수가 다 풀려도 나가지 않는다", () => {
    const r = run({
      pillarsSlow: { risk_transmission: 50, engine_heat: 55, rate_absorption: 60, engine_power: 40 },
      signals: { ...SIGNALS, windImprovingWeeks: 1 },
      prev: state("R5", 25),
    });
    expect(r.changed).toBe(false);
    expect(r.blocked).toContain("바람 개선");
  });

  it("완만한 레짐은 하나만 깨져도 나간다 (exitMode: any)", () => {
    expect(GCRM_REGIME_BY_CODE.get("R1")!.exitMode).toBe("any");
    expect(GCRM_REGIME_BY_CODE.get("R5")!.exitMode).toBe("all");
  });
});

// ═════════════════════════════════════════════════════════════════════════
describe("§2-13 최소 체류 기간", () => {
  it("체류를 못 채우면 조건이 바뀌어도 머문다", () => {
    const r = run({
      pillarsSlow: { engine_power: 65, engine_heat: 50, risk_transmission: 30 }, // R2 조건
      prev: state("R1", 3),
    });
    expect(r.changed).toBe(false);
    expect(r.blocked).toBe("최소 체류 기간");
    expect(r.reason).toContain("3일째");
  });

  it("★ R6만 예외 — 체류 중에도 위기로는 들어간다", () => {
    const r = run({
      pillarsSlow: { risk_transmission: 85 },
      signals: { ...SIGNALS, confirmedChannels: ["CREDIT", "FUNDING"] },
      prev: state("R1", 1), // 최소 체류 10일 중 1일째
    });
    expect(r.changed).toBe(true);
    expect(r.state.code).toBe("R6");
  });
});

// ═════════════════════════════════════════════════════════════════════════
describe("§2-13 ⚠ 위기는 CREDIT과 FUNDING이 모두 확인될 때만", () => {
  it("주식만 급락한 것은 위기가 아니다", () => {
    const r = run({
      pillarsSlow: { risk_transmission: 90 },
      signals: { ...SIGNALS, confirmedChannels: ["PRICE"] },
      prev: state("R2", 30),
    });
    expect(r.state.code).not.toBe("R6");
    expect(r.financialCrisis).toBe(false);
    expect(r.candidates).not.toContain("R6");
  });

  it("한 채널만 확인돼도 위기가 아니다", () => {
    const r = run({
      pillarsSlow: { risk_transmission: 90 },
      signals: { ...SIGNALS, confirmedChannels: ["CREDIT"] },
      prev: state("R2", 30),
    });
    expect(r.financialCrisis).toBe(false);
  });

  it("둘 다 확인되면 위기다", () => {
    const r = run({
      pillarsSlow: { risk_transmission: 90 },
      signals: { ...SIGNALS, confirmedChannels: ["CREDIT", "FUNDING", "PRICE"] },
      prev: state("R2", 30),
    });
    expect(r.financialCrisis).toBe(true);
    expect(r.state.code).toBe("R6");
  });
});

// ═════════════════════════════════════════════════════════════════════════
describe("§2-13 우선순위와 전이 그래프", () => {
  it("동시 충족 시 나쁜 쪽을 먼저 본다 (R6 > R5 > R3 > R4 > R2 > R1)", () => {
    expect(REGIME_PRIORITY.slice(0, 6)).toEqual(["R6", "R5", "R3", "R4", "R2", "R1"]);
    // R1과 R2 조건을 동시에 만족시키면 R2가 이긴다
    const c = enterCandidates(
      {
        liquidity: 70,
        risk_transmission: 30,
        rate_absorption: 65,
        engine_power: 65,
        engine_heat: 50,
      },
      SIGNALS,
    );
    expect(c.map((x) => x.code)).toEqual(["R2", "R1"]);
  });

  it("⚠ 인접하지 않은 레짐으로 건너뛰지 않는다", () => {
    // R1 → R5는 그래프에 없다
    expect(REGIME_EDGES.R1).not.toContain("R5");
    const r = run({
      pillarsSlow: R5_PILLARS,
      signals: R5_SIGNALS,
      prev: state("R1", 30),
    });
    expect(r.changed).toBe(false);
    expect(r.blocked).toBe("전이 그래프");
  });

  it("R6은 어느 레짐에서든 들어갈 수 있다", () => {
    for (const from of ["R1", "R2", "R3", "R4", "R5"] as const) {
      const r = run({
        pillarsSlow: { risk_transmission: 85 },
        signals: { ...SIGNALS, confirmedChannels: ["CREDIT", "FUNDING"] },
        prev: state(from, 30),
      });
      expect(r.state.code, from).toBe("R6");
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════
describe("§2-6 커버리지 게이트", () => {
  it("⚠ 자료가 모자라면 전이를 차단하고 직전 상태를 유지한다", () => {
    const r = run({
      pillarsSlow: { risk_transmission: 90 },
      signals: { ...SIGNALS, confirmedChannels: ["CREDIT", "FUNDING"] },
      prev: state("R2", 30),
      overallCoverage: 0.69,
    });
    expect(r.changed).toBe(false);
    expect(r.state.code).toBe("R2");
    expect(r.blocked).toContain("69%");
  });

  it("차단돼도 체류 일수는 늘어난다 — 시간은 흐른다", () => {
    const r = run({ prev: state("R2", 5), overallCoverage: 0.5 });
    expect(r.state.dwellDays).toBe(6);
  });
});

// ═════════════════════════════════════════════════════════════════════════
describe("⚠ 파도를 뺀 기둥 스칼라 (명세 §2-11 · §2-13 충돌 해소)", () => {
  const CORE = { tide: 0.5, wind: 0.35, wave: 0.15 };

  it("조류·바람만으로 재정규화한다", () => {
    // 0.5×80 + 0.35×60 = 61 → / 0.85 = 71.76…
    expect(slowSummary({ tide: 80, wind: 60 }, CORE)).toBeCloseTo((0.5 * 80 + 0.35 * 60) / 0.85, 10);
  });

  it("⚠ 파도가 아무리 극단이어도 결과가 달라지지 않는다 — 인자에 없다", () => {
    const a = slowSummary({ tide: 80, wind: 60 }, CORE);
    const b = slowSummary({ tide: 80, wind: 60 }, { tide: 0.5, wind: 0.35, wave: 0.99 });
    expect(a).toBeCloseTo(b!, 10);
  });

  it("한 축만 있으면 그 축이 전부다", () => {
    expect(slowSummary({ tide: 70 }, CORE)).toBeCloseTo(70, 10);
    expect(slowSummary({ wind: 30 }, CORE)).toBeCloseTo(30, 10);
  });

  it("둘 다 없으면 지어내지 않는다", () => {
    expect(slowSummary({}, CORE)).toBeUndefined();
  });
});

// ═════════════════════════════════════════════════════════════════════════
describe("모르는 값을 충족으로 세지 않는다", () => {
  it("기둥 점수가 없으면 진입 조건을 통과시키지 않는다", () => {
    // risk_transmission만 있고 engine_heat·rate_absorption이 없다
    expect(enterCandidates({ risk_transmission: 90 }, R5_SIGNALS).map((c) => c.code)).not.toContain("R5");
  });

  it("⚠ 해제 조건도 모르면 충족으로 세지 않는다 — 기둥이 비면 직전 레짐에 머문다", () => {
    // R2 해제는 「엔진출력 < 50 **또는** 위험전이 ≥ 55」인데 둘 다 값이 없다.
    // 「모른다」를 「해제됐다」로 읽으면 자료가 끊긴 날 레짐이 조용히 풀린다.
    const r = run({ prev: state("R2", 30), pillarsSlow: {} });
    expect(r.candidates).toEqual([]);
    expect(r.state.code).toBe("R2");
    expect(r.reason).toContain("이력현상");
  });

  it("R0에서 시작하면 해제 조건이 없으므로 R0에 머문다", () => {
    const r = run({ prev: state("R0", 30), pillarsSlow: {} });
    expect(r.candidates).toEqual([]);
    expect(r.state.code).toBe("R0");
    expect(r.changed).toBe(false);
  });
});

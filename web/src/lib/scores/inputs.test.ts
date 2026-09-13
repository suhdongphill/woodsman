import { describe, expect, it } from "vitest";
import { findIndicator } from "../macro/catalog";
import { SCORE_DEFINITIONS, type ScoreKey } from "./config";
import { coverageReport, SCORE_INPUTS } from "./inputs";

describe("점수 입력 매핑 — 오타 하나가 조용한 결측이 되지 않게", () => {
  it("⚠ 「있다」고 적은 지표는 카탈로그에 실제로 있다", () => {
    for (const [score, inputs] of Object.entries(SCORE_INPUTS)) {
      for (const [component, src] of Object.entries(inputs ?? {})) {
        if (src.status !== "available") continue;
        for (const key of src.indicators) {
          expect(findIndicator(key), `${score}.${component} → ${key}`).toBeDefined();
        }
      }
    }
  });

  it("⚠ 매핑한 점수는 명세의 구성요소를 빠짐없이 적는다 — 빠지면 이유 없는 결측이 된다", () => {
    for (const [score, inputs] of Object.entries(SCORE_INPUTS)) {
      const def = SCORE_DEFINITIONS[score as ScoreKey];
      expect(Object.keys(inputs ?? {}).sort(), score).toEqual(Object.keys(def.components).sort());
    }
  });

  it("하위 점수 매핑은 정의된 점수를 가리키고, 설정의 연결과 같다", () => {
    for (const [score, inputs] of Object.entries(SCORE_INPUTS)) {
      const def = SCORE_DEFINITIONS[score as ScoreKey];
      for (const [component, src] of Object.entries(inputs ?? {})) {
        if (src.status !== "subscore") continue;
        expect(SCORE_DEFINITIONS[src.score], `${score}.${component}`).toBeDefined();
        expect(def.subScores?.[component], `${score}.${component}`).toBe(src.score);
      }
    }
  });

  it("⚠ 채울 수 없는 구성요소에는 이유가 있다", () => {
    for (const [score, inputs] of Object.entries(SCORE_INPUTS)) {
      for (const [component, src] of Object.entries(inputs ?? {})) {
        if (src.status === "planned" || src.status === "unavailable") {
          expect(src.reason.trim().length, `${score}.${component}`).toBeGreaterThan(5);
        }
      }
    }
  });

  /** ⚠ 명세 §7이 같은 BLS 계열(OPHNFB)을 두 번 세는 자리 — 한 번만 채운다. */
  it("⚠ 같은 계열을 한 점수 안에서 두 구성요소로 세지 않는다", () => {
    for (const [score, inputs] of Object.entries(SCORE_INPUTS)) {
      const seen = new Map<string, string>();
      for (const [component, src] of Object.entries(inputs ?? {})) {
        if (src.status !== "available") continue;
        for (const key of src.indicators) {
          expect(seen.get(key), `${score}: ${key}가 ${seen.get(key)}와 ${component}에 둘 다 있다`).toBeUndefined();
          seen.set(key, component);
        }
      }
    }
  });
});

describe("커버리지 보고 — 명세 §44를 매핑에 건다", () => {
  const rows = coverageReport();
  const row = (k: ScoreKey) => rows.find((r) => r.score === k)!;

  it("모든 정의 점수에 한 줄씩 나온다", () => {
    expect(rows.map((r) => r.score).sort()).toEqual(Object.keys(SCORE_DEFINITIONS).sort());
  });

  it("⚠ 매핑하지 않은 점수는 0%가 아니라 「매핑 전」이다", () => {
    expect(row("crypto_flow").state).toBe("NOT_MAPPED");
  });

  it("⚠ 발행하지 못하는 하위 점수는 부모에서 결측이다 — 하위 점수가 없는데 부모가 높은 커버리지를 말하지 않는다", () => {
    const gls = row("global_liquidity");
    for (const m of gls.missing) {
      if (m.reason.startsWith("하위 점수")) expect(m.reason).toMatch(/발행 기준/);
    }
    const treasury = row("treasury_liquidity");
    if (treasury.state === "DO_NOT_PUBLISH") {
      expect(gls.missing.map((m) => m.component)).toContain("treasury");
    }
  });
});

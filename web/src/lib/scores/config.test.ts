import { describe, expect, it } from "vitest";
import { SCORE_DEFINITIONS, V1_PRIORITY, type ScoreKey } from "./config";

describe("점수 정의 — 명세 §6~§41을 데이터로 옮겼다", () => {
  /** ⚠ 식을 옮기다 틀리면 여기서 깨진다. 부동소수 오차만 허용한다. */
  it("⚠ 점수마다 가중치 합은 1.00이다", () => {
    for (const [key, def] of Object.entries(SCORE_DEFINITIONS)) {
      const sum = Object.values(def.components).reduce((s, w) => s + w, 0);
      expect(sum, `${key} (${def.spec})`).toBeCloseTo(1, 10);
    }
  });

  it("가중치는 모두 양수다", () => {
    for (const [key, def] of Object.entries(SCORE_DEFINITIONS)) {
      for (const [c, w] of Object.entries(def.components)) expect(w, `${key}.${c}`).toBeGreaterThan(0);
    }
  });

  it("하위 점수 연결은 실제 구성요소와 정의된 점수를 가리킨다", () => {
    for (const [key, def] of Object.entries(SCORE_DEFINITIONS)) {
      for (const [component, sub] of Object.entries(def.subScores ?? {})) {
        expect(def.components[component], `${key}.${component}`).toBeDefined();
        expect(SCORE_DEFINITIONS[sub as ScoreKey], `${key} → ${sub}`).toBeDefined();
        expect(sub, `${key}가 자기 자신을 하위 점수로 둔다`).not.toBe(key);
      }
    }
  });

  it("명세 §53 우선 점수는 모두 정의돼 있다(AI Inflation Gap은 두 점수의 뺄셈)", () => {
    for (const k of V1_PRIORITY) {
      if (k === "ai_inflation_gap") {
        expect(SCORE_DEFINITIONS.ai_demand).toBeDefined();
        expect(SCORE_DEFINITIONS.ai_productivity).toBeDefined();
      } else expect(SCORE_DEFINITIONS[k], k).toBeDefined();
    }
  });

  it("명세 §31 — 시장·지정학 결합은 0.70 · 0.30", () => {
    expect(SCORE_DEFINITIONS.market_risk_geopolitical.components).toEqual({ market_stress: 0.7, geopolitical_stress: 0.3 });
  });
});

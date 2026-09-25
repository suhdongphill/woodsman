import { describe, expect, it } from "vitest";
import { buildGcrmFrame, type GcrmSnapshot } from "./home-frame";

const row = (pillar: string, scoreRaw: number | null, coverage: number, status = "OK", axis = "tide") => ({
  pillar, axis, scoreRaw, coverage, status,
});

/** 9/25 운영 run의 모양 — 조류 축만 쓴다. 다른 축 값이 섞이면 안 된다. */
const now: GcrmSnapshot = {
  asOf: "2026-09-25",
  regimeLabel: "판정 보류",
  pillars: [
    row("liquidity", 51.79, 0.71),
    row("liquidity", 10, 0.9, "OK", "wave"),
    row("engine_heat", 69.51, 0.9),
    row("market_risk", 46.62, 0.71),
    row("risk_transmission", 53.56, 0.7),
    row("rate_absorption", null, 0.4, "INSUFFICIENT"),
    row("dollar_network", null, 0.3955, "INSUFFICIENT"),
  ],
};

describe("홈 GCRM 줄 (v2)", () => {
  it("조류 축 값으로 칩을 채우고, 위험 전이가 발행된다", () => {
    const f = buildGcrmFrame(now);
    expect(f.chips.map((c) => [c.label, c.value && Math.round(c.value)])).toEqual([
      ["유동성", 52], ["엔진 온도", 70], ["시장위험·지정학", 47], ["위험 전이", 54],
      ["금리 감내력", undefined], ["달러 네트워크", undefined],
    ]);
    expect(f.publishedCount).toBe(4);
    expect(f.show).toBe(true);
    expect(f.regimeLabel).toBe("판정 보류");
  });

  it("⚠ 자료 부족은 「준비 중」이 아니라 이유와 커버리지로 적는다", () => {
    const f = buildGcrmFrame(now);
    expect(f.chips[4].pendingReason).toBe("자료 부족 · 커버리지 40%");
    expect(f.summary).toContain("금리 감내력·달러 네트워크는 자료 부족으로 발행하지 않음");
    expect(f.summary).not.toContain("준비 중");
  });

  it("조사는 마지막 이름을 따른다(은/는)", () => {
    // 달러 네트워크가 발행되면 빠진 것은 금리 감내력 하나 — 받침이 있어 「은」
    const one: GcrmSnapshot = {
      ...now,
      pillars: [...now.pillars.filter((p) => p.pillar !== "dollar_network"), row("dollar_network", 55, 0.7)],
    };
    expect(buildGcrmFrame(one).summary).toContain("금리 감내력은 자료 부족");
  });

  it("커버리지 80% 아래는 🟡 낮은 신뢰", () => {
    const f = buildGcrmFrame(now);
    expect(f.chips[0].lowConfidence).toBe(true);
    expect(f.chips[1].lowConfidence).toBe(false);
  });

  it("방향: 4주 전 run과 비교 · 불감대 2점 안은 보합 · 비교할 run이 없으면 「비교 없음」", () => {
    const earlier: GcrmSnapshot = { ...now, asOf: "2026-08-28", pillars: [row("liquidity", 45, 0.7), row("engine_heat", 68.5, 0.9)] };
    const f = buildGcrmFrame(now, earlier);
    expect(f.chips[0].dir4).toBe("up");
    expect(f.chips[1].dir4).toBe("flat");
    expect(f.chips[2].dir4).toBe("unknown");
    expect(buildGcrmFrame(now).chips[0].dir4).toBe("unknown");
    // 같은 날 run은 비교가 아니다
    expect(buildGcrmFrame(now, now).chips[0].dir4).toBe("unknown");
  });

  it("발행 점수가 둘보다 적으면 줄을 그리지 않는다", () => {
    const thin: GcrmSnapshot = { ...now, pillars: [row("liquidity", 50, 0.9)] };
    expect(buildGcrmFrame(thin).show).toBe(false);
  });

  it("매수·매도 표현을 쓰지 않는다", () => {
    expect(buildGcrmFrame(now).summary).not.toMatch(/매수|매도|사라|팔라|비중을 늘/);
  });
});

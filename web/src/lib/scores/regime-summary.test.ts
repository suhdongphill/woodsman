/**
 * Global Capital Regime 프레임 테스트 — **없는 숫자를 있는 것처럼 말하는 길**을 막는다.
 *
 * 이 프레임의 위험은 계산이 틀리는 게 아니라, 아직 매핑도 안 된 점수를 문장이 말해 버리는 것이다.
 * 그래서 "잘 쓴다"보다 "못 쓰는 것을 안 쓴다"를 더 많이 잰다.
 */
import { describe, expect, it } from "vitest";
import {
  MIN_PUBLISHED_TO_SHOW,
  REGIME_CHIP_KEYS,
  buildRegimeFrame,
  type RegimeFrame,
} from "./regime-summary";
import type { TideReading } from "./tide";

function reading(
  scoreKey: string,
  value: number | null,
  state: string,
  coverage = 90,
  dir4: TideReading["dir4"] = "flat",
): TideReading {
  return {
    scoreKey,
    latest: { scoreKey, value, state, coverage, asOf: "2026-09-16" } as TideReading["latest"],
    dir4,
    dir13: "flat",
    pastRecomputed: false,
    stale: false,
  };
}

/** 오늘(2026-09-16) 운영과 같은 모양 — 발행 둘, 나머지는 행조차 없다. */
function today(): Map<string, TideReading | undefined> {
  return new Map([
    ["global_liquidity", reading("global_liquidity", 45.9, "OK", 80, "flat")],
    ["engine_heat", reading("engine_heat", 52.9, "OK", 90, "up")],
  ]);
}

describe("프레임을 낼 것인가", () => {
  it("발행 점수가 2개 미만이면 뜨지 않는다 — 자리부터 만들고 채우지 않는다", () => {
    const one = new Map([["global_liquidity", reading("global_liquidity", 45.9, "OK")]]);
    expect(buildRegimeFrame(one).show).toBe(false);
    expect(buildRegimeFrame(new Map()).show).toBe(false);
  });

  it("발행 점수가 2개면 뜬다(오늘의 운영 상태)", () => {
    const frame = buildRegimeFrame(today());
    expect(frame.show).toBe(true);
    expect(frame.publishedCount).toBe(MIN_PUBLISHED_TO_SHOW);
    expect(frame.totalCount).toBe(REGIME_CHIP_KEYS.length);
  });

  it("⚠ DO_NOT_PUBLISH는 발행이 아니다 — 값이 있어도 세지 않는다", () => {
    const m = today();
    m.set("risk_transmission", reading("risk_transmission", 71, "DO_NOT_PUBLISH", 30));
    const frame = buildRegimeFrame(m);
    expect(frame.publishedCount).toBe(2);
    expect(frame.chips.find((c) => c.scoreKey === "risk_transmission")?.value).toBeUndefined();
  });
});

describe("한 줄 요약", () => {
  const frame = (): RegimeFrame => buildRegimeFrame(today());

  it("발행된 점수만 숫자로 말한다", () => {
    const s = frame().summary;
    expect(s).toContain("유동성 46");
    expect(s).toContain("엔진 온도 53");
  });

  it("⭐ 미발행 점수의 숫자를 문장에 넣지 않는다 — 이름만 「준비 중」으로", () => {
    const s = frame().summary;
    expect(s).toContain("준비 중");
    for (const label of ["시장위험·지정학", "위험 전달", "금리 흡수력", "달러 역설"]) {
      expect(s).toContain(label);
    }
    // 미발행 자리에 숫자가 붙지 않는다
    expect(s).not.toMatch(/(시장위험·지정학|위험 전달|금리 흡수력|달러 역설)\s*\d/);
  });

  it("방향은 비교할 과거가 있을 때만 말한다", () => {
    const m = new Map([
      ["global_liquidity", reading("global_liquidity", 45.9, "OK", 80, "unknown")],
      ["engine_heat", reading("engine_heat", 52.9, "OK", 90, "up")],
    ]);
    const s = buildRegimeFrame(m).summary;
    expect(s).toContain("엔진 온도 53(평소 수준 · 4주 오르는 쪽)");
    expect(s).toContain("유동성 46(평소 수준)");
    expect(s).not.toContain("유동성 46(평소 수준 · 4주");
  });

  it("⚠ 매수·매도·권유 표현이 들어가지 않는다", () => {
    const s = buildRegimeFrame(today()).summary;
    for (const word of ["매수", "매도", "사", "팔", "비중 확대", "비중 축소", "추천", "권장"]) {
      expect(s).not.toContain(word);
    }
  });

  it("발행이 하나도 없으면 지어내지 않고 없다고 적는다", () => {
    expect(buildRegimeFrame(new Map()).summary).toContain("아직 없습니다");
  });
});

describe("칩", () => {
  it("미발행이 4개 이상이면 칩 줄을 접는다 — 빈 칸 여섯 개를 늘어놓지 않는다", () => {
    expect(buildRegimeFrame(today()).collapsed).toBe(true);
  });

  it("발행이 셋이 되면 칩 줄이 펴진다(G3 뒤의 모습)", () => {
    const m = today();
    m.set("market_risk_geopolitical", reading("market_risk_geopolitical", 61, "OK", 85));
    const frame = buildRegimeFrame(m);
    expect(frame.publishedCount).toBe(3);
    expect(frame.collapsed).toBe(false);
  });

  it("🟡 낮은 신뢰를 칩이 달고 나온다", () => {
    const m = today();
    m.set("rate_absorption", reading("rate_absorption", 55, "LOW_CONFIDENCE", 65));
    const chip = buildRegimeFrame(m).chips.find((c) => c.scoreKey === "rate_absorption");
    expect(chip?.lowConfidence).toBe(true);
    expect(chip?.value).toBe(55);
  });

  it("⚠ 기준일은 발행된 점수의 것만 본다", () => {
    const m = today();
    // 미발행인데 날짜만 더 늦은 행 — 이 날짜를 프레임 머리에 적으면 안 된다
    m.set("dollar_network", {
      ...reading("dollar_network", null, "DO_NOT_PUBLISH", 10),
      latest: { scoreKey: "dollar_network", value: null, state: "DO_NOT_PUBLISH", coverage: 10, asOf: "2026-09-30" },
    } as TideReading);
    expect(buildRegimeFrame(m).asOf).toBe("2026-09-16");
  });

  it("칩 순서가 화면 순서다 — 유동성이 첫 칸", () => {
    const chips = buildRegimeFrame(today()).chips;
    expect(chips.map((c) => c.scoreKey)).toEqual([...REGIME_CHIP_KEYS]);
  });
});

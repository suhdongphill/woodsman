import { describe, expect, it } from "vitest";
import {
  applyDirection,
  centeredScore,
  levelScore,
  mad,
  median,
  robustZ,
  rollingWindow,
  zToScore,
} from "./normalize";
import {
  applyHardTriggers,
  compose,
  confidence,
  coverageOf,
  indicatorScore,
  publishState,
} from "./composite";
import { momentumScore } from "./momentum";

describe("명세 §1 — Robust Z", () => {
  it("MAD = Median(|Xi − Median(X)|)", () => {
    expect(median([1, 2, 3, 4, 100])).toBe(3);
    expect(mad([1, 2, 3, 4, 100])).toBe(1);
  });

  it("⭐ 극단값 하나가 z를 끌고 가지 않는다 — 평균·표준편차 대신 쓰는 이유", () => {
    const calm = [10, 11, 12, 13, 14, 15, 16];
    const withSpike = [...calm, 500];
    const a = robustZ(15, calm);
    const b = robustZ(15, withSpike);
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(Math.abs(a.z - b.z)).toBeLessThan(0.5);
  });

  it("±3에서 자르고, 잘랐다고 말한다", () => {
    const r = robustZ(1000, [1, 2, 3, 4, 5]);
    expect(r.ok && r.z).toBe(3);
    expect(r.ok && r.winsorized).toBe(true);
  });

  it("⚠ 흩어짐이 없으면 z를 지어내지 않는다", () => {
    expect(robustZ(5, [5, 5, 5, 5])).toEqual({ ok: false, reason: "ZERO_DISPERSION" });
  });
});

describe("명세 §1 — 10년 창 · 최소 5년", () => {
  const monthly = (fromYear: number, toYear: number) =>
    Array.from({ length: (toYear - fromYear) * 12 }, (_, i) => ({
      date: `${fromYear + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}-01`,
      value: i,
    }));

  it("⚠ 역사가 5년이 안 되면 거절한다 — 50점으로 메우지 않는다", () => {
    const r = rollingWindow(monthly(2023, 2026), "2026-09-01");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("INSUFFICIENT_HISTORY");
  });

  it("⚠ 평가일 뒤의 값은 창에 들어가지 않는다(시점 기준)", () => {
    const r = rollingWindow(monthly(2010, 2027), "2020-01-01");
    expect(r.ok).toBe(true);
    if (r.ok) expect(Math.max(...r.values)).toBe((2020 - 2010) * 12);
  });

  it("10년보다 오래된 값은 쓰지 않는다", () => {
    const r = rollingWindow(monthly(2000, 2026), "2026-01-01");
    expect(r.ok && r.from).toBe("2016-01-01");
  });
});

describe("명세 §2 — z → 0~100 (명세의 예시 그대로)", () => {
  it("Z 0 → 50 · +1 → 66.7 · +2 → 83.3 · +3 → 100 · −1 → 33.3", () => {
    expect(zToScore(0)).toBe(50);
    expect(zToScore(1)).toBeCloseTo(66.7, 1);
    expect(zToScore(2)).toBeCloseTo(83.3, 1);
    expect(zToScore(3)).toBeCloseTo(100, 1);
    expect(zToScore(-1)).toBeCloseTo(33.3, 1);
  });

  it("0~100 밖으로 나가지 않는다", () => {
    expect(zToScore(10)).toBe(100);
    expect(zToScore(-10)).toBe(0);
  });
});

describe("명세 §3 — 방향", () => {
  it("HIGH_IS_NEGATIVE는 뒤집는다(HY OAS가 높으면 점수는 낮다)", () => {
    expect(applyDirection(80, "HIGH_IS_NEGATIVE")).toBe(20);
    expect(applyDirection(80, "HIGH_IS_POSITIVE")).toBe(80);
  });

  it("NEUTRAL_CENTERED — 목표 범위 안이면 100, 벗어난 만큼 깎는다", () => {
    expect(centeredScore(2.1, { low: 1.5, high: 2.5 }, 20)).toBe(100);
    expect(centeredScore(3.5, { low: 1.5, high: 2.5 }, 20)).toBe(80);
  });

  it("수준 점수 — 창을 만들 수 없으면 이유를 돌려준다", () => {
    const r = levelScore([{ date: "2026-01-01", value: 1 }], "2026-09-01", "HIGH_IS_POSITIVE");
    expect(r.ok).toBe(false);
  });
});

describe("명세 §4 — 수준 + 모멘텀", () => {
  it("일반 0.70·0.30 · 스트레스 0.60·0.40", () => {
    expect(indicatorScore(80, 40, "general").score).toBeCloseTo(68, 5);
    expect(indicatorScore(80, 40, "stress").score).toBeCloseTo(64, 5);
  });

  it("⚠ 모멘텀이 없으면 수준만 쓰고 그렇다고 말한다", () => {
    expect(indicatorScore(70, undefined, "general")).toEqual({ score: 70, momentumUsed: false });
  });
});

describe("명세 §5 — 모멘텀", () => {
  const daily = Array.from({ length: 400 }, (_, i) => {
    const d = new Date(Date.UTC(2025, 0, 1) + i * 86_400_000).toISOString().slice(0, 10);
    return { date: d, value: 100 + Math.sin(i / 7) * 3 + i * 0.05 };
  });

  it("일간 계열은 네 조각을 모두 쓴다", () => {
    const r = momentumScore(daily, daily.at(-1)!.date, "d", "HIGH_IS_POSITIVE");
    expect(r.used).toEqual(["d5", "d20", "d60", "acceleration"]);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it("⚠ 월간 계열에서 5D(≈1주)·20D를 지어내지 않는다 — 빠진 창과 이유를 돌려준다", () => {
    const monthly = Array.from({ length: 120 }, (_, i) => ({
      date: `${2016 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}-01`,
      value: 100 + i + (i % 5),
    }));
    const r = momentumScore(monthly, monthly.at(-1)!.date, "m", "HIGH_IS_POSITIVE");
    expect(r.used).not.toContain("d5");
    expect(r.skipped.map((s) => s.window)).toContain("d5");
  });
});

describe("명세 §43~§44 — 커버리지와 발행", () => {
  const w = (key: string, weight: number, score?: number) => ({ key, weight, score });

  it("⭐ 명세 예시: 가용 0.90이면 각 가중치를 0.90으로 나눠 재정규화한다", () => {
    const r = compose([w("a", 0.5, 80), w("b", 0.4, 60), w("c", 0.1, undefined)]);
    expect(r.coverage).toBe(90);
    expect(r.state).toBe("OK");
    expect(r.contributions[0].effectiveWeight).toBeCloseTo(0.5 / 0.9, 10);
    expect(r.score).toBeCloseTo((0.5 * 80 + 0.4 * 60) / 0.9, 1);
  });

  it("⚠ 60% 미만이면 계산값이 있어도 내보내지 않는다", () => {
    const r = compose([w("a", 0.5, 80), w("b", 0.5, undefined)]);
    expect(r.coverage).toBe(50);
    expect(r.state).toBe("DO_NOT_PUBLISH");
    expect(r.score).toBeUndefined();
  });

  it("60~80%는 LOW_CONFIDENCE로 낸다", () => {
    expect(publishState(79.9)).toBe("LOW_CONFIDENCE");
    expect(publishState(60)).toBe("LOW_CONFIDENCE");
    expect(publishState(80)).toBe("OK");
  });

  it("⚠ 결측을 0점으로 치지 않는다 — 기여도는 0, 이유는 남긴다", () => {
    const r = compose([
      { key: "a", weight: 0.9, score: 50 },
      { key: "move", weight: 0.1, missingReason: "무료 출처 없음(ICE 라이선스)" },
    ]);
    expect(r.score).toBe(50);
    expect(r.contributions[1]).toMatchObject({ points: 0, missingReason: "무료 출처 없음(ICE 라이선스)" });
  });

  it("기여도의 합이 점수다", () => {
    const r = compose([w("a", 0.25, 70), w("b", 0.35, 40), w("c", 0.4, 90)]);
    const sum = r.contributions.reduce((s, c) => s + c.points, 0);
    expect(r.score).toBeCloseTo(sum, 1);
    expect(coverageOf([w("a", 0.25, 70), w("b", 0.75)])).toBe(25);
  });
});

describe("명세 §42 · §45", () => {
  it("신뢰도 — 부분이 모두 100이면 100", () => {
    expect(
      confidence({ sourceQuality: 100, freshness: 100, coverage: 100, revisionStability: 100, frequencyMatch: 100, crossConfirmation: 100 }),
    ).toBe(100);
  });

  it("하드 트리거 — 발동한 것 중 가장 낮은 상한을 적용한다", () => {
    const r = applyHardTriggers(72, [
      { id: "funding>=85", cap: 40, fired: true },
      { id: "funding&credit", cap: 30, fired: true },
      { id: "systemic", cap: 20, fired: false },
    ]);
    expect(r.score).toBe(30);
    expect(r.applied).toEqual(["funding>=85", "funding&credit"]);
  });

  it("발동하지 않으면 점수를 건드리지 않는다", () => {
    expect(applyHardTriggers(72, [{ id: "x", cap: 20, fired: false }]).score).toBe(72);
  });
});

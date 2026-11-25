import { describe, expect, it } from "vitest";
import {
  estimateFedHike,
  fedHikeSentence,
  formatProbability,
  hikeOverHoldThreshold,
  lastMeetingDecision,
} from "./fedhike";

/**
 * ⚠ 2026-11-25 현재값 — `docs/연구_테일러준칙_계수근거_2026-11-24.md` 「현재 값 대입」과 볼트 `fed-hike-prob.py`가
 * 같은 투입값에서 같은 숫자를 내야 한다(한 사건에 두 숫자 금지). 이 테스트가 깨졌다면 식을 고친 것 — 볼트도 같이.
 * 손계산: R* = 1.2 + 3.107 + 0.5·1.107 + (4.2 − 4.1) = 4.9605 · 중간값 3.875 · x = 1.0855
 *         xb = 0.38395·1.0855 = 0.41677 · 인하 L(−1.7640 − 0.4168) = 10.15% · 인상 1 − L(2.4364 − 0.4168) = 11.71%
 */
const NOW_2026_11 = { corePce: 3.107, targetUpper: 4.0, unrate: 4.1, lastDecision: 0 as const };

describe("연준 방향 확률 — 과거 추정 모형(S2)", () => {
  it("2026-11 현재값을 재현한다", () => {
    const r = estimateFedHike(NOW_2026_11)!;
    expect(r.prescribedRate).toBeCloseTo(4.9605, 3);
    expect(r.policyRate).toBeCloseTo(3.875, 10);
    expect(r.gap).toBeCloseTo(1.0855, 3);
    expect(r.hike).toBeCloseTo(0.1171, 3);
    expect(r.cut).toBeCloseTo(0.1015, 3);
    expect(r.hold).toBeCloseTo(0.7814, 3);
    // 인상 − 인하 1.6%p → 경계 10%p 안 → 중립(라벨이 막대와 같은 말을 한다)
    expect(r.bias).toBe("neutral");
  });

  it("확률 셋의 합은 1이다", () => {
    const r = estimateFedHike(NOW_2026_11)!;
    expect(r.hike + r.hold + r.cut).toBeCloseTo(1, 10);
  });

  it("직전 회의가 인상이었으면 인상 확률이 크게 오른다(관성)", () => {
    const held = estimateFedHike(NOW_2026_11)!;
    const hiked = estimateFedHike({ ...NOW_2026_11, lastDecision: 1 })!;
    expect(hiked.hike).toBeGreaterThan(0.55); // 연구 문서 「만약 직전이 인상이었다면」 59.6%(u* 차이로 소폭 다름)
    expect(hiked.hike).toBeGreaterThan(held.hike * 4);
    expect(hiked.bias).toBe("hawkish");
  });

  it("직전 회의가 인하였으면 인하 쪽으로 기운다", () => {
    const r = estimateFedHike({ ...NOW_2026_11, lastDecision: -1 })!;
    expect(r.cut).toBeGreaterThan(r.hike);
    expect(r.bias).toBe("dovish");
  });
});

describe("결측 처리", () => {
  it("⚠ 필수 넷 중 하나라도 없으면 계산하지 않는다", () => {
    expect(estimateFedHike({ targetUpper: 4, unrate: 4.1, lastDecision: 0 })).toBeUndefined();
    expect(estimateFedHike({ corePce: 3.1, unrate: 4.1, lastDecision: 0 })).toBeUndefined();
    expect(estimateFedHike({ corePce: 3.1, targetUpper: 4, lastDecision: 0 })).toBeUndefined();
    expect(estimateFedHike({ corePce: 3.1, targetUpper: 4, unrate: 4.1 })).toBeUndefined();
    expect(estimateFedHike({})).toBeUndefined();
  });

  it("NaN은 값이 없는 것으로 본다", () => {
    expect(estimateFedHike({ ...NOW_2026_11, corePce: Number.NaN })).toBeUndefined();
  });
});

describe("방향", () => {
  it("처방갭이 크게 +면 인상이 인하보다 높다", () => {
    const r = estimateFedHike({ corePce: 5, targetUpper: 1, unrate: 4.2, lastDecision: 0 })!;
    expect(r.gap).toBeGreaterThan(0);
    expect(r.hike).toBeGreaterThan(r.cut);
  });

  it("처방갭이 크게 −면 인하가 인상보다 높다", () => {
    const r = estimateFedHike({ corePce: 1.5, targetUpper: 6, unrate: 4.2, lastDecision: 0 })!;
    expect(r.gap).toBeLessThan(0);
    expect(r.cut).toBeGreaterThan(r.hike);
    expect(r.bias).toBe("dovish");
  });

  it("실업률이 자연실업률보다 높으면 처방금리가 내려간다(오쿤 근사)", () => {
    const tight = estimateFedHike({ ...NOW_2026_11, unrate: 3.2 })!;
    const slack = estimateFedHike({ ...NOW_2026_11, unrate: 5.2 })!;
    expect(slack.prescribedRate).toBeLessThan(tight.prescribedRate);
  });
});

describe("lastMeetingDecision — 회의 전날 vs +3일", () => {
  const pts = (pairs: [string, number][]) => pairs.map(([date, value]) => ({ date, value }));

  it("목표 상단이 그대로면 동결", () => {
    expect(lastMeetingDecision(pts([["2026-10-27", 4], ["2026-10-29", 4], ["2026-11-24", 4]]), "2026-10-28")).toBe(0);
  });

  it("오르면 인상 · 내리면 인하", () => {
    expect(lastMeetingDecision(pts([["2026-09-15", 3.75], ["2026-09-17", 4]]), "2026-09-16")).toBe(1);
    expect(lastMeetingDecision(pts([["2026-09-15", 4.25], ["2026-09-17", 4]]), "2026-09-16")).toBe(-1);
  });

  it("+3일 뒤의 변화는 그 회의 결정이 아니다", () => {
    expect(lastMeetingDecision(pts([["2026-10-27", 4], ["2026-10-29", 4], ["2026-11-05", 4.25]]), "2026-10-28")).toBe(0);
  });

  it("⚠ 회의 뒤 관측이 아직 없으면 모른다 — 「동결」로 읽지 않는다", () => {
    expect(lastMeetingDecision(pts([["2026-10-27", 4], ["2026-10-28", 4]]), "2026-10-28")).toBeUndefined();
    expect(lastMeetingDecision(pts([["2026-10-29", 4]]), "2026-10-28")).toBeUndefined();
    expect(lastMeetingDecision([], "2026-10-28")).toBeUndefined();
  });

  it("순서가 섞여 들어와도 같다", () => {
    expect(lastMeetingDecision(pts([["2026-09-17", 4], ["2026-09-15", 3.75]]), "2026-09-16")).toBe(1);
  });
});

describe("문장·표기", () => {
  it("한 문장 요약에 숫자·기준일·직전 결정이 함께 들어간다", () => {
    const s = fedHikeSentence(estimateFedHike(NOW_2026_11)!, "2026-11-25");
    expect(s).toContain("2026-11-25");
    expect(s).toContain("4.96%");
    expect(s).toContain("3.875%");
    expect(s).toContain("직전 회의 결정(동결)");
    expect(s).toContain("11.7%");
    expect(s).toContain("중립");
  });

  it("⚠ 요약 문장이 매매 지시로 넘어가지 않는다", () => {
    const s = fedHikeSentence(estimateFedHike(NOW_2026_11)!, "2026-11-25");
    expect(s).not.toMatch(/매수|매도|사세요|파세요|추천/);
  });

  it("백분율은 소수 한 자리", () => {
    expect(formatProbability(0.3554)).toBe("35.5%");
    expect(formatProbability(1)).toBe("100.0%");
  });
});

describe("hikeOverHoldThreshold", () => {
  it("직전 동결이면 인상이 동결을 앞서는 처방갭은 크다(동결이 기본값)", () => {
    const x = hikeOverHoldThreshold(0);
    // 1 − L(a2 − βx) = L(a2 − βx) − L(a1 − βx) 근방 — 손으로 푼 값 약 +7.2%p
    expect(x).toBeGreaterThan(6);
    expect(x).toBeLessThan(8.5);
  });

  it("직전이 인상이면 문턱이 크게 낮아진다", () => {
    expect(hikeOverHoldThreshold(1)).toBeLessThan(hikeOverHoldThreshold(0) - 5);
  });
});

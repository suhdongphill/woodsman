import { describe, expect, it } from "vitest";
import { estimateFedHike, fedHikeSentence, formatProbability } from "./fedhike";

/**
 * ⚠ 이 값은 볼트 대시보드(`02_Macro/매크로 지표 대시보드.html`)의 2026-08-11 `fedhike` 블록이다.
 * 같은 투입값을 넣으면 같은 숫자가 나와야 한다 — **한 사건에 두 숫자가 나오면 둘 다 못 믿는다.**
 * 이 테스트가 깨졌다면 식을 고친 것이므로 볼트 스크립트도 같이 고쳐야 한다.
 */
const VAULT_2026_08_11 = {
  corePce: 3.3,
  fedFunds: 3.63,
  unrate: 4.1,
  ism: 55.6,
  umcsent: 49.5,
  breakeven5y: 2.25,
  ppiYoy: 10.1,
  wti: 81.96,
};

describe("연준 인상확률 — 볼트 스크립트와 같은 숫자", () => {
  it("2026-08-11 대시보드 값을 그대로 재현한다", () => {
    const r = estimateFedHike(VAULT_2026_08_11)!;

    expect(r.prescribedRate).toBeCloseTo(4.55, 2); // i_star
    expect(r.gap).toBeCloseTo(0.92, 2);
    expect(r.adjustedGap).toBeCloseTo(1.01, 2); // adj_gap
    expect(r.hike).toBeCloseTo(0.355, 3);
    expect(r.hold).toBeCloseTo(0.623, 3);
    expect(r.cut).toBeCloseTo(0.022, 3);
    expect(r.biasLabel).toBe("매파(인상 편향)");
  });

  it("확률 셋의 합은 1이다", () => {
    const r = estimateFedHike(VAULT_2026_08_11)!;
    expect(r.hike + r.hold + r.cut).toBeCloseTo(1, 10);
  });

  it("보정 내역을 따로 낸다 — 왜 그 숫자인지 화면이 보여줄 수 있게", () => {
    const r = estimateFedHike(VAULT_2026_08_11)!;
    expect(r.adjustments.costPush).toBeCloseTo(0.3, 3); // PPI 10.1(+0.2) + BEI 2.25(+0.1)
    expect(r.adjustments.growth).toBe(0); // ISM 55.6 → 50 위라 차감 없음
    expect(r.adjustments.sentiment).toBeCloseTo(0.205, 3); // (70−49.5)×0.01
  });
});

describe("결측 처리", () => {
  it("⚠ 필수 셋 중 하나라도 없으면 계산하지 않는다", () => {
    expect(estimateFedHike({ fedFunds: 3.63, unrate: 4.1 })).toBeUndefined();
    expect(estimateFedHike({ corePce: 3.3, unrate: 4.1 })).toBeUndefined();
    expect(estimateFedHike({ corePce: 3.3, fedFunds: 3.63 })).toBeUndefined();
    expect(estimateFedHike({})).toBeUndefined();
  });

  it("필수 셋만 있어도 계산하고, 빠진 보정 지표를 목록으로 남긴다", () => {
    const r = estimateFedHike({ corePce: 3.3, fedFunds: 3.63, unrate: 4.1 })!;
    expect(r.adjustedGap).toBeCloseTo(r.gap, 10); // 보정이 하나도 안 붙는다
    expect(r.missingOptional).toHaveLength(5);
    expect(r.usedOptional).toHaveLength(0);
  });

  it("⚠ '보정이 0'과 '보정을 못 했다'를 구분한다", () => {
    // ISM 55.6은 재 봤더니 차감이 0인 경우 — 값이 없어 건너뛴 것과 다르다.
    const measured = estimateFedHike({ ...VAULT_2026_08_11 })!;
    expect(measured.adjustments.growth).toBe(0);
    expect(measured.adjustmentsApplied.growth).toBe(true);

    const skipped = estimateFedHike({ corePce: 3.3, fedFunds: 3.63, unrate: 4.1 })!;
    expect(skipped.adjustments.growth).toBe(0);
    expect(skipped.adjustmentsApplied.growth).toBe(false);
    expect(skipped.adjustmentsApplied.costPush).toBe(false);
    expect(skipped.adjustmentsApplied.sentiment).toBe(false);
  });

  it("NaN은 값이 없는 것으로 본다", () => {
    expect(estimateFedHike({ corePce: Number.NaN, fedFunds: 3.63, unrate: 4.1 })).toBeUndefined();
  });
});

describe("방향", () => {
  it("정책이 처방보다 완화적이면 인상 확률이 인하보다 높다", () => {
    const r = estimateFedHike({ corePce: 4, fedFunds: 1, unrate: 4.2 })!;
    expect(r.gap).toBeGreaterThan(0);
    expect(r.hike).toBeGreaterThan(r.cut);
    expect(r.bias).toBe("hawkish");
  });

  it("정책이 처방보다 긴축적이면 인하 확률이 인상보다 높다", () => {
    const r = estimateFedHike({ corePce: 1.5, fedFunds: 5.5, unrate: 4.2 })!;
    expect(r.gap).toBeLessThan(0);
    expect(r.cut).toBeGreaterThan(r.hike);
    expect(r.bias).toBe("dovish");
  });

  it("처방갭이 0 근처면 중립이고 동결이 가장 크다", () => {
    // i* = 0.5 + π + 0.5(π−2) + 0.5·0 이므로 π=2, u=4.2면 i*=2.5
    const r = estimateFedHike({ corePce: 2, fedFunds: 2.5, unrate: 4.2 })!;
    expect(r.bias).toBe("neutral");
    expect(r.hold).toBeGreaterThan(r.hike);
    expect(r.hold).toBeGreaterThan(r.cut);
  });

  it("실업률이 자연실업률보다 높으면 처방금리가 내려간다(오쿤 근사)", () => {
    const tight = estimateFedHike({ corePce: 3, fedFunds: 3, unrate: 3.2 })!;
    const slack = estimateFedHike({ corePce: 3, fedFunds: 3, unrate: 5.2 })!;
    expect(slack.prescribedRate).toBeLessThan(tight.prescribedRate);
  });

  it("심리가 무너지면 압력지수가 비둘기 쪽으로 밀린다", () => {
    const base = estimateFedHike({ corePce: 3.3, fedFunds: 3.63, unrate: 4.1, umcsent: 90 })!;
    const weak = estimateFedHike({ corePce: 3.3, fedFunds: 3.63, unrate: 4.1, umcsent: 40 })!;
    expect(weak.adjustedGap).toBeLessThan(base.adjustedGap);
    expect(weak.adjustments.sentiment).toBeCloseTo(0.3, 3); // 상한 0.40에 걸리기 전
  });

  it("심리 보정에는 상한이 있다 — 한 지표가 판정을 통째로 끌고 가지 않게", () => {
    const r = estimateFedHike({ corePce: 3.3, fedFunds: 3.63, unrate: 4.1, umcsent: 10 })!;
    expect(r.adjustments.sentiment).toBe(0.4);
  });
});

describe("문장·표기", () => {
  it("한 문장 요약에 숫자와 기준일이 함께 들어간다", () => {
    const r = estimateFedHike(VAULT_2026_08_11)!;
    const s = fedHikeSentence(r, "2026-08-11");
    expect(s).toContain("2026-08-11");
    expect(s).toContain("4.55%");
    expect(s).toContain("35.5%");
    expect(s).toContain("매파");
  });

  it("⚠ 요약 문장이 매매 지시로 넘어가지 않는다", () => {
    const s = fedHikeSentence(estimateFedHike(VAULT_2026_08_11)!, "2026-08-11");
    expect(s).not.toMatch(/매수|매도|사세요|파세요|추천/);
  });

  it("백분율은 소수 한 자리", () => {
    expect(formatProbability(0.3554)).toBe("35.5%");
    expect(formatProbability(1)).toBe("100.0%");
  });
});

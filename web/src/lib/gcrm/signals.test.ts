/**
 * GCRM v2 — 채널 · 승격 · 급성 경보 테스트 (명세 §2-10 ~ §2-12 · 단계 6).
 *
 * ★ 단계 6이 요구한 셋:
 * 1. 명세 Part 3 예시 5 재현
 * 2. 같은 채널 지표 4개가 움직여도 확인 수가 **1**로 집계되는가
 * 3. 급성 경보와 승격이 **동시에** 켜질 수 있는가
 */
import { describe, it, expect } from "vitest";
import {
  channelsOf,
  confirmationOf,
  waveToWind,
  windToTide,
  maturityStage,
  acuteWatch,
  acuteExpired,
  type Movement,
  type RawReading,
} from "./signals";
import { ACUTE, WAVE_TO_WIND, WIND_TO_TIDE } from "./config/promotion";
import { CONFIRMATION } from "./config/channels";
import type { Direction } from "./alignment";

const mv = (indicator: string, direction: Direction = "DOWN"): Movement => ({ indicator, direction });
const days = (pattern: Direction[]) => pattern;

// ═════════════════════════════════════════════════════════════════════════
describe("★ 2. 같은 채널은 몇 개가 움직여도 1표다 (B-9)", () => {
  it("PRICE 지표 넷이 함께 빠져도 확인 채널은 1이다", () => {
    // 위험회피 국면에서 실제로 함께 움직이는 넷이다
    const conf = confirmationOf([mv("sox"), mv("vix"), mv("vvix"), mv("spx_etf")], "DOWN");
    expect(conf.channelCount).toBe(1);
    expect(conf.channels).toEqual(["PRICE"]);
    expect(conf.byChannel.PRICE).toHaveLength(4);
  });

  it("⚠ VIX는 PRICE다 — 주식과 주식 변동성은 별개 채널이 아니다", () => {
    expect(channelsOf("vix")).toEqual(["PRICE"]);
    expect(channelsOf("vvix")).toEqual(["PRICE"]);
    expect(channelsOf("skew")).toEqual(["PRICE"]);
    expect(channelsOf("spx_etf")).toEqual(["PRICE"]);
  });

  it("서로 다른 채널이면 그만큼 센다", () => {
    const conf = confirmationOf([mv("spx_etf"), mv("hy_spread"), mv("sofr_iorb")], "DOWN");
    expect(conf.channelCount).toBe(3);
    expect(conf.channels.sort()).toEqual(["CREDIT", "FUNDING", "PRICE"]);
  });

  it("⚠ 방향이 다른 움직임은 같은 확인으로 묶지 않는다", () => {
    const conf = confirmationOf(
      [mv("spx_etf", "DOWN"), mv("hy_spread", "UP"), mv("sofr_iorb", "DOWN")],
      "DOWN",
    );
    expect(conf.channelCount).toBe(2); // CREDIT은 반대 방향이라 빠진다
    expect(conf.channels).not.toContain("CREDIT");
  });

  it("PRICE+CREDIT+FUNDING 조합에 1.25배가 붙는다", () => {
    const combo = confirmationOf([mv("spx_etf"), mv("hy_spread"), mv("sofr_iorb")], "DOWN");
    expect(combo.hasCombo).toBe(true);
    expect(combo.weighted).toBeCloseTo(3 * CONFIRMATION.comboMultiplier, 10);

    const noCombo = confirmationOf([mv("spx_etf"), mv("hy_spread"), mv("ust10y")], "DOWN");
    expect(noCombo.hasCombo).toBe(false);
    expect(noCombo.weighted).toBe(3);
  });

  it("한 지표가 두 채널에 속하면 둘 다 센다 (FIMA 풀)", () => {
    expect(channelsOf("rrp_foreign").sort()).toEqual(["FUNDING", "FX"]);
    expect(confirmationOf([mv("rrp_foreign")], "DOWN").channelCount).toBe(2);
  });
});

// ═════════════════════════════════════════════════════════════════════════
describe("★ 1. 명세 Part 3 예시 5 — 급성 경보와 레짐의 분리", () => {
  /**
   * VIX 41 · HY OAS 5일 +130bp · SOFR−IORB +18bp · S&P −4.2%
   * 확인 채널: PRICE, CREDIT, FUNDING (3개)
   */
  const readings: RawReading[] = [
    { indicator: "vix", level: 41 },
    { indicator: "hy_spread", changes: { 5: 1.3 } }, // +130bp = +1.3%p
    { indicator: "sofr_iorb", level: 0.18 }, // +18bp
    { indicator: "spx_etf", changes: { 1: -4.2 } },
  ];

  it("ACUTE_TRANSITION_WATCH = True", () => {
    const r = acuteWatch(readings);
    expect(r.watch).toBe(true);
    expect(r.channels.sort()).toEqual(["CREDIT", "FUNDING", "PRICE"]);
    expect(r.channelCount).toBe(3);
  });

  it("⚠ REGIME_CHANGE = False — 항상", () => {
    const r = acuteWatch(readings);
    expect(r.regimeChange).toBe(false);
    // 타입이 리터럴 false라 다른 값을 넣는 코드는 컴파일되지 않는다
    expect(ACUTE.neverChangesRegime).toBe(true);
  });

  it("네 지표가 걸렸지만 채널은 셋이다 — VIX와 S&P는 같은 PRICE다", () => {
    const r = acuteWatch(readings);
    expect(r.triggers).toHaveLength(4);
    expect(r.channelCount).toBe(3);
  });

  it("어느 임계가 왜 걸렸는지 그대로 돌려준다", () => {
    const r = acuteWatch(readings);
    const hy = r.triggers.find((t) => t.indicator === "hy_spread")!;
    expect(hy.threshold).toBe(1.0);
    expect(hy.actual).toBe(1.3);
    expect(hy.op).toBe("gte");
    const spx = r.triggers.find((t) => t.indicator === "spx_etf")!;
    expect(spx.op).toBe("lte");
    expect(spx.actual).toBe(-4.2);
  });
});

// ═════════════════════════════════════════════════════════════════════════
describe("§2-12 급성 경보", () => {
  it("⚠ 백분위가 아니라 원시값으로 판정한다 — 백분위로는 2018과 2020이 같아 보인다", () => {
    expect(acuteWatch([{ indicator: "vix", level: 41 }]).triggers).toHaveLength(1);
    expect(acuteWatch([{ indicator: "vix", level: 34.9 }]).triggers).toHaveLength(0);
  });

  it("채널이 셋 미만이면 경보가 아니다 — 이유를 돌려준다", () => {
    // VIX와 S&P 둘 다 PRICE라 채널은 1개뿐이다
    const r = acuteWatch([
      { indicator: "vix", level: 50 },
      { indicator: "spx_etf", changes: { 1: -6 } },
    ]);
    expect(r.watch).toBe(false);
    expect(r.channelCount).toBe(1);
    expect(r.reason).toContain("1표");
  });

  it("임계를 넘은 지표가 없으면 그렇게 말한다", () => {
    const r = acuteWatch([{ indicator: "vix", level: 12 }]);
    expect(r.watch).toBe(false);
    expect(r.reason).toBe("원시값 임계를 넘은 지표가 없다");
  });

  it("변화 임계는 맞는 기간의 값만 본다", () => {
    // hy_spread 임계는 5영업일 변화다. 1일 변화만 주면 판정하지 않는다
    expect(acuteWatch([{ indicator: "hy_spread", changes: { 1: 5 } }]).triggers).toHaveLength(0);
    expect(acuteWatch([{ indicator: "hy_spread", changes: { 5: 1.1 } }]).triggers).toHaveLength(1);
  });

  it("관측이 없는 지표는 건너뛴다 — 없는 값을 0으로 보지 않는다", () => {
    expect(acuteWatch([{ indicator: "vix" }]).triggers).toHaveLength(0);
  });

  it("24시간 뒤 자동 해제된다", () => {
    expect(acuteExpired("2026-09-18T09:00:00Z", "2026-09-19T08:59:00Z")).toBe(false);
    expect(acuteExpired("2026-09-18T09:00:00Z", "2026-09-19T09:00:00Z")).toBe(true);
    expect(ACUTE.autoClearHours).toBe(24);
  });
});

// ═════════════════════════════════════════════════════════════════════════
describe("§2-11 승격 — 파도 경보 → 바람 확인", () => {
  const threeChannels = [mv("spx_etf"), mv("hy_spread"), mv("sofr_iorb")];

  it("5영업일 중 3일 지속 AND 3개 채널이면 올라간다", () => {
    const r = waveToWind(days(["DOWN", "FLAT", "DOWN", "UP", "DOWN"]), threeChannels, "DOWN");
    expect(r.ok).toBe(true);
    expect(r.detail.sameDays).toBe(3);
  });

  it("2일뿐이면 올라가지 않는다 — 이유를 말한다", () => {
    const r = waveToWind(days(["DOWN", "FLAT", "DOWN", "UP", "UP"]), threeChannels, "DOWN");
    expect(r.ok).toBe(false);
    expect(r.reasons.join(" ")).toContain("2일");
    expect(WAVE_TO_WIND.minDays).toBe(3);
  });

  it("⚠ 같은 채널만 넷이 움직이면 지속돼도 올라가지 않는다", () => {
    const r = waveToWind(
      days(["DOWN", "DOWN", "DOWN", "DOWN", "DOWN"]),
      [mv("sox"), mv("vix"), mv("vvix"), mv("spx_etf")],
      "DOWN",
    );
    expect(r.ok).toBe(false);
    expect(r.detail.channelCount).toBe(1);
    expect(r.reasons.join(" ")).toContain("1표");
  });

  it("관측일이 모자라면 판정하지 않는다 — 짧은 이력으로 승격시키지 않는다", () => {
    const r = waveToWind(days(["DOWN", "DOWN", "DOWN"]), threeChannels, "DOWN");
    expect(r.ok).toBe(false);
    expect(r.reasons.join(" ")).toContain("3일뿐이다");
  });

  it("최신 5일만 본다 — 그 이전은 창 밖이다", () => {
    const old = days(["DOWN", "DOWN", "DOWN", "UP", "UP", "UP", "UP", "UP"]);
    const r = waveToWind(old, threeChannels, "DOWN");
    expect(r.detail.sameDays).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════
describe("§2-11 승격 — 바람 확인 → 조류 이동", () => {
  const threeChannels = [mv("spx_etf"), mv("hy_spread"), mv("sofr_iorb")];
  const withStructural = [...threeChannels, mv("corp_profits_yoy")];

  it("3주 지속 · 3채널 · 구조 지표 1개면 올라간다", () => {
    const r = windToTide(3, withStructural, "DOWN");
    expect(r.ok).toBe(true);
    expect(r.detail.structural).toEqual(["corp_profits_yoy"]);
  });

  it("⚠ 구조·실물 지표가 없으면 올라가지 않는다 — 가격은 되돌아온다", () => {
    const r = windToTide(5, threeChannels, "DOWN");
    expect(r.ok).toBe(false);
    expect(r.reasons.join(" ")).toContain("구조·실물");
    expect(WIND_TO_TIDE.minStructuralConfirmations).toBe(1);
  });

  it("2주면 올라가지 않는다", () => {
    const r = windToTide(2, withStructural, "DOWN");
    expect(r.ok).toBe(false);
    expect(r.reasons.join(" ")).toContain("2주");
  });

  it("구조 지표가 반대 방향이면 동조가 아니다", () => {
    const r = windToTide(5, [...threeChannels, mv("corp_profits_yoy", "UP")], "DOWN");
    expect(r.ok).toBe(false);
    expect(r.detail.structural).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════════
describe("§2-11 성숙도 단계", () => {
  const threeChannels = [mv("spx_etf"), mv("hy_spread"), mv("sofr_iorb")];
  const withStructural = [...threeChannels, mv("corp_profits_yoy")];
  const fiveDown = days(["DOWN", "DOWN", "DOWN", "DOWN", "DOWN"]);

  it("파도 경보가 없으면 0단계", () => {
    const r = maturityStage({
      waveAlert: false,
      recentDirections: fiveDown,
      persistenceWeeks: 9,
      movements: withStructural,
      direction: "DOWN",
    });
    expect(r.stage).toBe(0);
    expect(r.code).toBe("NOISE");
  });

  it("파도만 있으면 1단계", () => {
    const r = maturityStage({
      waveAlert: true,
      recentDirections: days(["DOWN", "UP", "UP", "UP", "UP"]),
      persistenceWeeks: 0,
      movements: withStructural,
      direction: "DOWN",
    });
    expect(r.stage).toBe(1);
    expect(r.code).toBe("WAVE_ALERT");
  });

  it("바람까지 확인되면 2단계", () => {
    const r = maturityStage({
      waveAlert: true,
      recentDirections: fiveDown,
      persistenceWeeks: 1,
      movements: withStructural,
      direction: "DOWN",
    });
    expect(r.stage).toBe(2);
    expect(r.code).toBe("WIND_CONFIRMATION");
  });

  it("조류 이동은 3단계 — 레짐 확정은 P6이 한다", () => {
    const r = maturityStage({
      waveAlert: true,
      recentDirections: fiveDown,
      persistenceWeeks: 3,
      movements: withStructural,
      direction: "DOWN",
    });
    expect(r.stage).toBe(3);
    expect(r.blockedBy.join(" ")).toContain("P6");
  });

  it("레짐이 확정되면 4단계", () => {
    const r = maturityStage({
      waveAlert: true,
      recentDirections: fiveDown,
      persistenceWeeks: 3,
      movements: withStructural,
      direction: "DOWN",
      regimeConfirmed: true,
    });
    expect(r.stage).toBe(4);
    expect(r.code).toBe("REGIME_CONFIRMED");
  });

  it("⚠ 단계를 건너뛰지 않는다 — 3주 지속이어도 파도 5일이 없으면 2단계로 못 간다", () => {
    const r = maturityStage({
      waveAlert: true,
      recentDirections: days(["UP", "UP", "UP", "UP", "UP"]),
      persistenceWeeks: 9,
      movements: withStructural,
      direction: "DOWN",
    });
    expect(r.stage).toBe(1);
  });
});

// ═════════════════════════════════════════════════════════════════════════
describe("★ 3. 급성 경보와 승격은 독립이다 — 동시에 켜질 수 있다", () => {
  it("둘 다 켜진다", () => {
    const movements = [mv("spx_etf"), mv("hy_spread"), mv("sofr_iorb"), mv("corp_profits_yoy")];
    const acute = acuteWatch([
      { indicator: "vix", level: 41 },
      { indicator: "hy_spread", changes: { 5: 1.3 } },
      { indicator: "sofr_iorb", level: 0.18 },
    ]);
    const stage = maturityStage({
      waveAlert: true,
      recentDirections: days(["DOWN", "DOWN", "DOWN", "DOWN", "DOWN"]),
      persistenceWeeks: 3,
      movements,
      direction: "DOWN",
    });

    expect(acute.watch).toBe(true);
    expect(stage.stage).toBe(3); // 조류 이동
    // ⚠ 그래도 레짐은 바뀌지 않는다 — 급성 경보는 배너일 뿐이다
    expect(acute.regimeChange).toBe(false);
  });

  it("급성 경보 없이도 승격은 진행된다", () => {
    const stage = maturityStage({
      waveAlert: true,
      recentDirections: days(["DOWN", "DOWN", "DOWN", "DOWN", "DOWN"]),
      persistenceWeeks: 3,
      movements: [mv("spx_etf"), mv("hy_spread"), mv("sofr_iorb"), mv("corp_profits_yoy")],
      direction: "DOWN",
    });
    expect(acuteWatch([{ indicator: "vix", level: 12 }]).watch).toBe(false);
    expect(stage.stage).toBe(3);
  });

  it("승격 없이도 급성 경보는 뜬다 — 하루 만에 벌어진 일이다", () => {
    const acute = acuteWatch([
      { indicator: "vix", level: 41 },
      { indicator: "hy_spread", changes: { 5: 1.3 } },
      { indicator: "sofr_iorb", level: 0.18 },
    ]);
    const stage = maturityStage({
      waveAlert: true,
      recentDirections: days(["DOWN", "UP", "UP", "UP", "UP"]),
      persistenceWeeks: 0,
      movements: [mv("spx_etf")],
      direction: "DOWN",
    });
    expect(acute.watch).toBe(true);
    expect(stage.stage).toBe(1);
  });
});

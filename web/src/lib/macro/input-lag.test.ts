import { describe, expect, it } from "vitest";
import { judgeFreshness } from "./freshness";
import { inputLagLabel, laggingInputs, type ModelInput } from "./input-lag";

const NOW = new Date("2026-11-15T12:00:00Z");
const input = (key: string, asOf: string | undefined, freq: "d" | "m", opts: { staleDays?: number; manual?: boolean } = {}): ModelInput => ({
  key,
  name: key,
  source: opts.manual ? "MANUAL" : "FRED",
  asOf,
  freshness: judgeFreshness({ asOf, fetchedAt: opts.manual ? undefined : "2026-11-14T21:00:00Z", freq, staleDays: opts.staleDays, manual: !!opts.manual, now: NOW }),
});

/** 2026-11-15 운영 DB의 준칙 입력 8개(마지막 관측일 · staleDays는 sectors/*.ts 그대로) */
const LIVE = [
  input("core_pce_yoy", "2026-09-01", "m", { staleDays: 95 }),
  input("fed_funds", "2026-10-01", "m"),
  input("unrate", "2026-10-01", "m"),
  input("ism_mfg", "2026-08-01", "m", { manual: true }),
  input("umcsent", "2026-09-01", "m", { staleDays: 105 }),
  input("infl_exp_5y", "2026-11-13", "d"),
  input("ppi_yoy", "2026-10-01", "m"),
  input("wti", "2026-11-11", "d"),
];

describe("준칙 입력 지연(2026-11-15)", () => {
  it("⚠ 운영 값으로: ISM(수동 · 8/1)만 늦다 — 정상인 근원 PCE 9월분은 잡지 않는다", () => {
    const lag = laggingInputs(LIVE);
    expect(lag.map((l) => l.key)).toEqual(["ism_mfg"]);
    expect(lag[0].reason).toBe("수동·기한초과 31일");
    expect(inputLagLabel(lag)).toBe("입력 지연 1");
  });

  it("⚠ 「가장 오래된 입력 60일」 규칙이었으면 거짓 경보가 났을 값(근원 PCE 9/1 = 75일)이 정상으로 남는다", () => {
    const pce = LIVE[0];
    expect(Math.floor((NOW.getTime() - Date.parse("2026-09-01T00:00:00Z")) / 86_400_000)).toBeGreaterThan(60);
    expect(laggingInputs([pce])).toEqual([]);
  });

  it("값이 없는 입력은 「값 없음」으로 — 채우지 않는다", () => {
    const lag = laggingInputs([input("ism_mfg", undefined, "m", { manual: true })]);
    expect(lag[0].reason).toBe("값 없음");
  });

  it("모두 정상이면 배지가 없다(정상일 때 조용하다)", () => {
    expect(inputLagLabel(laggingInputs([LIVE[1], LIVE[5]]))).toBeNull();
  });
});

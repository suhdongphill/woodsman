import { describe, expect, it } from "vitest";
import type { SeriesPoint } from "../macro/series";
import { computeScore, measureSeries, type SeriesInput } from "./engine";
import { SCORE_INPUTS } from "./inputs";
import { SCORE_MEASURES } from "./measures";
import { changeSeries } from "./momentum";
import type { ScoreKey } from "./config";

const ASOF = "2026-09-10";

/** 평가일까지 `years`년짜리 일간·주간·월간 합성 계열. 값은 결정적(난수 없음)이다. */
function synth(freq: "d" | "w" | "m" | "q", years: number, base: number, drift: number, wave: number): SeriesPoint[] {
  const end = Date.parse(`${ASOF}T00:00:00Z`);
  const step = { d: 1, w: 7, m: 30, q: 91 }[freq] * 86_400_000;
  const n = Math.floor((years * 365 * 86_400_000) / step);
  const out: SeriesPoint[] = [];
  for (let i = n; i >= 0; i--) {
    const t = end - i * step;
    const k = n - i;
    out.push({ date: new Date(t).toISOString().slice(0, 10), value: base + drift * k + wave * Math.sin(k / 9) });
  }
  return out;
}

/** GLS 입력 전부를 11년치로 만든다. ⚠ 국내 역레포는 고갈 구간(0.005조)이다 — 실제와 같다. */
function glsSeries(overrides: Partial<Record<string, SeriesInput>> = {}): Map<string, SeriesInput> {
  const m = new Map<string, SeriesInput>([
    ["reserves", { points: synth("w", 11, 3.0, 0.0005, 0.2), freq: "w" }],
    ["fed_assets", { points: synth("w", 11, 7.0, 0.001, 0.3), freq: "w" }],
    ["rrp", { points: synth("d", 11, 0.005, 0, 0.001), freq: "d" }],
    ["sofr_iorb", { points: synth("d", 11, -0.02, 0, 0.03), freq: "d" }],
    ["tga", { points: synth("w", 11, 0.8, 0.00005, 0.1), freq: "w" }],
    ["auction10y_btc", { points: synth("m", 11, 2.4, 0, 0.1), freq: "m" }],
    ["baa_spread", { points: synth("d", 11, 1.8, 0, 0.3), freq: "d" }],
    ["bank_credit_yoy", { points: synth("w", 11, 5, 0, 2), freq: "w" }],
    ["sloos_ci", { points: synth("q", 11, 5, 0, 10), freq: "q" }],
    ["real10", { points: synth("d", 11, 1.5, 0.0002, 0.4), freq: "d" }],
    ["term_premium", { points: synth("d", 11, 0.5, 0, 0.4), freq: "d" }],
    ["t10y2y", { points: synth("d", 11, 0.5, 0, 0.6), freq: "d" }],
    ["dxy", { points: synth("d", 11, 100, 0, 4), freq: "d" }],
  ]);
  for (const [k, v] of Object.entries(overrides)) {
    if (v) m.set(k, v);
    else m.delete(k);
  }
  return m;
}

describe("측정 — 91일 변화", () => {
  it("각 점에서 91일 이전 중 가장 늦은 점과의 차이", () => {
    const pts = [
      { date: "2026-01-01", value: 10 },
      { date: "2026-03-01", value: 11 },
      { date: "2026-04-02", value: 13 },
      { date: "2026-07-01", value: 20 },
    ];
    // 04-02 − 91일 = 01-01 → 13−10 · 07-01 − 91일 = 04-01 → 그 이전 중 가장 늦은 점은 03-01 → 20−11
    expect(measureSeries(pts, "change91d")).toEqual([
      { date: "2026-04-02", value: 3 },
      { date: "2026-07-01", value: 9 },
    ]);
  });

  it("⭐ 선형 변화 계산은 단순 이중 루프와 같은 값을 낸다", () => {
    const pts = synth("d", 1, 50, 0.01, 2);
    const naive = (days: number) => {
      const out: SeriesPoint[] = [];
      for (let i = 0; i < pts.length; i++) {
        const target = Date.parse(`${pts[i].date}T00:00:00Z`) / 86_400_000 - days;
        let found: number | undefined;
        for (const p of pts) if (Date.parse(`${p.date}T00:00:00Z`) / 86_400_000 <= target) found = p.value;
        if (found !== undefined) out.push({ date: pts[i].date, value: pts[i].value - found });
      }
      return out;
    };
    for (const days of [7, 30, 91]) expect(changeSeries(pts, days)).toEqual(naive(days));
  });
});

describe("점수 엔진 — GLS", () => {
  it("⭐ 하위 점수가 발행 기준 미달이면 부모에서 결측이고, 이유를 말한다", () => {
    const gls = computeScore("global_liquidity", glsSeries(), ASOF);
    const treasury = gls.components.find((c) => c.key === "treasury")!;
    // 재무부: TGA 0.30 + 입찰 0.10 = 40% (단기물 비중은 운영자 결정으로 점수에서 뺐다) → 발행 안 함
    expect(treasury.score).toBeUndefined();
    expect(treasury.missingReason).toMatch(/발행 기준 미달/);
  });

  it("⚠ 국내 역레포 고갈 구간에서는 「방출」 점수를 내지 않는다 — 뜻이 뒤집히는 구간", () => {
    const fed = computeScore("fed_liquidity", glsSeries(), ASOF);
    const rrp = fed.components.find((c) => c.key === "rrp_release")!;
    expect(rrp.score).toBeUndefined();
    expect(rrp.missingReason).toMatch(/고갈 구간/);
  });

  it("⚠ 역사가 5년이 안 되는 계열은 거절한다 — 50점으로 메우지 않는다", () => {
    const fed = computeScore("fed_liquidity", glsSeries({ reserves: { points: synth("w", 3, 3, 0, 0.2), freq: "w" } }), ASOF);
    const res = fed.components.find((c) => c.key === "reserve_balances")!;
    expect(res.score).toBeUndefined();
    expect(res.missingReason).toMatch(/5년/);
  });

  it("⚠ 값이 없는 계열은 「수집 전」이라고 말한다", () => {
    const fed = computeScore("fed_liquidity", glsSeries({ reserves: undefined }), ASOF);
    expect(fed.components.find((c) => c.key === "reserve_balances")!.missingReason).toMatch(/수집 전/);
  });

  it("⚠ 평가일 뒤의 값은 쓰지 않는다", () => {
    const pts = synth("w", 11, 3, 0, 0.2);
    const future = [...pts, { date: "2027-01-01", value: 999 }];
    const a = computeScore("fed_liquidity", glsSeries({ reserves: { points: pts, freq: "w" } }), ASOF);
    const b = computeScore("fed_liquidity", glsSeries({ reserves: { points: future, freq: "w" } }), ASOF);
    expect(b.score).toBe(a.score);
  });

  it("발행된 점수는 0~100이고, 기여도의 합이 점수다", () => {
    const fed = computeScore("fed_liquidity", glsSeries(), ASOF);
    expect(fed.state).not.toBe("DO_NOT_PUBLISH");
    expect(fed.score).toBeGreaterThanOrEqual(0);
    expect(fed.score).toBeLessThanOrEqual(100);
    const sum = fed.contributions.reduce((s, c) => s + c.points, 0);
    expect(fed.score!).toBeCloseTo(sum, 1);
  });

  /**
   * ⚠ 이 테스트가 잡으려는 것은 **제곱 시간으로의 회귀**다(수천만 번 → 수십 초).
   *
   * ## ⚠ 시계 안에 계산이 아닌 것이 들어 있었다 (2026-09-20)
   * 3초 문턱은 2026-09-14에 병렬 부하로 깨졌고, 10초로 올린 문턱이 2026-09-20에 또 깨졌다(스위트 중 10.1초).
   * 올려서 넘긴 게 아니라 **재는 자리가 틀렸다** — 평가일마다 `glsSeries()`를 새로 만들어,
   * 11년치 합성 계열 13개를 **세 번 짓는 시간**이 계산 시간과 함께 재이고 있었다.
   * 입력은 한 번만 짓고 **계산만** 잰다(단독 실측 2026-09-20: 계산 한 번 0.7초 · 셋이면 2.1초).
   * ⚠ 문턱을 올려 해결하지 않는다 — 올릴 때마다 잡으려던 회귀가 문턱 안으로 들어온다.
   *
   * ⚠ vitest 기본 제한시간은 5초라, 문턱(10초)에 닿기 전에 **테스트 자체가 먼저 죽는다.** 제한시간을 문턱보다 길게 준다.
   */
  it("⚠ 합성 계열 11년치로 GLS 전체를 평가일 셋 계산해도 제곱 시간이 아니다 — 워커에서 돌아야 한다", () => {
    const series = glsSeries();
    const started = Date.now();
    for (const asOf of [ASOF, "2026-08-13", "2026-06-11"]) computeScore("global_liquidity", series, asOf);
    expect(Date.now() - started).toBeLessThan(10_000);
  }, 30_000);
});

describe("측정 정의와 입력 매핑이 어긋나지 않는다", () => {
  it("⚠ 측정에 쓰는 계열은 그 구성요소에서 `available`로 적힌 계열이다", () => {
    for (const [score, comps] of Object.entries(SCORE_MEASURES)) {
      for (const [component, measures] of Object.entries(comps ?? {})) {
        const src = SCORE_INPUTS[score as ScoreKey]?.[component];
        expect(src?.status, `${score}.${component}`).toBe("available");
        if (src?.status !== "available") continue;
        for (const m of measures) expect(src.indicators, `${score}.${component} → ${m.indicator}`).toContain(m.indicator);
      }
    }
  });

  it("⚠ 운영자 결정 — 단기물·이표채 비중은 GLS 점수에 들어가지 않는다", () => {
    expect(SCORE_INPUTS.treasury_liquidity?.bill_coupon_mix?.status).toBe("unavailable");
    expect(SCORE_MEASURES.treasury_liquidity?.bill_coupon_mix).toBeUndefined();
  });
});

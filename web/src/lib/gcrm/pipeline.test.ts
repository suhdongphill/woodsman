/**
 * GCRM v2 — 파이프라인 테스트 (명세 §2-2 · 단계 8의 토대).
 *
 * ★ `pms regime verify`가 기대는 성질을 여기서 고정한다 —
 * **같은 입력이면 한 자리까지 같은 결과**가 나와야 한다. 그렇지 않으면 「재현 가능」이라고 말할 수 없다.
 */
import { describe, it, expect } from "vitest";
import type { SeriesPoint } from "@/lib/macro/series";
import { runPipeline, explainPillar, type PipelineInput } from "./pipeline";
import { enabledIndicators, GCRM_INDICATOR_BY_CODE } from "./config/indicators";
import { initialRegimeState, type SignalContext } from "./regime";
import { AXES } from "./config/model";
import { GCRM_PILLARS, flattenPillar } from "./config/pillars";
import { slowSummary } from "./regime";

/** 달력일 하루 간격 계열. */
function series(n: number, f: (i: number) => number, start = "2014-01-01"): SeriesPoint[] {
  const base = Date.parse(`${start}T00:00:00Z`);
  return Array.from({ length: n }, (_, i) => ({
    date: new Date(base + i * 86_400_000).toISOString().slice(0, 10),
    value: f(i),
  }));
}

/**
 * 켜 둔 지표 전부에 **주기에 맞는 날짜**로 계열을 만든다.
 *
 * ⚠ 월간·분기는 **달력 기준**으로 찍는다(매월 1일). 30일 간격으로 만들면 `yoy` 변환이
 *   1년 전 짝(±3일)을 못 찾아 계열이 통째로 빈다 — 실제 FRED 월간 계열은 매월 1일이다.
 * ⚠ 값은 지표마다 위상을 달리한다. 전부 같으면 분산이 0이라 `ZERO_VARIANCE`가 된다.
 */
function fullSeries(asOf: string): Map<string, SeriesPoint[]> {
  const out = new Map<string, SeriesPoint[]>();
  const end = new Date(`${asOf}T00:00:00Z`);

  enabledIndicators().forEach((ind, k) => {
    const n = Math.max(ind.minObs + 60, 400);
    const points: SeriesPoint[] = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(end);
      if (ind.freq === "m") {
        d.setUTCMonth(d.getUTCMonth() - i);
        d.setUTCDate(1);
      } else if (ind.freq === "q") {
        d.setUTCMonth(d.getUTCMonth() - i * 3);
        d.setUTCDate(1);
      } else if (ind.freq === "w") {
        d.setUTCDate(d.getUTCDate() - i * 7);
      } else {
        d.setUTCDate(d.getUTCDate() - i);
      }
      points.push({
        date: d.toISOString().slice(0, 10),
        value: 50 + Math.sin((n - i + k * 3) / 17) * 12 + (n - i) * 0.01,
      });
    }
    out.set(ind.series, points);
  });
  return out;
}

const SIGNALS: SignalContext = {
  confirmedChannels: ["PRICE", "CREDIT", "FUNDING"],
  windPersistenceWeeks: 0,
  windImprovingWeeks: 0,
  fundingNormalWeeks: 0,
  tideDeteriorating: false,
};

const AS_OF = "2026-09-19";

function makeInput(over: Partial<PipelineInput> = {}): PipelineInput {
  return {
    asOf: AS_OF,
    series: fullSeries(AS_OF),
    axisHistory: Array.from({ length: 120 }, (_, i) => ({
      asOf: `h${i}`,
      tide: 50 + i * 0.05,
      wind: 50 - i * 0.05,
      wave: 50,
    })),
    signals: SIGNALS,
    rawReadings: [],
    prev: initialRegimeState("2026-01-01"),
    ...over,
  };
}

// ═════════════════════════════════════════════════════════════════════════
describe("★ 재현성 — 같은 입력이면 같은 결과다", () => {
  it("두 번 돌려 한 자리까지 같다", () => {
    const a = runPipeline(makeInput());
    const b = runPipeline(makeInput());
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it("⚠ 지표 순서를 바꿔도 같다 — Map 순서에 기대지 않는다", () => {
    const base = makeInput();
    const shuffled = new Map([...base.series.entries()].reverse());
    const a = runPipeline(base);
    const b = runPipeline({ ...base, series: shuffled });
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it("⚠ as_of 이후 데이터를 붙여도 결과가 같다 — 누수 방어가 파이프라인 끝까지 산다", () => {
    const base = makeInput();
    const polluted = new Map(base.series);
    for (const [k, v] of polluted) {
      polluted.set(k, [...v, ...series(200, () => 999_999, "2026-09-20")]);
    }
    const a = runPipeline(base);
    const b = runPipeline({ ...base, series: polluted });
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });
});

// ═════════════════════════════════════════════════════════════════════════
describe("파이프라인이 끝까지 돈다", () => {
  const r = runPipeline(makeInput());

  it("지표 × 축 행을 전부 낸다", () => {
    expect(r.indicators).toHaveLength(enabledIndicators().length * 3);
  });

  it("⚠ 참여하지 않는 축은 MISSING이 아니라 NOT_APPLICABLE이다", () => {
    const quarterly = enabledIndicators().find((i) => i.freq === "q")!;
    const wave = r.indicators.find((x) => x.indicator === quarterly.code && x.axis === "wave")!;
    expect(wave.status).toBe("NOT_APPLICABLE");
    expect(wave.reason).toContain("참여하지 않는다");
  });

  it("기둥 × 축 결과를 전부 낸다", () => {
    expect(r.pillars).toHaveLength(10 * 3);
  });

  it("⚠ 기둥 스칼라는 화면용(raw)과 레짐용(slow)을 따로 낸다", () => {
    const heat = r.pillarScalars.find((s) => s.pillar === "engine_heat")!;
    expect(heat.status).toBe("OK");
    expect(heat.raw).toBeDefined();
    expect(heat.slowRaw).toBeDefined();
    // 스트레스 기둥이므로 raw + ori = 100
    expect(heat.raw! + heat.ori!).toBeCloseTo(100, 6);
  });

  it("축 점수와 방향을 낸다", () => {
    for (const a of AXES) expect(r.axes[a]).toBeDefined();
    expect(["UP", "DOWN", "FLAT", undefined]).toContain(r.directions.tide);
  });

  it("⚠ 화면 값은 5점 단위다", () => {
    for (const a of AXES) {
      const v = r.display.axes[a];
      if (v !== undefined) expect(v % 5).toBe(0);
    }
  });

  it("레짐 판정까지 간다", () => {
    expect(r.regime.state.code).toMatch(/^R[0-6]$/);
    expect(r.regime.financialCrisis).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════
describe("⚠ 파도는 레짐에 닿지 못한다", () => {
  const r = runPipeline(makeInput());

  it("★ 레짐이 보는 기둥 값(slowRaw)은 조류·바람만으로 접은 값이다", () => {
    const w = GCRM_PILLARS.find((p) => p.code === "liquidity")!.summaryWeights;
    const tide = r.pillars.find((p) => p.pillar === "liquidity" && p.axis === "tide")!;
    const wind = r.pillars.find((p) => p.pillar === "liquidity" && p.axis === "wind")!;
    const wave = r.pillars.find((p) => p.pillar === "liquidity" && p.axis === "wave")!;
    const scalar = r.pillarScalars.find((s) => s.pillar === "liquidity")!;

    expect(tide.status).toBe("OK");
    expect(wind.status).toBe("OK");
    expect(wave.status).toBe("OK");

    const expectedSlow = (w.tide * tide.scoreRaw! + w.wind * wind.scoreRaw!) / (w.tide + w.wind);
    expect(scalar.slowRaw).toBeCloseTo(expectedSlow, 10);

    // ⚠ 화면용 raw는 파도를 포함하므로 **다른 값**이다. 둘을 섞으면 안 된다
    expect(scalar.raw).not.toBeCloseTo(expectedSlow, 3);
  });

  it("★ 파도 점수를 아무리 바꿔도 slowRaw는 그대로다 — 인자에 없다", () => {
    const w = GCRM_PILLARS.find((p) => p.code === "liquidity")!.summaryWeights;
    const tide = r.pillars.find((p) => p.pillar === "liquidity" && p.axis === "tide")!;
    const wind = r.pillars.find((p) => p.pillar === "liquidity" && p.axis === "wind")!;
    const withWave = slowSummary({ tide: tide.scoreRaw, wind: wind.scoreRaw }, w);
    const wildWave = slowSummary({ tide: tide.scoreRaw, wind: wind.scoreRaw }, { ...w, wave: 0.99 });
    expect(wildWave).toBeCloseTo(withWave!, 10);
  });

  /**
   * ⚠ 2026-09-20에 이 테스트를 고쳤다. 전에는 **운영 설정의 결함에 얹혀** 통과하고 있었다 —
   * 바람 커버리지가 60%라 아무것도 하지 않아도 전이가 막혀 있었고, 재정 우위 기둥을 채워
   * 바람이 70%가 되자 테스트가 깨졌다. 성질을 확인하려면 **그 상황을 테스트가 직접 만들어야** 한다.
   */
  it("⚠ 총점 커버리지는 조류·바람으로만 본다 — 파도가 전이의 문을 여닫지 못한다", () => {
    // 파도에만 참여하지 않는 기둥(summaryWeights.wave === 0)의 계열을 통째로 뺀다.
    // ⚠ 지표 이름을 적어 두지 않는다 — 설정이 바뀌면 같이 따라오게 한다.
    const slowOnly = new Set<string>();
    for (const ind of enabledIndicators()) {
      const owners = GCRM_PILLARS.filter((p) =>
        flattenPillar(p).some((m) => m.indicator === ind.code),
      );
      if (owners.length > 0 && owners.every((p) => p.summaryWeights.wave === 0)) {
        slowOnly.add(ind.series);
      }
    }
    expect(slowOnly.size).toBeGreaterThan(0);

    const thin = new Map(fullSeries(AS_OF));
    for (const key of slowOnly) thin.delete(key);
    const degraded = runPipeline(makeInput({ series: thin }));

    // 파도는 멀쩡하다 — 뺀 기둥이 파도에 참여하지 않으므로 분모가 그대로다
    expect(degraded.axes.wave.status).toBe("OK");
    expect(degraded.axes.wave.coverage).toBeCloseTo(r.axes.wave.coverage, 10);
    // 그래도 전이는 막힌다. 막은 것은 조류이지 파도가 아니다
    expect(degraded.axes.tide.status).toBe("INSUFFICIENT");
    expect(degraded.regime.blocked).toContain("커버리지");
  });
});

// ═════════════════════════════════════════════════════════════════════════
describe("explain — 무엇이 빠졌는지 보인다", () => {
  const r = runPipeline(makeInput());

  it("기여도를 내림차순으로 준다", () => {
    const e = explainPillar(r, "engine_heat", "tide")!;
    const ws = e.contributions.map((c) => c.effWeight);
    expect([...ws].sort((a, b) => b - a)).toEqual(ws);
  });

  it("⚠ 제외된 지표와 사유를 함께 준다", () => {
    const e = explainPillar(r, "engine_heat", "tide")!;
    expect(e.excluded.length).toBeGreaterThan(0);
    for (const x of e.excluded) {
      expect(x.reason, JSON.stringify(x)).toBeTruthy();
      expect(["MISSING", "STALE", "DISABLED", "UNAVAILABLE"]).toContain(x.kind);
    }
  });

  it("지표에 한글 이름을 붙인다 — 코드만 보여 주지 않는다", () => {
    const e = explainPillar(r, "engine_heat", "tide")!;
    const c = e.contributions[0];
    expect(c.nameKo).toBe(GCRM_INDICATOR_BY_CODE.get(c.indicator)!.nameKo);
  });

  it("파도 축에서는 참여하지 않는 지표를 따로 보여 준다", () => {
    const e = explainPillar(r, "engine_heat", "wave")!;
    expect(e.notApplicable.length).toBeGreaterThan(0);
  });

  it("없는 기둥이면 undefined", () => {
    expect(explainPillar(r, "없는기둥", "tide")).toBeUndefined();
  });
});

// ═════════════════════════════════════════════════════════════════════════
describe("자료가 없으면 지어내지 않는다", () => {
  it("계열이 비면 모든 축이 자료 부족이고 레짐은 직전 상태다", () => {
    const r = runPipeline(makeInput({ series: new Map(), prev: initialRegimeState("2026-01-01") }));
    for (const a of AXES) expect(r.axes[a].status).toBe("INSUFFICIENT");
    expect(r.overall).toBeUndefined();
    expect(r.alignment).toBeUndefined();
    expect(r.alignmentState.state).toBe("UNDETERMINED");
    expect(r.regime.state.code).toBe("R0");
    expect(r.regime.blocked).toBeTruthy();
  });

  it("과거 축 점수가 없으면 방향이 undefined다 — FLAT이 아니다", () => {
    const r = runPipeline(makeInput({ axisHistory: [] }));
    for (const a of AXES) expect(r.directions[a]).toBeUndefined();
  });
});

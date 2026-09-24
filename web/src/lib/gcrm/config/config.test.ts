/**
 * GCRM v2 설정 테스트.
 *
 * ⚠ 이 테스트가 지키는 것은 「코드가 도는가」가 아니라 **「설정이 뜻을 잃지 않았는가」**다.
 * 가중치 합·부호·참조 무결성은 사람이 눈으로 맞추면 반드시 틀린다(`CLAUDE.md` §2-1).
 */
import { describe, it, expect } from "vitest";
import { MACRO_INDICATORS } from "@/lib/macro/registry";
import { validateGcrmConfig, assertValidConfig } from "./validate";
import { canonicalize, canonicalJson, configHash, CONFIG_HASH_LENGTH } from "./hash";
import { GCRM_CONFIG } from "./index";
import { GCRM_INDICATORS, GCRM_INDICATOR_BY_CODE, axesFor, enabledIndicators } from "./indicators";
import { GCRM_PILLARS, flattenPillar, designWeightSum, structuralCoverage, type GcrmPillar } from "./pillars";
import { countChannels, weightedConfirmation, CONFIRMATION } from "./channels";
import { GCRM_REGIMES, REGIME_EDGES, testCondition } from "./regimes";
import { AXIS_WEIGHTS, GATES, WINDOW_OBS, WINDOW_YEARS, CONFIDENCE_WEIGHTS } from "./model";

describe("설정 검증", () => {
  it("오류가 하나도 없다", () => {
    const errors = validateGcrmConfig().filter((i) => i.level === "error");
    // 실패했을 때 어느 파일 어느 키인지 그대로 보이게 한다
    expect(errors.map((e) => `${e.file}:${e.key} — ${e.message}`)).toEqual([]);
  });

  it("assertValidConfig가 통과한다", () => {
    expect(() => assertValidConfig()).not.toThrow();
  });
});

describe("가중치 합", () => {
  it("기둥 10개의 axisWeight 합이 1.00이다", () => {
    const s = GCRM_PILLARS.reduce((a, p) => a + p.axisWeight, 0);
    expect(s).toBeCloseTo(1, 6);
  });

  it.each(GCRM_PILLARS.map((p) => [p.code, p] as const))(
    "%s — 설계 가중치의 합이 1.00이다",
    (_code, pillar) => {
      expect(designWeightSum(pillar as GcrmPillar)).toBeCloseTo(1, 6);
    },
  );

  it("축 가중치 core·transition이 각각 1.00이다", () => {
    const total = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);
    expect(total(Object.values(AXIS_WEIGHTS.core))).toBeCloseTo(1, 6);
    expect(total(Object.values(AXIS_WEIGHTS.transition))).toBeCloseTo(1, 6);
  });

  it("⚠ RTE에 파도가 들어가지 않는다 (B-10)", () => {
    expect(AXIS_WEIGHTS.transition.wave).toBe(0);
  });
});

describe("포털 레지스트리 대조 (CLAUDE.md §2-1)", () => {
  const registry = new Map(MACRO_INDICATORS.map((i) => [i.key, i]));

  it("켜 둔 지표의 series가 전부 레지스트리에 있다", () => {
    const missing = enabledIndicators()
      .filter((i) => !registry.has(i.series))
      .map((i) => i.code);
    expect(missing).toEqual([]);
  });

  it("portalTransform이 레지스트리와 같다", () => {
    const mismatched = enabledIndicators()
      .filter((i) => registry.get(i.series)?.transform !== i.portalTransform)
      .map((i) => `${i.code}: ${i.portalTransform} ≠ ${registry.get(i.series)?.transform}`);
    expect(mismatched).toEqual([]);
  });
});

describe("지표 정의", () => {
  it("끈 지표에는 이유가 있다", () => {
    const noReason = GCRM_INDICATORS.filter((i) => !i.enabled && !i.disabledReason).map((i) => i.code);
    expect(noReason).toEqual([]);
  });

  it("⚠ 수동 입력 지표를 쓰지 않는다 — 값이 2~3점뿐이라 영구 결측이 된다(조사 §4-2)", () => {
    const manual = ["ism_mfg", "ism_svc", "cci", "nahb"];
    const used = enabledIndicators().filter((i) => manual.includes(i.series));
    expect(used).toEqual([]);
  });

  it("분기·월간은 조류에만, 주간은 조류·바람에만 참여한다", () => {
    expect(axesFor("q")).toEqual(["tide"]);
    expect(axesFor("m")).toEqual(["tide"]);
    expect(axesFor("w")).toEqual(["tide", "wind"]);
    expect(axesFor("d")).toEqual(["tide", "wind", "wave"]);
  });

  it("⚠ sox·hynix·samsung은 실측이 월간이라 파도에 들어가지 않는다 (조사 §2-1)", () => {
    for (const code of ["sox"]) {
      const ind = GCRM_INDICATOR_BY_CODE.get(code);
      expect(ind?.freq, `${code}의 freq`).toBe("m");
      expect(axesFor(ind!.freq)).not.toContain("wave");
    }
  });

  it("⚠ VIX는 PRICE 채널이다 — 주식과 주식 변동성을 따로 세지 않는다 (B-9)", () => {
    expect(GCRM_INDICATOR_BY_CODE.get("vix")?.channels).toEqual(["PRICE"]);
    expect(GCRM_INDICATOR_BY_CODE.get("vvix")?.channels).toEqual(["PRICE"]);
    expect(GCRM_INDICATOR_BY_CODE.get("spx_etf")?.channels).toEqual(["PRICE"]);
  });
});

describe("기둥 평탄화", () => {
  it("같은 지표가 여러 자리에 나오면 한 줄로 합쳐진다", () => {
    const liquidity = GCRM_PILLARS.find((p) => p.code === "liquidity")!;
    const flat = flattenPillar(liquidity).filter((m) => m.indicator !== null);
    const codes = flat.map((m) => m.indicator);
    expect(new Set(codes).size).toBe(codes.length);

    // sofr_iorb는 fed_system.funding_stability와 funding.inverted_sofr_iorb 두 자리에 있다
    const sofr = flat.find((m) => m.indicator === "sofr_iorb")!;
    expect(sofr.weight).toBeCloseTo(0.25 * 0.1 + 0.15 * 0.35, 6);
    expect(sofr.path).toContain("+");
  });

  it("여러 지표를 가진 자리는 무게를 균등 분할한다", () => {
    const heat = GCRM_PILLARS.find((p) => p.code === "engine_heat")!;
    const flat = flattenPillar(heat);
    for (const code of ["brent", "wti", "natgas"]) {
      const m = flat.find((x) => x.indicator === code)!;
      expect(m.weight, code).toBeGreaterThan(0);
    }
    // energy 0.15를 셋이 나눈다. ⚠ brent는 다른 자리에도 나오지 않는다(엔진 온도 안에서는)
    expect(flat.find((x) => x.indicator === "natgas")!.weight).toBeCloseTo(0.15 / 3, 6);
  });

  it("⚠ 부호를 덮어쓴 자리에는 이유가 있다", () => {
    const missing: string[] = [];
    for (const p of GCRM_PILLARS) {
      for (const m of flattenPillar(p)) {
        if (m.polarity !== undefined && !m.polarityReason) missing.push(`${p.code}.${m.path}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("달러인덱스는 유동성에서 −1, 달러 네트워크에서 +1이다", () => {
    const liq = flattenPillar(GCRM_PILLARS.find((p) => p.code === "liquidity")!);
    const net = flattenPillar(GCRM_PILLARS.find((p) => p.code === "dollar_network")!);
    // 유동성에서는 덮어쓰지 않는다 → 지표 자신의 부호(−1)를 쓴다
    expect(liq.find((m) => m.indicator === "dxy")?.polarity).toBeUndefined();
    expect(GCRM_INDICATOR_BY_CODE.get("dxy")?.polarity).toBe(-1);
    expect(net.find((m) => m.indicator === "dxy")?.polarity).toBe(1);
  });

  it("구조적 커버리지는 켜진 지표의 무게 비율이다", () => {
    const heat = GCRM_PILLARS.find((p) => p.code === "engine_heat")!;
    const cov = structuralCoverage(heat, (c) => !!GCRM_INDICATOR_BY_CODE.get(c)?.enabled);
    // ai_resource_heat 0.10만 못 채운다
    expect(cov).toBeCloseTo(0.9, 6);
  });

  /**
   * 2026-09-20 (P1) — 재정 우위의 세 자리를 채웠다. ⚠ 여기서 잰 것은 **설정의 천장**이다
   * (자료가 다 있다고 쳤을 때). 2026-09-19 첫 실계산은 이 천장과 정확히 같았다 —
   * 그때 바람을 막은 것은 데이터가 아니라 설정이었다.
   */
  describe("축별 커버리지 천장 — `pillar.ts`의 분모 규칙을 그대로 적용한다", () => {
    /** 참여하지 않는 주기는 **분모에서도 뺀다**(§2-4). 못 채우는 자리·꺼 둔 지표는 분모에 남는다. */
    function axisCeiling(p: GcrmPillar, axis: "tide" | "wind" | "wave") {
      let denom = 0;
      let filled = 0;
      const used: string[] = [];
      for (const m of flattenPillar(p)) {
        const ind = m.indicator === null ? undefined : GCRM_INDICATOR_BY_CODE.get(m.indicator);
        if (!ind?.enabled) {
          denom += m.weight; // 못 채우는 자리·꺼 둔 지표는 분모에 남는다
          continue;
        }
        if (!axesFor(ind.freq).includes(axis)) continue; // 분모에서도 뺀다
        denom += m.weight;
        filled += m.weight;
        used.push(ind.code);
      }
      return { coverage: denom === 0 ? 0 : filled / denom, used };
    }

    const fiscal = GCRM_PILLARS.find((p) => p.code === "fiscal_dominance")!;

    it("재정 우위의 세 자리가 채워졌다 — 조류에서 100%다", () => {
      expect(flattenPillar(fiscal).filter((m) => m.indicator === null)).toEqual([]);
      expect(axisCeiling(fiscal, "tide").coverage).toBeCloseTo(1, 6);
    });

    /**
     * ⚠ 이 100%를 「기둥이 튼튼하다」로 읽으면 안 된다. 분기·월간 지표가 **분모에서 빠져서**
     *   남은 것이 일간 둘뿐이다. 커버리지는 「참여한 것 중 채운 비율」이지 「얼마나 두껍나」가 아니다.
     *   두께는 `depth`가 알고 있는데 신뢰도(§2-7)는 그것을 보지 않는다 — 설계점검 v2에 남겨 둔 숙제다.
     */
    it("⚠ 바람의 100%는 일간 지표 둘에 얹혀 있다", () => {
      const wind = axisCeiling(fiscal, "wind");
      expect(wind.coverage).toBeCloseTo(1, 6);
      expect(wind.used.sort()).toEqual(["rrp_foreign", "term_premium"]);
    });

    it("★ 바람 축이 게이트(70%)에 닿는다 — 총점과 레짐이 나올 수 있는 조건", () => {
      for (const axis of ["tide", "wind"] as const) {
        const part = GCRM_PILLARS.filter((p) => p.summaryWeights[axis] > 0);
        const passed = part.filter((p) => axisCeiling(p, axis).coverage >= GATES.pillarMinCoverage);
        const coverage =
          passed.reduce((s, p) => s + p.axisWeight, 0) / part.reduce((s, p) => s + p.axisWeight, 0);
        expect(coverage, axis).toBeGreaterThanOrEqual(GATES.axisMinCoverage);
      }
    });
  });

  it("못 채우는 자리가 분모에 남아 있다 — 지우면 커버리지가 언제나 100%가 된다", () => {
    for (const p of GCRM_PILLARS) {
      const flat = flattenPillar(p);
      const total = flat.reduce((s, m) => s + m.weight, 0);
      expect(total, p.code).toBeCloseTo(1, 6);
    }
    const unavailable = GCRM_PILLARS.flatMap((p) => flattenPillar(p)).filter((m) => m.indicator === null);
    expect(unavailable.length).toBeGreaterThan(0);
  });
});

describe("채널", () => {
  it("같은 채널이 몇 번 나와도 1표다", () => {
    expect(countChannels(["PRICE", "PRICE", "PRICE"])).toBe(1);
    expect(countChannels(["PRICE", "CREDIT", "FUNDING"])).toBe(3);
  });

  it("PRICE+CREDIT+FUNDING 조합에는 1.25배가 붙는다", () => {
    expect(weightedConfirmation(["PRICE", "CREDIT", "FUNDING"])).toBeCloseTo(3 * CONFIRMATION.comboMultiplier, 6);
    expect(weightedConfirmation(["PRICE", "CREDIT", "RATES"])).toBe(3);
  });
});

describe("레짐", () => {
  it("⚠ 진입과 해제 임계가 다르다 (이력현상)", () => {
    for (const r of GCRM_REGIMES) {
      if (r.code === "R0") continue;
      const enter = JSON.stringify(r.enter);
      const exit = JSON.stringify(r.exit);
      expect(enter, r.code).not.toBe(exit);
    }
  });

  it("R6은 어느 레짐에서든 진입할 수 있다", () => {
    for (const r of GCRM_REGIMES) {
      if (r.code === "R6") continue;
      expect(REGIME_EDGES[r.code], r.code).toContain("R6");
    }
  });

  it("⚠ R6은 CREDIT과 FUNDING 두 채널이 모두 확인될 때만이다 — 주식만 급락한 것은 위기가 아니다", () => {
    const r6 = GCRM_REGIMES.find((r) => r.code === "R6")!;
    expect(r6.requires?.channels).toEqual(["CREDIT", "FUNDING"]);
  });

  it("값이 없으면 false가 아니라 undefined다 — 모르는 것과 아닌 것은 다르다", () => {
    const c = { pillar: "liquidity", op: "gte" as const, value: [65] };
    expect(testCondition(c, undefined)).toBeUndefined();
    expect(testCondition(c, 70)).toBe(true);
    expect(testCondition(c, 60)).toBe(false);
  });

  it("between은 양 끝을 포함한다", () => {
    const c = { pillar: "engine_heat", op: "between" as const, value: [45, 65] };
    expect(testCondition(c, 45)).toBe(true);
    expect(testCondition(c, 65)).toBe(true);
    expect(testCondition(c, 44.9)).toBe(false);
  });
});

describe("config_hash", () => {
  it("12자다", async () => {
    const h = await configHash(GCRM_CONFIG);
    expect(h).toHaveLength(CONFIG_HASH_LENGTH);
    expect(h).toMatch(/^[0-9a-f]+$/);
  });

  it("같은 설정이면 같은 지문이다", async () => {
    expect(await configHash(GCRM_CONFIG)).toBe(await configHash(GCRM_CONFIG));
  });

  it("⚠ 설정값이 한 글자만 바뀌어도 지문이 바뀐다", async () => {
    const before = await configHash(GCRM_CONFIG);
    const tweaked = structuredClone(GCRM_CONFIG as unknown as Record<string, never>) as unknown as {
      model: { GATES: { pillarMinCoverage: number } };
    };
    tweaked.model.GATES.pillarMinCoverage = 0.61;
    expect(await configHash(tweaked)).not.toBe(before);
  });

  it("키 순서가 달라도 같은 지문이다 — 포맷은 지문에 들어가지 않는다", async () => {
    expect(await configHash({ a: 1, b: 2 })).toBe(await configHash({ b: 2, a: 1 }));
  });

  it("⚠ 배열의 순서는 뜻이 있으므로 정렬하지 않는다", () => {
    expect(canonicalJson([3, 1, 2])).toBe("[3,1,2]");
  });

  it("⚠ 함수가 섞이면 던진다 — 조용히 지문에서 사라지면 안 된다", () => {
    expect(() => canonicalize({ f: () => 1 })).toThrow(/함수/);
  });

  it("선택 필드가 없는 것과 undefined인 것은 같다", () => {
    expect(canonicalJson({ a: 1 })).toBe(canonicalJson({ a: 1, b: undefined }));
  });
});

// ═════════════════════════════════════════════════════════════════════════
describe("정규화 창 — 모든 지표가 같은 햇수를 본다 (2026-09-24)", () => {
  it("⚠ `maxWindow`는 빈도별 20년이다 — 지표마다 따로 정하지 않는다", () => {
    const odd = GCRM_INDICATORS.filter((i) => i.maxWindow !== WINDOW_OBS[i.freq]).map(
      (i) => `${i.code}(${i.freq}): ${i.maxWindow} ≠ ${WINDOW_OBS[i.freq]}`,
    );
    expect(odd).toEqual([]);
  });

  it("⚠ 빈도가 달라도 **같은 햇수**다 — 예전에는 관측 수만 같고 햇수가 갈렸다", () => {
    const perYear = { d: 250, w: 52, m: 12, q: 4 } as const;
    for (const f of ["d", "w", "m", "q"] as const) {
      expect(WINDOW_OBS[f] / perYear[f]).toBe(WINDOW_YEARS);
    }
    // 2026-09-24 이전: 넷 다 2500이라 일간 10년 · 주간 48년 · 월간 208년 · 분기 625년이었다
    expect(new Set(Object.values(WINDOW_OBS)).size).toBe(4);
  });

  it("⚠ `minObs`는 창보다 짧아야 한다 — 최소 조건이 창을 넘으면 어떤 지표도 점수를 못 낸다", () => {
    const bad = GCRM_INDICATORS.filter((i) => i.minObs >= WINDOW_OBS[i.freq]).map((i) => i.code);
    expect(bad).toEqual([]);
  });
});

describe("신뢰도 가중치 (2026-09-24 `depth` 추가)", () => {
  it("다섯 몫의 합이 1이다", () => {
    const sum = Object.values(CONFIDENCE_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
  });

  it("⚠ 명세 §2-7 넷의 **비율**은 그대로다 — 0.90배로 줄였을 뿐이다", () => {
    const spec = { coverage: 0.4, staleness: 0.25, evidence: 0.2, channelBreadth: 0.15 };
    const scale = 1 - CONFIDENCE_WEIGHTS.depth;
    for (const [k, v] of Object.entries(spec)) {
      expect(CONFIDENCE_WEIGHTS[k as keyof typeof spec]).toBeCloseTo(v * scale, 10);
    }
  });
});

/**
 * GCRM v2 정규화 테스트 (명세 §2-3 · 단계 3).
 *
 * ⚠ 이 파일에서 가장 중요한 것은 **미래 누수 테스트**다.
 * 누수는 조용하다 — 숫자가 나오고, 그럴듯하고, 백테스트 성적만 좋아진다.
 * 그래서 「as_of 이후를 붙여도 한 자리도 바뀌지 않는다」를 기계가 매번 확인한다.
 */
import { describe, it, expect } from "vitest";
import { applyTransform, type SeriesPoint } from "@/lib/macro/series";
import {
  normalize,
  workingSeries,
  pctRankOf,
  quantile,
  normalCdf,
  specOf,
  type NormalizeSpec,
} from "./normalize";
import { GCRM_INDICATOR_BY_CODE } from "./config/indicators";

/** 2000-01-01부터 하루씩. ⚠ 영업일이 아니라 달력일이다 — 정규화는 간격을 세지 않는다. */
function dates(n: number, start = "2000-01-01"): string[] {
  const base = Date.parse(`${start}T00:00:00Z`);
  return Array.from({ length: n }, (_, i) =>
    new Date(base + i * 86_400_000).toISOString().slice(0, 10),
  );
}

function series(values: number[], start = "2000-01-01"): SeriesPoint[] {
  const ds = dates(values.length, start);
  return values.map((value, i) => ({ date: ds[i], value }));
}

const SPEC: NormalizeSpec = {
  portalTransform: "level",
  transform: "level",
  polarity: 1,
  scaler: "pct_rank",
  window: "expanding",
  minObs: 100,
  maxWindow: 2500,
  // ⚠ 기본 테스트에서는 절단을 끈다 — 백분위만 따로 보기 위해서다
  winsor: [0, 1],
};

const spec = (over: Partial<NormalizeSpec> = {}): NormalizeSpec => ({ ...SPEC, ...over });

/** 마지막 값을 `last`로 두고, 나머지는 1..n−1인 계열. */
function uniformEndingWith(n: number, last: number): SeriesPoint[] {
  const rest = Array.from({ length: n - 1 }, (_, i) => i + 1).filter((v) => v !== last);
  return series([...rest, last]);
}

// ─────────────────────────────────────────────────────────────────────────
describe("1. 알려진 균등분포에서 백분위가 기대값과 맞는다", () => {
  it("1..1000에서 마지막 값이 1000이면 99.95다 (중간 순위)", () => {
    const r = normalize(series(Array.from({ length: 1000 }, (_, i) => i + 1)), spec(), "2099-01-01");
    expect(r.status).toBe("OK");
    if (r.status !== "OK") return;
    // (999 + 0.5) / 1000 × 100
    expect(r.pctRank).toBeCloseTo(99.95, 10);
  });

  it("가운데 값(500)이면 49.95다", () => {
    const r = normalize(uniformEndingWith(1001, 500), spec(), "2099-01-01");
    expect(r.status).toBe("OK");
    if (r.status !== "OK") return;
    // 1..1000 중 500: 작은 값 499개 + 자기 하나의 절반 → (499 + 0.5) / 1000 × 100
    expect(r.pctRank).toBeCloseTo(49.95, 10);
  });

  it("⚠ 중간 순위는 위아래가 대칭이다 — 최솟값과 최댓값의 거리가 같다", () => {
    const vals = Array.from({ length: 1000 }, (_, i) => i + 1);
    const lowest = pctRankOf(vals, 1);
    const highest = pctRankOf(vals, 1000);
    expect(lowest).toBeCloseTo(0.05, 10);
    expect(highest).toBeCloseTo(99.95, 10);
    expect(lowest + highest).toBeCloseTo(100, 10);
  });

  it("같은 값이 여럿이면 한쪽으로 쏠리지 않는다", () => {
    // 0이 넷, 1이 넷 → 0의 순위는 25, 1의 순위는 75
    const vals = [0, 0, 0, 0, 1, 1, 1, 1];
    expect(pctRankOf(vals, 0)).toBeCloseTo(25, 10);
    expect(pctRankOf(vals, 1)).toBeCloseTo(75, 10);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe("2. polarity −1이면 정확히 100 − score로 뒤집힌다", () => {
  const data = series(Array.from({ length: 500 }, (_, i) => Math.sin(i) * 10 + i * 0.3));

  it("같은 입력에서 두 부호의 점수 합이 100이다", () => {
    const up = normalize(data, spec({ polarity: 1 }), "2099-01-01");
    const down = normalize(data, spec({ polarity: -1 }), "2099-01-01");
    expect(up.status).toBe("OK");
    expect(down.status).toBe("OK");
    if (up.status !== "OK" || down.status !== "OK") return;

    expect(down.score).toBeCloseTo(100 - up.score, 12);
    // ⚠ pctRank는 **뒤집기 전** 값이다 — 둘이 같아야 한다
    expect(down.pctRank).toBeCloseTo(up.pctRank, 12);
    expect(up.score).toBeCloseTo(up.pctRank, 12);
  });

  it("⚠ 실제 지표에서도 그렇다 — hy_spread는 −1이다(스프레드가 벌어지면 자본에 불리)", () => {
    const hy = GCRM_INDICATOR_BY_CODE.get("hy_spread")!;
    expect(hy.polarity).toBe(-1);
    const s = specOf(hy);
    // 스프레드가 역대 최고로 벌어진 상황
    const widening = series(Array.from({ length: 900 }, (_, i) => 3 + i * 0.001));
    const r = normalize(widening, { ...s, winsor: [0, 1] }, "2099-01-01");
    expect(r.status).toBe("OK");
    if (r.status !== "OK") return;
    expect(r.pctRank).toBeGreaterThan(99); // 스프레드는 역대 최고
    expect(r.score).toBeLessThan(1); // 그런데 자본에는 최악이다
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe("3. ★ 미래 누수 — as_of 이후를 붙여도 한 자리도 바뀌지 않는다", () => {
  const past = series(Array.from({ length: 800 }, (_, i) => 50 + Math.sin(i / 7) * 10));
  const asOf = past[past.length - 1].date;

  /** as_of 다음 날부터 붙는 미래. 값을 일부러 터무니없게 준다 — 새면 반드시 티가 나도록. */
  const future = series(
    Array.from({ length: 300 }, (_, i) => (i % 2 === 0 ? 10_000 : -10_000)),
    new Date(Date.parse(`${asOf}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10),
  );

  it("점수·백분위·원값·관측 수가 전부 같다", () => {
    const before = normalize(past, spec(), asOf);
    const after = normalize([...past, ...future], spec(), asOf);
    expect(after).toEqual(before);
  });

  it("winsor를 켜도 같다 — 절단 경계가 미래 값에 끌려가지 않는다", () => {
    const s = spec({ winsor: [0.01, 0.99] });
    expect(normalize([...past, ...future], s, asOf)).toEqual(normalize(past, s, asOf));
  });

  it("zscore_cdf에서도 같다 — 평균·표준편차가 미래에 오염되지 않는다", () => {
    const s = spec({ scaler: "zscore_cdf" });
    expect(normalize([...past, ...future], s, asOf)).toEqual(normalize(past, s, asOf));
  });

  it("작업 계열의 마지막 점이 as_of를 넘지 않는다", () => {
    const ws = workingSeries([...past, ...future], spec(), asOf);
    expect(ws[ws.length - 1].date <= asOf).toBe(true);
  });

  it("as_of 당일 관측은 **남는다** — 오늘 관측한 값은 미래가 아니다", () => {
    const ws = workingSeries(past, spec(), asOf);
    expect(ws[ws.length - 1].date).toBe(asOf);
  });

  it("⚠ 입력이 날짜순이 아니어도 결과가 같다 — 정렬을 믿고 넘어가지 않는다", () => {
    const shuffled = [...past].reverse();
    expect(normalize(shuffled, spec(), asOf)).toEqual(normalize(past, spec(), asOf));
  });

  it("⚠ 상류 변환도 미래를 보지 않는다 — 자르고 변환하나, 변환하고 자르나 같다", () => {
    // 이 성질이 깨지면 정규화가 아무리 먼저 잘라도 소용없다(2026-09-19 확인)
    for (const tf of ["yoy", "mom", "momdiff", "level"] as const) {
      const all = [...past, ...future];
      const cutThenTransform = applyTransform(all.filter((p) => p.date <= asOf), tf);
      const transformThenCut = applyTransform(all, tf).filter((p) => p.date <= asOf);
      expect(cutThenTransform, tf).toEqual(transformThenCut);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe("4. minObs 미달이면 예외가 아니라 MISSING이다", () => {
  it("짧은 계열에 MISSING과 이유를 돌려준다", () => {
    const r = normalize(series([1, 2, 3, 4, 5]), spec({ minObs: 100 }), "2099-01-01");
    expect(r.status).toBe("MISSING");
    if (r.status !== "MISSING") return;
    expect(r.reason).toBe("SHORT_HISTORY");
    expect(r.obsCount).toBe(5);
    expect(r.detail).toContain("5");
    expect(r.detail).toContain("100");
  });

  it("던지지 않는다", () => {
    expect(() => normalize([], spec(), "2099-01-01")).not.toThrow();
    expect(() => normalize(series([1]), spec(), "2099-01-01")).not.toThrow();
  });

  it("as_of까지 관측이 없으면 NO_DATA다 — SHORT_HISTORY와 구분한다", () => {
    const r = normalize(series([1, 2, 3], "2020-01-01"), spec(), "2010-01-01");
    expect(r.status).toBe("MISSING");
    if (r.status !== "MISSING") return;
    expect(r.reason).toBe("NO_DATA");
  });

  it("⚠ 값이 한 번도 변하지 않으면 50점으로 메우지 않는다", () => {
    const r = normalize(series(Array.from({ length: 200 }, () => 7)), spec(), "2099-01-01");
    expect(r.status).toBe("MISSING");
    if (r.status !== "MISSING") return;
    expect(r.reason).toBe("ZERO_VARIANCE");
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe("5. winsor가 극단값을 실제로 자른다", () => {
  const body = Array.from({ length: 999 }, (_, i) => (i % 100) + 1); // 1~100 사이

  it("끝에 붙은 이상치가 절단된다", () => {
    const data = series([...body, 1_000_000]);
    const r = normalize(data, spec({ winsor: [0.01, 0.99] }), "2099-01-01");
    expect(r.status).toBe("OK");
    if (r.status !== "OK") return;

    expect(r.rawValue).toBe(1_000_000); // 화면에 보여 줄 값은 원값이다
    expect(r.clipped).toBe(true);
    expect(r.clippedValue).toBeLessThan(1000); // 순위를 매긴 값은 잘렸다
    expect(r.pctRank).toBeLessThanOrEqual(100);
  });

  it("절단을 끄면 자르지 않는다", () => {
    const r = normalize(series([...body, 1_000_000]), spec({ winsor: [0, 1] }), "2099-01-01");
    expect(r.status).toBe("OK");
    if (r.status !== "OK") return;
    expect(r.clipped).toBe(false);
    expect(r.clippedValue).toBe(1_000_000);
  });

  it("⚠ 분포와 대상 값을 같은 경계로 자른다 — 한쪽만 자르면 순위가 어긋난다", () => {
    // 이상치 열 개를 붙여도 백분위가 100을 넘지 않고, 서로 같은 순위를 받는다
    const withOutliers = series([...body, ...Array.from({ length: 10 }, () => 999_999)]);
    const r = normalize(withOutliers, spec({ winsor: [0.01, 0.99] }), "2099-01-01");
    expect(r.status).toBe("OK");
    if (r.status !== "OK") return;
    expect(r.pctRank).toBeGreaterThan(90);
    expect(r.pctRank).toBeLessThanOrEqual(100);
  });

  it("⚠ 백분위는 극단값에 지배되지 않는다 — 이것이 z 대신 쓰는 이유다", () => {
    const normal = normalize(series([...body, 100]), spec({ winsor: [0.01, 0.99] }), "2099-01-01");
    const extreme = normalize(series([...body, 10 ** 12]), spec({ winsor: [0.01, 0.99] }), "2099-01-01");
    expect(normal.status).toBe("OK");
    expect(extreme.status).toBe("OK");
    if (normal.status !== "OK" || extreme.status !== "OK") return;
    // 값은 10^10배 차이인데 점수 차이는 몇 점 안에 갇힌다
    expect(Math.abs(extreme.pctRank - normal.pctRank)).toBeLessThan(5);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe("보조 함수", () => {
  it("quantile은 선형 보간이다", () => {
    const xs = [1, 2, 3, 4, 5];
    expect(quantile(xs, 0)).toBe(1);
    expect(quantile(xs, 1)).toBe(5);
    expect(quantile(xs, 0.5)).toBe(3);
    expect(quantile(xs, 0.25)).toBe(2);
    expect(quantile(xs, 0.125)).toBeCloseTo(1.5, 10);
  });

  it("normalCdf가 알려진 값과 맞는다", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 7);
    expect(normalCdf(1)).toBeCloseTo(0.8413447, 6);
    expect(normalCdf(-1)).toBeCloseTo(0.1586553, 6);
    expect(normalCdf(1.959964)).toBeCloseTo(0.975, 6);
    expect(normalCdf(-3)).toBeCloseTo(0.0013499, 6);
  });

  it("normalCdf는 대칭이다", () => {
    for (const z of [0.3, 1.1, 2.4, 3.7]) {
      expect(normalCdf(z) + normalCdf(-z)).toBeCloseTo(1, 7);
    }
  });

  it("maxWindow가 창을 자른다 — expanding에도 상한이 있다", () => {
    const data = series(Array.from({ length: 3000 }, (_, i) => i));
    const ws = workingSeries(data, spec({ maxWindow: 500 }), "2099-01-01");
    expect(ws).toHaveLength(500);
    // 최근 것을 남긴다
    expect(ws[ws.length - 1].value).toBe(2999);
  });

  it("GCRM 변환 diff·ratio도 과거만 본다", () => {
    const data = series([10, 12, 15, 20]);
    expect(workingSeries(data, spec({ transform: "diff", minObs: 1 }), "2099-01-01").map((p) => p.value)).toEqual([
      2, 3, 5,
    ]);
    expect(workingSeries(data, spec({ transform: "ratio", minObs: 1 }), "2099-01-01").map((p) => p.value)).toEqual([
      1.2, 1.25, 20 / 15,
    ]);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe("실제 지표 정의로도 돈다", () => {
  it("specOf가 지표 정의를 그대로 옮긴다", () => {
    const vix = GCRM_INDICATOR_BY_CODE.get("vix")!;
    const s = specOf(vix);
    expect(s.polarity).toBe(vix.polarity);
    expect(s.minObs).toBe(vix.minObs);
    expect(s.winsor).toEqual(vix.winsor);
    expect(s.portalTransform).toBe(vix.portalTransform);
  });

  it("⚠ minObs는 설정의 points가 아니라 실제 계열 길이로 판정한다", () => {
    const hy = GCRM_INDICATOR_BY_CODE.get("hy_spread")!;
    // 설정에는 818점이라고 적혀 있지만(2026-09-19 스냅숏), 계열이 10점이면 MISSING이어야 한다
    expect(hy.points).toBeGreaterThan(hy.minObs);
    const r = normalize(series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), specOf(hy), "2099-01-01");
    expect(r.status).toBe("MISSING");
    if (r.status !== "MISSING") return;
    expect(r.reason).toBe("SHORT_HISTORY");
  });
});

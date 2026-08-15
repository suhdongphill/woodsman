/**
 * CANSLIM 종합 점수 — 순수 함수.
 *
 * `docs/canslim_스코링정책_v1.md` §1.2의 식 그대로다:
 *   각 항목 0~10 → `종합(100) = Σ(항목점수 × 가중치/10)` → `composite10 = 종합/10`
 *
 * ## ⚠ 결측을 어떻게 다루나 (규율 R1)
 * `N/A`는 **0점이 아니라 분모에서 빠진다.** 버블 점수(`lib/bubble/score.ts`)와 **같은 방식**이다.
 * 0점으로 치면 "아직 안 본 것"이 "나쁜 것"이 되고, 채점을 미룬 종목이 자동으로 저조 등급을 받는다.
 * 정책 §0-5도 "데이터 없는 항목은 추정하지 말고 N/A로 둔다"고 못 박았다.
 *
 * 대신 **coverage(가중치 기준 몇 %를 봤나)를 항상 같이 낸다** — 커버리지가 낮은 점수는
 * 그만큼 덜 믿어야 한다는 걸 화면이 말할 수 있어야 한다.
 *
 * ⚠ 항목 수가 아니라 **가중치 기준**으로 센다. 7항목 중 4개를 봤다고 57%가 아니다 —
 * I(10)만 빠진 것과 M(15)이 빠진 것은 무게가 다르다.
 *
 * ## ⚠ 왜 화면이 아니라 여기서 계산하나
 * 2026-08-11 설계서 §1이 지적한 문제가 정확히 이것이다. `/stocks/[ticker]`가
 * `scores[key] ?? 0`으로 결측을 0점 처리했고, 등급 경계도 7.0/5.0으로 **정책(8.0/6.5)보다
 * 후하게** 판정했다. 판단이 화면에 흩어져 있으면 정책과 화면이 다른 말을 한다.
 */
import { CANSLIM_BANDS, CANSLIM_ITEMS, M_GATE_MAX, POINT_MAX, POINT_MIN } from "./catalog";
import type { CanslimBand, CanslimItemDef, CanslimKey, CanslimReading } from "./types";

/** 채점에서 빠진 이유. ⚠ "안 넣었다"와 "N/A로 정했다"와 "값이 이상하다"를 구분한다. */
export type ExcludeReason = "missing" | "na" | "out-of-range";

export type CanslimAxis = {
  item: CanslimItemDef;
  reading?: CanslimReading;
  /** 종합 계산에 들어갔나 */
  scored: boolean;
  /** 0~10. 계산에 들어간 경우에만 있다 */
  points?: number;
  excludedBecause?: ExcludeReason;
};

export type CanslimCoverage = {
  /** 채점된 항목 수 */
  scored: number;
  total: number;
  /** ⚠ 항목 수가 아니라 **가중치** 기준 비율(%) */
  pct: number;
  scoredWeight: number;
  totalWeight: number;
};

/**
 * 시장(M) 게이트.
 * ⚠ M을 채점하지 않았으면 `unknown`이다. **`clear`로 떨어뜨리지 않는다** —
 * 안 본 것을 "괜찮다"로 바꾸는 것이 이 저장소가 가장 자주 겪은 사고다.
 */
export type MarketGate = {
  state: "clear" | "hold" | "unknown";
  text: string;
};

export type CanslimScore = {
  axes: CanslimAxis[];
  /** 0~100. 채점된 항목이 하나도 없으면 undefined — 0으로 내지 않는다(0은 "저조"로 읽힌다). */
  composite100?: number;
  /** 0~10. 등급 밴드가 쓰는 눈금 */
  composite10?: number;
  band?: CanslimBand;
  coverage: CanslimCoverage;
  gate: MarketGate;
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** 계산에 넣어도 되는 점수인가. ⚠ 범위를 벗어난 값을 잘라서 쓰지 않는다 — 드러낸다. */
export function isScorablePoints(points: unknown): points is number {
  return typeof points === "number" && Number.isFinite(points) && points >= POINT_MIN && points <= POINT_MAX;
}

/** `composite10` → 등급. 위에서부터 처음 `min` 이상인 구간. */
export function bandFor(composite10: number): CanslimBand {
  return (
    CANSLIM_BANDS.find((b) => composite10 >= b.min) ?? CANSLIM_BANDS[CANSLIM_BANDS.length - 1]
  );
}

function classify(item: CanslimItemDef, reading: CanslimReading | undefined): CanslimAxis {
  if (!reading) return { item, scored: false, excludedBecause: "missing" };
  // ⚠ 태그가 N/A면 점수가 적혀 있어도 쓰지 않는다. 태그가 사람의 최종 판단이다.
  if (reading.tag === "na") return { item, reading, scored: false, excludedBecause: "na" };
  if (!isScorablePoints(reading.points)) {
    return {
      item,
      reading,
      scored: false,
      excludedBecause: reading.points === undefined ? "missing" : "out-of-range",
    };
  }
  return { item, reading, scored: true, points: reading.points };
}

/**
 * 시장 게이트를 판정한다.
 * ⚠ 이건 **국면 설명이지 매매 지시가 아니다**(`WOODSMAN_DOCTRINE`).
 * 정책 §1.3: "M ≤ 3이면 composite와 무관하게 신규 매수 **보류 권고**".
 */
export function marketGate(axes: CanslimAxis[]): MarketGate {
  const m = axes.find((a) => a.item.key === "M");

  if (!m || !m.scored || m.points === undefined) {
    return {
      state: "unknown",
      text: "시장(M) 축을 아직 채점하지 않아 게이트를 판정할 수 없습니다. 채점 전까지는 통과한 것으로 보지 않습니다.",
    };
  }
  if (m.points <= M_GATE_MAX) {
    return {
      state: "hold",
      text: `시장(M) ${m.points}점 — 조정 국면입니다. 정책상 종합 점수와 무관하게 신규 편입은 보류합니다(M ≤ ${M_GATE_MAX}).`,
    };
  }
  return { state: "clear", text: `시장(M) ${m.points}점 — 게이트에 걸리지 않습니다.` };
}

/**
 * 7축 채점을 종합한다.
 *
 * `readings`는 항목 키 → 채점. 없는 키는 **결측**이다(0점이 아니다).
 */
export function scoreCanslim(readings: Map<string, CanslimReading>): CanslimScore {
  const axes = CANSLIM_ITEMS.map((item) => classify(item, readings.get(item.key)));

  const scored = axes.filter((a) => a.scored);
  const scoredWeight = scored.reduce((sum, a) => sum + a.item.weight, 0);
  const totalWeight = CANSLIM_ITEMS.reduce((sum, i) => sum + i.weight, 0);

  // ⚠ 결측 제외 정규화. 분모는 100이 아니라 **채점된 항목의 가중치 합**이다.
  const composite10 =
    scoredWeight > 0
      ? round1(scored.reduce((sum, a) => sum + a.points! * a.item.weight, 0) / scoredWeight)
      : undefined;

  return {
    axes,
    composite10,
    composite100: composite10 === undefined ? undefined : round1(composite10 * 10),
    band: composite10 === undefined ? undefined : bandFor(composite10),
    coverage: {
      scored: scored.length,
      total: CANSLIM_ITEMS.length,
      pct: totalWeight ? Math.round((scoredWeight / totalWeight) * 100) : 0,
      scoredWeight,
      totalWeight,
    },
    gate: marketGate(axes),
  };
}

/**
 * 커버리지를 화면 문장으로. ⚠ 낮은 커버리지의 점수를 그대로 믿지 말라고 화면이 말해야 한다.
 * (버블 `coverageNotice()`와 같은 규범 — 두 화면이 다른 말을 하면 안 된다.)
 */
export function canslimCoverageNotice(coverage: CanslimCoverage): string {
  if (coverage.scored === 0) {
    return "아직 채점한 축이 없습니다. 점수를 내지 않습니다 — 0점으로 표시하면 '저조'로 읽힙니다.";
  }
  if (coverage.pct < 60) {
    return `7축 중 ${coverage.scored}축만 채점됐습니다(가중치 기준 ${coverage.pct}%). 빠진 축이 많아 종합 점수가 실제보다 한쪽으로 치우칠 수 있습니다.`;
  }
  return `7축 중 ${coverage.scored}축 채점(가중치 기준 ${coverage.pct}%). 결측은 분모에서 빼고 계산했습니다.`;
}

/** 아직 채점되지 않은 축 — 관리자 화면의 "다음에 채울 것" 목록이 된다. */
export function missingAxes(score: CanslimScore): { key: CanslimKey; name: string; why: ExcludeReason }[] {
  return score.axes
    .filter((a) => !a.scored)
    .map((a) => ({ key: a.item.key, name: a.item.name, why: a.excludedBecause ?? "missing" }));
}

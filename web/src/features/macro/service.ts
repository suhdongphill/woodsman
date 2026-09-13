/**
 * 화면이 쓰는 모양으로 지표를 조립한다.
 *
 * 라우트(`src/app/**`)는 조립만 한다는 규칙(CLAUDE.md 1장)에 따라, "카탈로그 + DB 값 +
 * 변환 + 판정"을 합치는 일은 여기서 한다. 홈·허브·상세·관리자 화면이 **같은 계산**을
 * 쓰게 하려는 목적도 있다 — 화면마다 따로 계산하면 같은 지표가 다른 값으로 보인다.
 */
import {
  MACRO_INDICATORS,
  findIndicator,
  headlineIndicators,
  indicatorsByGroup,
  recessionSignalIndicators,
  withDerivedComponents,
  type MacroIndicator,
} from "@/lib/macro/catalog";
import { composeDerived, derivedMeta } from "@/lib/macro/derived";
import { MACRO_GROUPS, orderedMacroGroups, type MacroGroup, type MacroGroupKey } from "@/lib/macro/groups";
import {
  applyTransform,
  changeFromPrevious,
  formatIndicatorValue,
  latestPoint,
  type SeriesPoint,
} from "@/lib/macro/series";
import { judgeSignal, summarizeRecession, type RecessionSummary, type SignalStatus } from "@/lib/macro/signal";
import { estimateFedHike, type FedHikeResult } from "@/lib/macro/fedhike";
import {
  impliedFromFutures,
  nextMonthOf,
  type FedFuturesResult,
} from "@/lib/macro/fedfutures";
import { loadFomcDecisionDates } from "@/features/calendar/repository";
import { computeCapitalSpreads, type CapitalSpreads } from "@/lib/macro/capital";
import { buildOverlay, type OverlayMode, type OverlayResult } from "@/lib/macro/overlay";
import {
  healthNotice,
  judgeFreshness,
  summarizeHealth,
  type MacroFreshness,
  type MacroHealth,
} from "@/lib/macro/freshness";
import { loadRecentPoints, loadSeriesMany, loadSeriesMeta, type SeriesMeta } from "./repository";

export type IndicatorView = {
  indicator: MacroIndicator;
  /** 변환까지 끝난 값 */
  value?: number;
  /** 화면 문자열 */
  display: string;
  /** 기준일(YYYY-MM-DD) */
  asOf?: string;
  /** 직전 값 대비 변화 */
  change?: number;
  changeDisplay?: string;
  status: SignalStatus;
  points: SeriesPoint[];
  /**
   * ⚠ 이 값을 지금 믿어도 되나. 화면은 값과 **함께** 이걸 낸다 —
   *    낡은 값을 오늘 값처럼 보여주는 것이 이 대시보드가 조용히 틀리는 첫 번째 방식이다
   *    (볼트 사양서 §0).
   */
  freshness: MacroFreshness;
};

/**
 * 이 지표에 넣을 원값과 메타를 고른다.
 *
 * 보통은 저장된 계열을 그대로 쓴다. **파생 계열은 DB에 자기 행이 없어** 성분에서 만든다
 * (`lib/macro/derived.ts`).
 *
 * ⚠ 성분은 **각자의 변환을 먼저 거친 뒤** 합성한다. 유동성 묶음은 FRED가 계열마다
 *   백만·십억을 섞어 주기 때문에, 원값끼리 빼면 1000배가 조용히 어긋난다.
 * ⚠ 합성 결과는 이미 표시 단위라서, 파생 지표의 `transform`은 `level`이어야 한다
 *   (`validateSectors()`가 강제한다). 안 그러면 변환이 두 번 걸린다.
 */
function sourceFor(
  indicator: MacroIndicator,
  raw: Map<string, SeriesPoint[]>,
  meta: Map<string, SeriesMeta>,
): { points: SeriesPoint[] | undefined; meta: SeriesMeta | undefined } {
  const spec = indicator.derived;
  if (!spec) return { points: raw.get(indicator.key), meta: meta.get(indicator.key) };

  const parts = spec.from.map((key) => {
    const part = findIndicator(key);
    return part ? applyTransform(raw.get(key) ?? [], part.transform) : [];
  });

  const composed = derivedMeta(spec.from.map((key) => meta.get(key)));
  return {
    points: composeDerived(spec, parts),
    // ⚠ 성분 하나라도 기준일이 없으면 파생도 기준일이 없다 — "언제 값인지 모르는 선"을 만들지 않는다.
    meta: composed.asOf ? { asOf: composed.asOf, fetchedAt: composed.fetchedAt } : undefined,
  };
}

function buildView(
  indicator: MacroIndicator,
  raw: SeriesPoint[] | undefined,
  meta: SeriesMeta | undefined,
  now: Date,
): IndicatorView {
  const points = applyTransform(raw ?? [], indicator.transform);
  const last = latestPoint(points);
  const change = changeFromPrevious(points);

  return {
    indicator,
    value: last?.value,
    display: formatIndicatorValue(indicator, last?.value),
    asOf: last?.date,
    change,
    changeDisplay:
      change === undefined
        ? undefined
        : formatIndicatorValue({ ...indicator, transform: "momdiff" }, change),
    status: judgeSignal(indicator.signal, last?.value),
    points,
    /**
     * ⚠ 기준일은 **원본 관측일(meta.asOf)** 을 쓴다. 변환(YoY 등)을 거치면 짝을 못 찾은
     *    점이 버려져 마지막 점이 뒤로 밀릴 수 있는데, 그걸 기준일로 쓰면 실제보다
     *    낡아 보인다. 화면에 보이는 값의 날짜(`asOf`)와는 다른 질문이다.
     */
    freshness: judgeFreshness({
      asOf: meta?.asOf ?? last?.date,
      fetchedAt: meta?.fetchedAt,
      freq: indicator.freq,
      staleDays: indicator.staleDays,
      manual: indicator.source === "MANUAL",
      now,
    }),
  };
}

export type MacroOverview = {
  summary: RecessionSummary;
  signals: IndicatorView[];
  headlines: IndicatorView[];
  /** 그룹별 미리보기(대표 지표 3개까지) */
  /**
   * `items`는 카드에 싣는 **대표 3개**이고, `total`은 그 묶음의 **지표 전체 수**다.
   * ⚠ 둘을 섞지 않는다 — 처음에 `items.length`로 셌다가 모든 카드가 「지표 3개」,
   *   전체가 33개(11×3)로 나왔다. 실제는 72개다(2026-09-14, 배포 전 로컬 확인에서 잡았다).
   */
  groups: { group: MacroGroup; items: IndicatorView[]; total: number }[];
  /**
   * 카탈로그의 지표 전체 수. ⚠ **화면이 세어서 적는다** — 「아홉 개 묶음」이라고 손으로
   * 적어 둔 문구가 묶음이 11개가 된 뒤에도 남아 있었다(2026-09-14).
   */
  indicatorCount: number;
  /** 전체에서 가장 최근 기준일 — "언제 기준 화면인가" */
  asOf?: string;
  /** 값이 하나도 없으면 true — 화면이 "아직 안 가져왔다"고 말한다 */
  empty: boolean;
  /** ⚠ 전체 지표의 신선도 요약. 정상이면 `healthNotice`가 null이라 화면이 조용하다 */
  health: MacroHealth;
  /**
   * 연준 정책금리 방향 확률. 필수 지표(Core PCE·기준금리·실업률)가 없으면 undefined다.
   * ⚠ 여기서 한 번만 계산한다 — 화면마다 따로 계산하면 같은 회의에 다른 확률이 나온다.
   */
  fedHike?: FedHikeResult;
  /** 인상확률 계산에 쓴 값들의 기준일 중 가장 오래된 것 — "얼마나 묵은 판단인가" */
  fedHikeAsOf?: string;
  /**
   * 선물 내재 정책금리 — **시장이 거는 것**. `fedHike`(모형이 처방하는 것)와 짝이다.
   * ⚠ 선물 시세·현재 금리·FOMC 일정 중 하나라도 없으면 undefined다. 지어내지 않는다.
   */
  fedFutures?: FedFuturesResult;
  /** 선물 시세일 — 이 계산이 언제 값인지 */
  fedFuturesAsOf?: string;
  /**
   * ⭐ 자본 엔진의 두 격차 — 「생산성이 버는 것 vs 돈값」과 「성장 vs 이자」.
   * ⚠ 여기서 한 번만 계산한다. 화면마다 따로 계산하면 같은 질문에 다른 답이 나온다.
   */
  capital: CapitalSpreads;
};

/**
 * 인상확률 입력 지표와 카탈로그 키의 대응.
 * ⚠ 키를 바꾸면 조용히 결측이 되므로 한 곳에 모아 둔다.
 */
const FED_HIKE_KEYS = {
  corePce: "core_pce_yoy",
  fedFunds: "fed_funds",
  unrate: "unrate",
  ism: "ism_mfg",
  umcsent: "umcsent",
  breakeven5y: "infl_exp_5y",
  ppiYoy: "ppi_yoy",
  wti: "wti",
} as const;

/**
 * 홈·허브가 쓰는 요약.
 *
 * ⚠ 값이 없을 때 화면을 비워 두지 않는다. "아직 가져오지 않았다"를 말한다 —
 *    빈 화면은 고장과 구분되지 않는다.
 */
export async function loadMacroOverview(): Promise<MacroOverview> {
  const now = new Date();
  // FOMC 일정은 선물 내재금리의 입력이다. 같은 왕복에서 받아 온다.
  const [recent, meta, fomc] = await Promise.all([
    loadRecentPoints(),
    loadSeriesMeta(),
    loadFomcDecisionDates(now.toISOString().slice(0, 10)),
  ]);

  const views = new Map<string, IndicatorView>();
  for (const indicator of MACRO_INDICATORS) {
    const src = sourceFor(indicator, recent, meta);
    views.set(indicator.key, buildView(indicator, src.points, src.meta, now));
  }

  const signals = recessionSignalIndicators().map((i) => views.get(i.key)!);
  const summary = summarizeRecession(signals.map((s) => s.status));
  const headlines = headlineIndicators().map((i) => views.get(i.key)!);

  const groups = orderedMacroGroups().map((group) => ({
    group,
    items: indicatorsByGroup(group.key)
      .map((i) => views.get(i.key)!)
      .slice(0, 3),
    total: indicatorsByGroup(group.key).length,
  }));

  const dates = [...views.values()].map((v) => v.asOf).filter((d): d is string => !!d);
  const asOf = dates.length ? dates.slice().sort().reverse()[0] : undefined;

  const fedHike = estimateFedHike(
    Object.fromEntries(
      Object.entries(FED_HIKE_KEYS).map(([field, key]) => [field, views.get(key)?.value]),
    ),
  );
  // ⚠ 가장 최근이 아니라 **가장 오래된** 기준일을 쓴다. 한 지표만 오늘 것이어도
  //    "오늘 기준"이라고 적으면 묵은 판단을 새 것으로 보이게 한다.
  const fedHikeDates = Object.values(FED_HIKE_KEYS)
    .map((key) => views.get(key)?.asOf)
    .filter((d): d is string => !!d);
  const fedHikeAsOf = fedHikeDates.length ? fedHikeDates.slice().sort()[0] : undefined;

  /**
   * 선물 내재 정책금리.
   *
   * ⚠ 계약월을 저장하지 않는 대신 **수집 시점의 불변식**을 되짚는다 —
   *   `ingest.ts`의 `fetchFrontContract`는 「시세일의 다음 달 계약」만 저장한다.
   *   그 불변식이 깨지면 값이 저장되지 않으므로, 여기서 계약월을 계산해도 안전하다.
   * ⚠ 회의 일정은 캘린더에서 온다. 비어 있으면 계산하지 않는다(`impliedFromFutures`).
   */
  const zq = views.get("zq_front");
  const fedFutures =
    zq?.value !== undefined && zq.asOf
      ? impliedFromFutures({
          impliedAvg: zq.value,
          contractMonth: nextMonthOf(zq.asOf),
          currentRate: views.get(FED_HIKE_KEYS.fedFunds)?.value,
          meetings: fomc,
          quoteDate: zq.asOf,
        })
      : undefined;

  /**
   * ⭐ 자본 엔진의 두 격차.
   *
   * ⚠ 생산성은 **시계열로** 넘긴다 — 한 분기는 크게 튀어서, 최근 값 하나만 보면 그 분기의
   *   잡음이 결론이 된다. 4분기 평균과 최근분기를 **함께** 내는 이유다.
   * ⚠ 값이 없으면 `computeCapitalSpreads`가 아무것도 내지 않는다. 0으로 채우지 않는다.
   */
  const capital = computeCapitalSpreads({
    productivityYoy: views.get("prod_yoy")?.points ?? [],
    realYield: views.get("real10")?.value,
    realYieldAsOf: views.get("real10")?.asOf,
    nominalGrowth: views.get("ngdp_yoy")?.value,
    nominalGrowthAsOf: views.get("ngdp_yoy")?.asOf,
    nominalYield: views.get("ust10y")?.value,
    nominalYieldAsOf: views.get("ust10y")?.asOf,
  });

  return {
    summary,
    signals,
    headlines,
    groups,
    indicatorCount: MACRO_INDICATORS.length,
    asOf,
    empty: dates.length === 0,
    capital,
    health: summarizeHealth([...views.values()].map((v) => v.freshness)),
    fedHike,
    fedHikeAsOf: fedHike ? fedHikeAsOf : undefined,
    fedFutures,
    fedFuturesAsOf: fedFutures ? zq?.asOf : undefined,
  };
}

export type MacroGroupDetail = {
  group: MacroGroup;
  items: IndicatorView[];
  /** 이전·다음 그룹 — 상세에서 계속 읽어 나갈 수 있게 */
  prev?: MacroGroup;
  next?: MacroGroup;
  asOf?: string;
  health: MacroHealth;
};

/** 그룹 상세 — 시계열까지 통째로 읽는다(차트가 필요하다). */
export async function loadMacroGroup(key: MacroGroupKey): Promise<MacroGroupDetail | null> {
  const ordered = orderedMacroGroups();
  const index = ordered.findIndex((g) => g.key === key);
  if (index < 0) return null;

  const indicators = indicatorsByGroup(key);
  const [series, meta] = await Promise.all([
    // ⚠ 파생의 성분까지 읽는다. 성분이 다른 묶음에 있으면 안 읽고 빈 선을 그리게 된다.
    loadSeriesMany(withDerivedComponents(indicators.map((i) => i.key))),
    loadSeriesMeta(),
  ]);
  const now = new Date();
  const items = indicators.map((i) => {
    const src = sourceFor(i, series, meta);
    return buildView(i, src.points, src.meta, now);
  });

  const dates = items.map((v) => v.asOf).filter((d): d is string => !!d);

  return {
    group: ordered[index],
    items,
    prev: index > 0 ? ordered[index - 1] : undefined,
    next: index < ordered.length - 1 ? ordered[index + 1] : undefined,
    asOf: dates.length ? dates.slice().sort().reverse()[0] : undefined,
    health: summarizeHealth(items.map((v) => v.freshness)),
  };
}

/** 관리자 화면용 — 전체 지표의 최신 상태(수집됐는지, 언제 것인지). */
export async function loadMacroStatus(): Promise<IndicatorView[]> {
  const [recent, meta] = await Promise.all([loadRecentPoints(), loadSeriesMeta()]);
  const now = new Date();
  return MACRO_INDICATORS.map((i) => {
    const src = sourceFor(i, recent, meta);
    return buildView(i, src.points, src.meta, now);
  });
}

/**
 * 화면 상단 건강도 한 줄. 전부 정상이면 `notice`가 null이고 **화면은 조용하다.**
 * ⚠ 늘 무언가 떠 있으면 아무도 안 읽는다 — 그러면 기능이 있으나 마나가 된다.
 */
export function macroHealth(views: IndicatorView[]): { health: MacroHealth; notice: string | null } {
  const health = summarizeHealth(views.map((v) => v.freshness));
  return { health, notice: healthNotice(health) };
}

/* ─────────────── 오버레이 비교 ─────────────── */

export type MacroOverlayDetail = {
  /** 고른 지표의 화면 모양(신선도·기준일까지) — 범례가 이걸 쓴다 */
  views: IndicatorView[];
  result: OverlayResult;
  health: MacroHealth;
};

/**
 * 여러 지표를 한 시간축에 겹친다.
 *
 * ⚠ 겹치기 전에 **각 계열의 변환을 먼저 적용**한다(YoY 지표는 YoY로 겹쳐야 한다).
 *   원값끼리 겹치면 "CPI 지수 320"과 "금리 4.6"을 한 축에 놓는 꼴이 된다.
 * ⚠ 신선도를 함께 낸다 — 낡은 계열이 섞인 그림을 오늘 그림으로 읽으면,
 *   화면만 회색으로 칠하고 결론은 그대로 내는 것과 같다(볼트 §5-2).
 */
export async function loadMacroOverlay(input: {
  keys: string[];
  mode: OverlayMode;
  years: number;
}): Promise<MacroOverlayDetail> {
  const indicators = input.keys
    .map((k) => MACRO_INDICATORS.find((i) => i.key === k))
    .filter((i): i is MacroIndicator => !!i);

  const [series, meta] = await Promise.all([
    loadSeriesMany(withDerivedComponents(indicators.map((i) => i.key))),
    loadSeriesMeta(),
  ]);
  const now = new Date();
  const views = indicators.map((i) => {
    const src = sourceFor(i, series, meta);
    return buildView(i, src.points, src.meta, now);
  });

  const result = buildOverlay({
    series: views.map((v) => ({
      key: v.indicator.key,
      label: v.indicator.name,
      unit: v.indicator.unit,
      points: v.points,
    })),
    mode: input.mode,
    years: input.years,
    now,
  });

  return { views, result, health: summarizeHealth(views.map((v) => v.freshness)) };
}

export { MACRO_GROUPS };

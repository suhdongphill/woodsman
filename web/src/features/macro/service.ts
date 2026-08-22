/**
 * 화면이 쓰는 모양으로 지표를 조립한다.
 *
 * 라우트(`src/app/**`)는 조립만 한다는 규칙(CLAUDE.md 1장)에 따라, "카탈로그 + DB 값 +
 * 변환 + 판정"을 합치는 일은 여기서 한다. 홈·허브·상세·관리자 화면이 **같은 계산**을
 * 쓰게 하려는 목적도 있다 — 화면마다 따로 계산하면 같은 지표가 다른 값으로 보인다.
 */
import {
  MACRO_INDICATORS,
  headlineIndicators,
  indicatorsByGroup,
  recessionSignalIndicators,
  type MacroIndicator,
} from "@/lib/macro/catalog";
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
  groups: { group: MacroGroup; items: IndicatorView[] }[];
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
  const [recent, meta] = await Promise.all([loadRecentPoints(), loadSeriesMeta()]);
  const now = new Date();

  const views = new Map<string, IndicatorView>();
  for (const indicator of MACRO_INDICATORS) {
    views.set(
      indicator.key,
      buildView(indicator, recent.get(indicator.key), meta.get(indicator.key), now),
    );
  }

  const signals = recessionSignalIndicators().map((i) => views.get(i.key)!);
  const summary = summarizeRecession(signals.map((s) => s.status));
  const headlines = headlineIndicators().map((i) => views.get(i.key)!);

  const groups = orderedMacroGroups().map((group) => ({
    group,
    items: indicatorsByGroup(group.key)
      .map((i) => views.get(i.key)!)
      .slice(0, 3),
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

  return {
    summary,
    signals,
    headlines,
    groups,
    asOf,
    empty: dates.length === 0,
    health: summarizeHealth([...views.values()].map((v) => v.freshness)),
    fedHike,
    fedHikeAsOf: fedHike ? fedHikeAsOf : undefined,
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
    loadSeriesMany(indicators.map((i) => i.key)),
    loadSeriesMeta(),
  ]);
  const now = new Date();
  const items = indicators.map((i) => buildView(i, series.get(i.key), meta.get(i.key), now));

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
  return MACRO_INDICATORS.map((i) => buildView(i, recent.get(i.key), meta.get(i.key), now));
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
    loadSeriesMany(indicators.map((i) => i.key)),
    loadSeriesMeta(),
  ]);
  const now = new Date();
  const views = indicators.map((i) => buildView(i, series.get(i.key), meta.get(i.key), now));

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

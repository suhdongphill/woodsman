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
import { loadRecentPoints, loadSeriesMany } from "./repository";

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
};

function buildView(indicator: MacroIndicator, raw: SeriesPoint[] | undefined): IndicatorView {
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
};

/**
 * 홈·허브가 쓰는 요약.
 *
 * ⚠ 값이 없을 때 화면을 비워 두지 않는다. "아직 가져오지 않았다"를 말한다 —
 *    빈 화면은 고장과 구분되지 않는다.
 */
export async function loadMacroOverview(): Promise<MacroOverview> {
  const recent = await loadRecentPoints();

  const views = new Map<string, IndicatorView>();
  for (const indicator of MACRO_INDICATORS) {
    views.set(indicator.key, buildView(indicator, recent.get(indicator.key)));
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

  return { summary, signals, headlines, groups, asOf, empty: dates.length === 0 };
}

export type MacroGroupDetail = {
  group: MacroGroup;
  items: IndicatorView[];
  /** 이전·다음 그룹 — 상세에서 계속 읽어 나갈 수 있게 */
  prev?: MacroGroup;
  next?: MacroGroup;
  asOf?: string;
};

/** 그룹 상세 — 시계열까지 통째로 읽는다(차트가 필요하다). */
export async function loadMacroGroup(key: MacroGroupKey): Promise<MacroGroupDetail | null> {
  const ordered = orderedMacroGroups();
  const index = ordered.findIndex((g) => g.key === key);
  if (index < 0) return null;

  const indicators = indicatorsByGroup(key);
  const series = await loadSeriesMany(indicators.map((i) => i.key));
  const items = indicators.map((i) => buildView(i, series.get(i.key)));

  const dates = items.map((v) => v.asOf).filter((d): d is string => !!d);

  return {
    group: ordered[index],
    items,
    prev: index > 0 ? ordered[index - 1] : undefined,
    next: index < ordered.length - 1 ? ordered[index + 1] : undefined,
    asOf: dates.length ? dates.slice().sort().reverse()[0] : undefined,
  };
}

/** 관리자 화면용 — 전체 지표의 최신 상태(수집됐는지, 언제 것인지). */
export async function loadMacroStatus(): Promise<IndicatorView[]> {
  const recent = await loadRecentPoints();
  return MACRO_INDICATORS.map((i) => buildView(i, recent.get(i.key)));
}

export { MACRO_GROUPS };

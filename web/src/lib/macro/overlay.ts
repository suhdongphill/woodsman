/**
 * 지표 오버레이 — 여러 계열을 **같은 시간축 위에 세워 괴리를 본다**. 순수 함수.
 *
 * 볼트 `_apps/지표 오버레이 비교.html`을 사이트로 옮긴 것이다(2026-08-22).
 * 볼트 것은 브라우저에서 도는 단일 HTML이고, 여기서는 **서버에서 SVG로 그린다** —
 * 검색으로 들어온 사람에게 스크립트 없이도 그림이 보여야 한다(`SeriesChart`와 같은 이유).
 *
 * ## ⚠ 이중축을 만들지 않는다 (볼트 섹터 사양서 1-2)
 * 단위가 다른 계열을 한 그림에 겹치면서 축을 두 개 그리면, **축의 눈금을 어떻게 잡느냐로
 * 아무 결론이나 만들 수 있다.** "금리가 오르자 주가가 빠졌다"는 그림은 축을 조금만 옮겨도
 * "무관하다"가 된다. 그래서 이 화면은 축을 하나만 쓰고,
 *
 *   - 단위가 **전부 같으면** 원값 그대로 겹칠 수 있다(`raw`).
 *   - 하나라도 다르면 **척도를 환산해야만** 겹친다(`rebase` 또는 `zscore`).
 *
 * 이건 옵션이 아니라 게이트다. {@link canOverlayRaw}가 false인데 `raw`를 요청하면
 * 조용히 그려 주지 않고 **환산 모드로 바꾸고 그 사실을 화면에 적는다.**
 *
 * ## ⚠ 겹쳐 보인다고 인과가 아니다
 * 이 화면이 낼 수 있는 것은 "같이 움직였다"까지다. 화면 문구가 그 선을 넘지 않는다.
 */
import type { SeriesPoint } from "./series";

/** 척도 환산 방법. */
export type OverlayMode = "raw" | "rebase" | "zscore";

export const OVERLAY_MODES: { key: OverlayMode; label: string; desc: string }[] = [
  {
    key: "raw",
    label: "원값",
    desc: "숫자를 그대로 겹칩니다. 단위가 모두 같을 때만 쓸 수 있습니다.",
  },
  {
    key: "rebase",
    label: "기준=100",
    desc: "시작점을 100으로 맞춰 '그 뒤로 몇 % 움직였나'를 비교합니다.",
  },
  {
    key: "zscore",
    label: "표준화",
    desc: "각 계열을 평균 0·표준편차 1로 폅니다. 단위도 크기도 다른 것을 나란히 놓을 때.",
  },
];

/** 볼 수 있는 기간(년). ⚠ 늘리려면 저장된 점 수를 먼저 확인할 것. */
export const OVERLAY_SPANS = [1, 3, 5, 10] as const;
export type OverlaySpan = (typeof OVERLAY_SPANS)[number];

/**
 * 한 화면에 겹칠 수 있는 최대 계열 수.
 * ⚠ 색으로 구분하는 선이 다섯을 넘으면 사람이 못 읽는다. 그리고 이 사이트는
 *    **색만으로 식별하게 두지 않으므로**(표를 같이 낸다) 표가 감당할 폭이기도 하다.
 */
export const OVERLAY_MAX = 4;

export function isOverlayMode(raw: string): raw is OverlayMode {
  return OVERLAY_MODES.some((m) => m.key === raw);
}

export function isOverlaySpan(raw: number): raw is OverlaySpan {
  return (OVERLAY_SPANS as readonly number[]).includes(raw);
}

/**
 * 주소창의 `keys=a,b,c`를 목록으로.
 * ⚠ 모르는 키는 **버린다**(있는 척하지 않는다). 개수는 {@link OVERLAY_MAX}에서 자른다.
 */
export function parseOverlayKeys(raw: string | null | undefined, valid: string[]): string[] {
  if (!raw) return [];
  const allowed = new Set(valid);
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const key = part.trim();
    if (key && allowed.has(key) && !out.includes(key)) out.push(key);
    if (out.length >= OVERLAY_MAX) break;
  }
  return out;
}

/** 단위가 전부 같은가 — 원값으로 겹쳐도 되는 유일한 조건이다. */
export function canOverlayRaw(units: string[]): boolean {
  if (units.length === 0) return false;
  return units.every((u) => u === units[0]);
}

/**
 * 요청한 모드를 **쓸 수 있는 모드로** 바꾼다.
 * ⚠ 못 쓰는 이유를 함께 돌려준다 — 조용히 다른 걸 그리면 사용자는 자기가 고른 걸 봤다고 믿는다.
 */
export function resolveMode(
  requested: OverlayMode,
  units: string[],
): { mode: OverlayMode; changed?: string } {
  if (requested !== "raw") return { mode: requested };
  if (canOverlayRaw(units)) return { mode: "raw" };
  return {
    mode: "rebase",
    changed:
      "단위가 서로 달라 원값으로 겹칠 수 없습니다. 축을 두 개 그리면 눈금을 조정하는 것만으로 아무 결론이나 만들 수 있어, 척도를 환산해 그렸습니다.",
  };
}

/** 최근 `years`년만 남긴다. */
export function sliceYears(points: SeriesPoint[], years: number, now: Date): SeriesPoint[] {
  const from = new Date(now.getTime() - years * 365.25 * 86_400_000).toISOString().slice(0, 10);
  return points.filter((p) => p.date >= from);
}

/**
 * 첫 값을 100으로 맞춘다.
 * ⚠ 첫 값이 0이거나 음수면 **환산이 성립하지 않는다**(금리차·스프레드는 음수가 된다).
 *    그때는 빈 배열을 돌려주고, 부르는 쪽이 표준화로 넘긴다 — 억지로 그리면 그림이 거짓말을 한다.
 */
export function rebase100(points: SeriesPoint[]): SeriesPoint[] {
  const base = points[0]?.value;
  if (base === undefined || base <= 0) return [];
  return points.map((p) => ({ date: p.date, value: (p.value / base) * 100 }));
}

/** 평균 0 · 표준편차 1. 값이 전부 같으면 전부 0이다(선이 평평해도 거짓말은 아니다). */
export function zscore(points: SeriesPoint[]): SeriesPoint[] {
  if (points.length === 0) return [];
  const values = points.map((p) => p.value);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  const sd = Math.sqrt(variance);
  if (sd === 0) return points.map((p) => ({ date: p.date, value: 0 }));
  return points.map((p) => ({ date: p.date, value: (p.value - mean) / sd }));
}

export function normalize(points: SeriesPoint[], mode: OverlayMode): SeriesPoint[] {
  if (mode === "raw") return points;
  if (mode === "zscore") return zscore(points);
  const rebased = rebase100(points);
  // ⚠ 되지 않는 환산을 조용히 원값으로 떨어뜨리지 않는다. 표준화로 **올려서** 그린다.
  return rebased.length > 0 ? rebased : zscore(points);
}

export type OverlayInput = {
  key: string;
  label: string;
  unit: string;
  points: SeriesPoint[];
};

export type OverlayLine = {
  key: string;
  label: string;
  unit: string;
  /** 환산이 끝난 점들 */
  points: SeriesPoint[];
  /** 환산 전 마지막 원값 — 표에는 사람이 아는 숫자를 낸다 */
  rawLast?: number;
  rawFirst?: number;
  /** 기간 안의 변화율(%). 원값 기준. 첫 값이 0이면 undefined */
  changePct?: number;
  /** ⚠ 이 계열만 환산 방식이 달라졌나(rebase가 안 돼 표준화로 간 경우) */
  fellBackToZscore: boolean;
};

export type OverlayResult = {
  mode: OverlayMode;
  /** 요청한 모드를 못 써서 바꿨다면 그 이유 */
  modeNotice?: string;
  lines: OverlayLine[];
  /** 그림에 실제로 들어간 구간 */
  from?: string;
  to?: string;
  /** 점이 모자라 못 그린 계열 */
  tooShort: string[];
};

/** 두 점 이상 있어야 선이 된다. */
const MIN_POINTS = 2;

export function buildOverlay(input: {
  series: OverlayInput[];
  mode: OverlayMode;
  years: number;
  now: Date;
}): OverlayResult {
  const sliced = input.series.map((s) => ({ ...s, points: sliceYears(s.points, input.years, input.now) }));
  const usable = sliced.filter((s) => s.points.length >= MIN_POINTS);
  const tooShort = sliced.filter((s) => s.points.length < MIN_POINTS).map((s) => s.label);

  const { mode, changed } = resolveMode(input.mode, usable.map((s) => s.unit));

  const lines: OverlayLine[] = usable.map((s) => {
    const normalized = normalize(s.points, mode);
    const rawFirst = s.points[0]?.value;
    const rawLast = s.points[s.points.length - 1]?.value;
    return {
      key: s.key,
      label: s.label,
      unit: s.unit,
      points: normalized,
      rawFirst,
      rawLast,
      changePct:
        rawFirst !== undefined && rawLast !== undefined && rawFirst !== 0
          ? ((rawLast - rawFirst) / Math.abs(rawFirst)) * 100
          : undefined,
      fellBackToZscore: mode === "rebase" && rebase100(s.points).length === 0,
    };
  });

  const dates = lines.flatMap((l) => l.points.map((p) => p.date)).sort();

  return {
    mode,
    modeNotice: changed,
    lines,
    from: dates[0],
    to: dates[dates.length - 1],
    tooShort,
  };
}

/**
 * 표로 보기용 — 날짜별로 계열 값을 나란히 편다.
 * ⚠ **색만으로 계열을 식별하게 두지 않기 위한 대체 표현**이다(볼트 화면과 같은 이유).
 *    화면 낭독기와 색각 이상인 사람에게는 이 표가 그림 자체다.
 */
export function overlayTable(
  lines: OverlayLine[],
  rows: number,
): { date: string; values: (number | undefined)[] }[] {
  const dates = [...new Set(lines.flatMap((l) => l.points.map((p) => p.date)))].sort();
  const picked = dates.slice(-rows);
  const maps = lines.map((l) => new Map(l.points.map((p) => [p.date, p.value])));
  return picked.map((date) => ({ date, values: maps.map((m) => m.get(date)) }));
}

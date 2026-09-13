/**
 * 원자료 빈티지 — 순수 함수. Capital Regime Engine R1 (2026-09-13).
 *
 * ## 왜 필요한가
 * `MacroPoint`는 최근 60일을 다시 받아 **덮어쓴다.** 통계 수정을 반영하려는 것이었는데, 그 대가로
 * **수정 전 값이 사라진다.** GDP·고용·생산성은 발표 뒤 두세 번 고쳐진다. 「2026-07-30에 시장이 본
 * 2분기 GDP」를 되살릴 수 없으면, 과거 시점의 판정을 다시 계산할 때 **그때는 몰랐던 수정치**가 섞인다
 * (look-ahead bias — 설계서 `docs/설계_자본레짐엔진.md` PART XXX·XXXI).
 *
 * 그래서 층을 가른다.
 * - **L1 `MacroObservation`** — 추가만 한다. 값이 **처음 보였을 때**와 **달라졌을 때**만 행이 생긴다.
 * - **L2 `MacroPoint`** — 지금처럼 계열별 최신 1벌. 화면은 여기를 읽는다.
 *
 * ## ⚠ `vintageDate`가 뜻하는 것 — 출처마다 다르다
 * | origin | vintageDate | 뜻 |
 * |---|---|---|
 * | `ALFRED` | `realtime_start` | **발표 기관이 그 값을 낸 날**(가장 정확하다) |
 * | `INGEST` | 수집한 날(KST) | **우리가 그 값을 처음 본 날** — 발표일보다 늦을 수 있다 |
 * | `MANUAL` | 저장한 날(KST) | 관리자가 넣은 날 |
 * | `SEED_L2` | L2의 `updatedAt` 날짜 | ⚠ **그 이전 이력은 모른다.** R1 이전에 덮어쓴 값은 되살릴 수 없다 |
 *
 * ⚠ 발표일(release date)을 모르면 **지어내지 않는다** — 수집한 날은 수집한 날이라고 부른다.
 */
import type { SeriesPoint } from "./series";

export type ObservationOrigin = "ALFRED" | "INGEST" | "MANUAL" | "SEED_L2";

/** L1의 한 행(날짜는 `YYYY-MM-DD`). */
export type VintageRow = {
  observationDate: string;
  vintageDate: string;
  value: number;
};

/**
 * 같은 값인가. ⚠ 부동소수 비교를 `===`로 하면 CSV를 다시 읽을 때마다 「수정」이 생긴다.
 * 발표 기관이 바꾸는 최소 단위(소수 셋째 자리 이하)보다 훨씬 작은 차이는 같은 값으로 본다.
 */
export function sameValue(a: number, b: number): boolean {
  if (a === b) return true;
  const scale = Math.max(1, Math.abs(a), Math.abs(b));
  return Math.abs(a - b) <= scale * 1e-9;
}

export type ObservationDiff = {
  /** L1에 한 번도 없던 관측일 */
  firstSeen: SeriesPoint[];
  /** 값이 달라진 관측일 — ⚠ 이것이 「통계 수정」이다 */
  revised: { date: string; from: number; to: number }[];
};

/**
 * 받은 값과 L1의 최신 값을 대조한다. 같은 값은 **행을 만들지 않는다**(매일 같은 값을 쌓으면 이력이 잡음이 된다).
 *
 * @param latestKnown 관측일 → L1에 있는 **가장 최근 빈티지**의 값
 */
export function diffObservations(
  incoming: SeriesPoint[],
  latestKnown: Map<string, number>,
): ObservationDiff {
  const firstSeen: SeriesPoint[] = [];
  const revised: ObservationDiff["revised"] = [];
  for (const p of incoming) {
    const known = latestKnown.get(p.date);
    if (known === undefined) firstSeen.push(p);
    else if (!sameValue(known, p.value)) revised.push({ date: p.date, from: known, to: p.value });
  }
  return { firstSeen, revised };
}

/**
 * ⭐ **그날 알려져 있던 값**으로 시계열을 되살린다(REAL_TIME_VINTAGE).
 *
 * 관측일마다 `vintageDate <= asOf`인 행 중 가장 늦은 것을 고른다. 그날까지 한 번도 발표되지 않은
 * 관측일은 **빠진다** — 그때는 그 값이 없었기 때문이다.
 * `asOf`를 먼 미래로 주면 LATEST_VINTAGE가 된다.
 */
export function valuesAsOf(rows: VintageRow[], asOf: string): SeriesPoint[] {
  const best = new Map<string, VintageRow>();
  for (const r of rows) {
    if (r.vintageDate > asOf) continue;
    const cur = best.get(r.observationDate);
    if (!cur || r.vintageDate > cur.vintageDate) best.set(r.observationDate, r);
  }
  return [...best.values()]
    .map((r) => ({ date: r.observationDate, value: r.value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** ALFRED `fred/series/observations`(realtime 범위 조회)의 한 줄. */
export type AlfredObservation = {
  realtime_start: string;
  realtime_end: string;
  date: string;
  value: string;
};

/**
 * ALFRED 응답 → L1 행.
 *
 * - 결측(`"."`)은 버린다 — 빈 값을 0으로 만들지 않는다.
 * - ⚠ **관측일이 그 빈티지보다 뒤인 점은 버린다.** 그 시점의 전망이지 관측이 아니다
 *   (`GDPPOT`처럼 추계가 붙어 오는 계열 — `observed.ts`와 같은 규칙을 빈티지마다 건다).
 */
export function alfredToRows(obs: AlfredObservation[]): { rows: VintageRow[]; skippedMissing: number; skippedFuture: number } {
  const rows: VintageRow[] = [];
  let skippedMissing = 0;
  let skippedFuture = 0;
  for (const o of obs) {
    if (o.value === "." || o.value.trim() === "") {
      skippedMissing += 1;
      continue;
    }
    const value = Number(o.value);
    if (!Number.isFinite(value)) {
      skippedMissing += 1;
      continue;
    }
    if (o.date > o.realtime_start) {
      skippedFuture += 1;
      continue;
    }
    rows.push({ observationDate: o.date, vintageDate: o.realtime_start, value });
  }
  return { rows, skippedMissing, skippedFuture };
}

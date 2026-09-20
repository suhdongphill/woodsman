/**
 * GCRM 입력 계열 **조립** — 읽어 온 행을 계열 Map으로 만드는 순수 함수.
 *
 * ## ⚠ 왜 읽기에서 떼어 냈나
 * 입력을 읽는 경로가 **둘**이다.
 * - 운영 — D1 바인딩(`features/gcrm/repository.ts`)
 * - 계측 — wrangler로 **같은 D1**을 읽는 CLI(`scripts/gcrm.mjs measure`)
 *
 * 읽는 방법은 달라도 **조립은 한 벌이어야 한다.** 두 곳에 적으면 같은 지표가 사이트 안에서
 * 두 값을 갖는다 — 2026-09-20(54)에 실제로 데인 자리다(파생 지표의 성분을 한쪽만 읽고 있었다).
 *
 * ⚠ 파생 지표(`sofr_iorb`·`sofr_dispersion`·`sofr_rvol`·`baa_spread`·재정 비율 둘)는
 *    `MacroPoint`에 **저장돼 있지 않다.** 화면이 읽을 때 합성하므로(`lib/macro/derived.ts`),
 *    GCRM도 **같은 함수**로 합성한다.
 */
import { applyTransform, type SeriesPoint } from "@/lib/macro/series";
import { findIndicator, withDerivedComponents } from "@/lib/macro/registry";
import { composeDerived } from "@/lib/macro/derived";

/** `MacroPoint`에서 읽은 한 행. */
export type MacroRow = { seriesKey: string; date: string; value: number };

/**
 * 실제로 DB에서 읽어야 할 키.
 * ⚠ 파생 지표의 **성분**(`sofr`·`iorb`·`fed_receipts` …)은 GCRM 지표 목록에 없으므로
 *    키를 넓히지 않으면 그 지표들이 통째로 빠진다.
 */
export function seriesKeysToRead(seriesKeys: string[]): string[] {
  return withDerivedComponents(seriesKeys);
}

/**
 * 행 → 계열 Map.
 *
 * @param wanted  GCRM이 원하는 지표 키(성분은 빼고). 파생은 여기 있는 것만 합성한다.
 * @param rows    `seriesKey` 오름차순 · `date` 오름차순으로 읽은 행.
 */
export function buildGcrmSeries(wanted: string[], rows: MacroRow[]): Map<string, SeriesPoint[]> {
  const out = new Map<string, SeriesPoint[]>();
  for (const r of rows) {
    const list = out.get(r.seriesKey) ?? [];
    list.push({ date: String(r.date).slice(0, 10), value: r.value });
    out.set(r.seriesKey, list);
  }

  // ⚠ 파생은 포털과 같은 함수로 합성한다. 성분은 각자의 표시 변환을 거친 뒤 합성된다(derived.ts 머리말).
  for (const key of wanted) {
    if (out.has(key)) continue;
    const reg = findIndicator(key);
    if (!reg?.derived) continue;
    const parts = reg.derived.from.map((k) => {
      const comp = findIndicator(k);
      const pts = out.get(k);
      return comp && pts ? applyTransform(pts, comp.transform) : undefined;
    });
    const made = composeDerived(reg.derived, parts);
    // ⚠ 성분이 하나라도 비면 파생 자체가 없다. 빈 배열을 넣지 않는다 — 「없다」가 「0이다」가 된다.
    if (made.length > 0) out.set(key, made);
  }
  return out;
}

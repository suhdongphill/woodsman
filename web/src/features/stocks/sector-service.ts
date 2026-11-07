/**
 * 시장 전체 섹터의 강도 — `/leaders` 맨 위 표의 자료.
 * ⚠ 보조 정보라 읽기 실패로 주도주 판정까지 죽이지 않는다. 대신 「없음」과 「못 읽음」을 가른다(CLAUDE.md §3).
 */
import { loadSeriesMany } from "@/features/macro/repository";
import { indicatorsByGroup } from "@/lib/macro/catalog";
import { sectorStrength, type SectorStrength } from "@/lib/sector-strength";

/** ⚠ 시장 기준(SPY)의 키. 이 값이 없으면 상대강도를 내지 않는다 — 기준 없는 강도는 뜻이 없다. */
const BENCHMARK_KEY = "spx_etf";

export type SectorStrengthResult = { items: SectorStrength[]; failed: boolean };

export async function loadSectorStrengths(): Promise<SectorStrengthResult> {
  const leaders = indicatorsByGroup("leaders");
  try {
    const series = await loadSeriesMany(leaders.map((i) => i.key));
    const benchmark = series.get(BENCHMARK_KEY);
    const items = leaders
      // 기준(SPY)은 비교 대상이지 섹터가 아니다 — 표에 넣지 않는다.
      .filter((i) => i.key !== BENCHMARK_KEY)
      .map((i) => sectorStrength({ key: i.key, name: i.name, points: series.get(i.key) ?? [] }, benchmark))
      .filter((s): s is SectorStrength => s !== null);
    return { items, failed: false };
  } catch (error) {
    console.error("[sectors] 섹터 시세를 읽지 못했다", error);
    return { items: [], failed: true };
  }
}

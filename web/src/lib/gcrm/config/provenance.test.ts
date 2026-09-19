/**
 * 출처 대장 테스트.
 *
 * ⚠ 이 테스트가 지키는 것은 **「값과 근거가 따로 놀지 않는다」**이다.
 * 설정값을 고치면서 근거를 안 고치면 여기서 깨진다 — 6개월 뒤에
 * 「이 0.6은 왜 0.6인가」를 아무도 답하지 못하는 상태를 막는 유일한 장치다.
 */
import { describe, it, expect } from "vitest";
import { PROVENANCE, PROVENANCE_BY_ID, liveValues, ungrounded, provenanceSummary } from "./provenance";
import { GCRM_PILLARS } from "./pillars";

describe("출처 대장", () => {
  it("id가 중복되지 않는다", () => {
    const ids = PROVENANCE.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("⚠ 적어 둔 값이 지금 설정과 같다 — 다르면 근거를 다시 적어야 한다", () => {
    const live = liveValues();
    const drifted: string[] = [];
    for (const [id, value] of Object.entries(live)) {
      const entry = PROVENANCE_BY_ID.get(id);
      if (!entry) {
        drifted.push(`${id}: liveValues에는 있는데 대장에 항목이 없다`);
        continue;
      }
      if (JSON.stringify(entry.value) !== JSON.stringify(value)) {
        drifted.push(`${id}: 대장 ${JSON.stringify(entry.value)} ≠ 설정 ${JSON.stringify(value)}`);
      }
    }
    expect(drifted).toEqual([]);
  });

  it("숫자를 가진 항목은 전부 liveValues가 추적한다 — 값이 있는데 대조를 안 하면 드리프트가 보이지 않는다", () => {
    const live = liveValues();
    // ⚠ value가 null인 항목은 분류 체계·원리처럼 단일 값이 없는 결정이다. 기계 대조 대상이 아니다.
    const untracked = PROVENANCE.filter((p) => p.value !== null && !(p.id in live)).map((p) => p.id);
    expect(untracked).toEqual([]);
  });

  it("⚠ 값이 null인 항목은 개념적 결정뿐이다 — 숫자를 null로 도망가지 못하게 한다", () => {
    const conceptual = PROVENANCE.filter((p) => p.value === null).map((p) => p.id);
    expect(conceptual.sort()).toEqual(
      [
        "channel_taxonomy",
        "normal_cdf",
        "overlap_principle",
        "pct_rank_midrank",
        "pillar_taxonomy",
        "point_in_time",
        "quantile_type7",
        "short_history_warning",
        "unmapped_pillar_mappings",
      ].sort(),
    );
  });

  it("⚠ D등급(근거 없음)에는 검증 계획이 반드시 있다", () => {
    const missing = ungrounded()
      .filter((p) => !p.reviewPlan)
      .map((p) => p.id);
    expect(missing).toEqual([]);
  });

  it("모든 항목에 근거 문장이 있다", () => {
    expect(PROVENANCE.filter((p) => !p.basis.trim()).map((p) => p.id)).toEqual([]);
  });

  it("B등급에는 출처 링크가 있다 — 「기관과 대조했다」는 말만으로는 대조가 아니다", () => {
    const noSource = PROVENANCE.filter((p) => p.grade === "B" && !p.source?.length && !p.basis.includes("포털"));
    expect(noSource.map((p) => p.id)).toEqual([]);
  });

  it("⚠ 기둥 간 가중치는 균등이다 — 차등의 근거가 생기기 전까지", () => {
    // 운영자 결정 2026-09-19: 기준이 명확하지 않으면 균등으로 한다.
    const ws = GCRM_PILLARS.map((p) => p.axisWeight);
    expect(new Set(ws).size, `균등이 아니다: ${ws.join(", ")}`).toBe(1);
    expect(ws.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    expect(PROVENANCE_BY_ID.get("axis_weight_pillars")?.grade).toBe("D");
  });

  it("등급 집계가 센다", () => {
    const s = provenanceSummary();
    expect(s.A + s.B + s.C + s.D).toBe(PROVENANCE.length);
    expect(s.D).toBeGreaterThan(0); // ⚠ 0이 되면 「전부 근거 있음」이라는 뜻이다. 그럴 리 없다
  });
});

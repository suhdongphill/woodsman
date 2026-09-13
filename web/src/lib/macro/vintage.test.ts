import { describe, expect, it } from "vitest";
import { alfredToRows, diffObservations, sameValue, valuesAsOf, type VintageRow } from "./vintage";

describe("같은 값인가", () => {
  it("⚠ CSV를 다시 읽어 생긴 부동소수 차이는 수정이 아니다", () => {
    expect(sameValue(0.1 + 0.2, 0.3)).toBe(true);
    expect(sameValue(29349.924, 29349.924000000001)).toBe(true);
  });

  it("발표 기관이 고친 값(소수 셋째 자리)은 다른 값이다", () => {
    expect(sameValue(29349.924, 29350.101)).toBe(false);
    expect(sameValue(2.1, 2.2)).toBe(false);
  });
});

describe("받은 값과 L1 대조", () => {
  const known = new Map([
    ["2026-01-01", 100],
    ["2026-04-01", 101],
  ]);

  it("처음 보는 관측일은 firstSeen, 값이 바뀐 관측일은 revised", () => {
    const d = diffObservations(
      [
        { date: "2026-01-01", value: 100 },
        { date: "2026-04-01", value: 101.4 },
        { date: "2026-07-01", value: 102 },
      ],
      known,
    );
    expect(d.firstSeen.map((p) => p.date)).toEqual(["2026-07-01"]);
    expect(d.revised).toEqual([{ date: "2026-04-01", from: 101, to: 101.4 }]);
  });

  it("⚠ 같은 값은 행을 만들지 않는다 — 매일 같은 값을 쌓으면 이력이 잡음이 된다", () => {
    const d = diffObservations([{ date: "2026-01-01", value: 100 }], known);
    expect(d.firstSeen).toHaveLength(0);
    expect(d.revised).toHaveLength(0);
  });
});

describe("⭐ 그날 알려져 있던 값 (look-ahead bias 방지)", () => {
  // 2분기 GDP: 7/30 속보 100 → 8/28 잠정 101 → 9/25 확정 102. 3분기는 10/29에 처음 나온다.
  const rows: VintageRow[] = [
    { observationDate: "2026-04-01", vintageDate: "2026-07-30", value: 100 },
    { observationDate: "2026-04-01", vintageDate: "2026-08-28", value: 101 },
    { observationDate: "2026-04-01", vintageDate: "2026-09-25", value: 102 },
    { observationDate: "2026-07-01", vintageDate: "2026-10-29", value: 103 },
  ];

  it("⚠ 8월 중순에는 속보치만 알려져 있었다 — 나중의 수정치를 섞지 않는다", () => {
    expect(valuesAsOf(rows, "2026-08-15")).toEqual([{ date: "2026-04-01", value: 100 }]);
  });

  it("그날 나온 빈티지는 그날 알려진 것이다", () => {
    expect(valuesAsOf(rows, "2026-08-28")).toEqual([{ date: "2026-04-01", value: 101 }]);
  });

  it("⚠ 아직 발표되지 않은 관측일은 빠진다 — 그때는 그 값이 없었다", () => {
    expect(valuesAsOf(rows, "2026-10-01").map((p) => p.date)).toEqual(["2026-04-01"]);
  });

  it("먼 미래를 주면 최신 빈티지(LATEST_VINTAGE)가 된다", () => {
    expect(valuesAsOf(rows, "9999-12-31")).toEqual([
      { date: "2026-04-01", value: 102 },
      { date: "2026-07-01", value: 103 },
    ]);
  });
});

describe("ALFRED 응답 → L1 행", () => {
  it("결측은 버리고 세어 둔다 — 빈 값을 0으로 만들지 않는다", () => {
    const r = alfredToRows([
      { realtime_start: "2026-07-30", realtime_end: "9999-12-31", date: "2026-04-01", value: "." },
      { realtime_start: "2026-07-30", realtime_end: "9999-12-31", date: "2026-01-01", value: "29349.9" },
    ]);
    expect(r.rows).toEqual([{ observationDate: "2026-01-01", vintageDate: "2026-07-30", value: 29349.9 }]);
    expect(r.skippedMissing).toBe(1);
  });

  it("⚠ 빈티지보다 뒤의 관측일(그 시점의 전망)은 버린다 — GDPPOT의 2036년 값", () => {
    const r = alfredToRows([
      { realtime_start: "2026-02-27", realtime_end: "9999-12-31", date: "2036-10-01", value: "30000" },
      { realtime_start: "2026-02-27", realtime_end: "9999-12-31", date: "2025-10-01", value: "24000" },
    ]);
    expect(r.rows.map((x) => x.observationDate)).toEqual(["2025-10-01"]);
    expect(r.skippedFuture).toBe(1);
  });
});

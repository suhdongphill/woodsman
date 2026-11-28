import { describe, expect, it } from "vitest";
import { computePassThrough, passRate, passSentence, yoyLatest, type PassThroughInput, type PtPoint } from "./oil-passthrough";

/** 날짜 n일 뒤 */
const add = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const isWeekday = (d: string) => {
  const w = new Date(`${d}T12:00:00Z`).getUTCDay();
  return w >= 1 && w <= 5;
};

/** 2025-11-03(월) ~ 2026-11-23(월) — 평일 일간 현물 · 월요일 소매. 값은 날짜의 선형 함수 */
const START = "2025-11-03";
const DAYS = 386;
function daily(f: (i: number) => number, upTo = DAYS): PtPoint[] {
  const out: PtPoint[] = [];
  for (let i = 0; i <= upTo; i++) {
    const d = add(START, i);
    if (isWeekday(d)) out.push({ date: d, value: f(i) });
  }
  return out;
}
function mondays(f: (i: number) => number): PtPoint[] {
  const out: PtPoint[] = [];
  for (let i = 0; i <= DAYS; i += 7) out.push({ date: add(START, i), value: f(i) });
  return out;
}

/** 원유는 하루 −0.42달러/배럴(= −0.01달러/갤런), 도매 휘발유 하루 −0.02, 소매 휘발유 하루 −0.01(도매의 절반) */
function base(): PassThroughInput {
  return {
    crude: daily((i) => 120 - 0.42 * i),
    gasSpot: daily((i) => 6 - 0.02 * i),
    dieselSpot: daily((i) => 6 - 0.02 * i),
    jetSpot: daily((i) => 5 - 0.01 * i),
    gasRetail: mondays((i) => 9 - 0.01 * i),
    dieselRetail: mondays((i) => 9 - 0.005 * i),
    cpiGasoline: [
      { date: "2026-09-01", value: 376.558 },
      { date: "2026-10-01", value: 380.468 },
    ],
    cpiAirfare: [
      { date: "2025-10-01", value: 270 },
      { date: "2026-10-01", value: 297 },
    ],
    cpiTransportSvc: [
      { date: "2025-10-01", value: 450 },
      { date: "2026-10-01", value: 459 },
    ],
  };
}

describe("passRate — 표시 규칙", () => {
  it("같은 방향이면 비율", () => expect(passRate(-0.8, -0.48)).toEqual({ kind: "rate", value: 0.6 }));
  it("⚠ 방향이 다르면 비율을 내지 않는다(예 −226%)", () => expect(passRate(-0.214, 0.483)).toEqual({ kind: "opposite" }));
  it("앞 단계가 5센트 미만이면 「변화 작음」", () => expect(passRate(0.03, 0.2)).toEqual({ kind: "small" }));
  it("값이 없으면 없음", () => expect(passRate(undefined, 1)).toEqual({ kind: "none" }));
});

describe("computePassThrough", () => {
  it("기준일은 현물이 그 주 3일 이상 있는 가장 최근 소매 조사일이다", () => {
    const input = base();
    // 현물이 마지막 주에 하루(월요일)만 있는 상황 — EIA가 몰아서 올리기 전
    const cut = add(START, DAYS - 6);
    for (const k of ["crude", "gasSpot", "dieselSpot", "jetSpot"] as const) {
      input[k] = input[k].filter((p) => p.date <= cut);
    }
    const r = computePassThrough(input);
    // 마지막 소매 조사일은 START+385(2026-11-23 월) — 그 주 현물이 이틀뿐이라 한 주 앞 월요일(11-16)로 물러난다
    expect(r.asOf).toBe("2026-11-16");
  });

  it("원유는 배럴 ÷ 42로 갤런 단위 — 4주 변화 −0.28달러/갤런", () => {
    const r = computePassThrough(base());
    const crude4 = r.rows.find((x) => x.key === "crude")!.changes.find((c) => c.weeks === 4)!;
    expect(crude4.delta).toBeCloseTo(-0.28, 6);
  });

  it("전가율: 도매 휘발유는 원유의 2배 · 소매 휘발유는 도매의 50%", () => {
    const r = computePassThrough(base());
    const pass = (k: string) => r.rows.find((x) => x.key === k)!.changes.find((c) => c.weeks === 4)!.pass;
    expect(pass("gasSpot")).toEqual({ kind: "rate", value: expect.closeTo(2, 6) });
    expect(pass("gasRetail")).toEqual({ kind: "rate", value: expect.closeTo(0.5, 6) });
    expect(pass("dieselRetail")).toEqual({ kind: "rate", value: expect.closeTo(0.25, 6) });
  });

  it("소매 마진 = 소매가 − 그 주 도매 평균 · 52주 평균도 낸다", () => {
    const r = computePassThrough(base());
    const g = r.margins.find((m) => m.fuel === "휘발유")!;
    expect(g.now).toBeDefined();
    expect(g.avg52).toBeDefined();
    // 도매가 소매보다 빨리 내려 마진이 시간에 따라 커진다 → 지금이 평균보다 넓다
    expect(g.now!).toBeGreaterThan(g.avg52!);
  });

  it("CPI 미리 보기: 소매가 마지막 달 평균 vs 전달 평균 · CPI 휘발유 전월비", () => {
    const r = computePassThrough(base());
    expect(r.cpiPreview!.month).toBe("2026-11");
    expect(r.cpiPreview!.prevMonth).toBe("2026-10");
    expect(r.cpiPreview!.change).toBeLessThan(0);
    expect(r.cpiGasolineMom!.value).toBeCloseTo((380.468 / 376.558 - 1) * 100, 6);
  });

  it("2차 전가는 전년비를 나란히만 놓는다", () => {
    const r = computePassThrough(base());
    expect(r.secondRound[0].cpi).toMatchObject({ label: "CPI 항공료", month: "2026-10", yoy: expect.closeTo(10, 6) });
    expect(r.secondRound[0].upstream?.label).toBe("항공유 현물");
    expect(r.secondRound[1].cpi?.yoy).toBeCloseTo(2, 6);
  });

  it("⚠ 최신 달의 1년 전 값이 없으면 직전 달로 내려가고 건너뛴 달을 남긴다(채우지 않는다)", () => {
    const pts = [
      { date: "2025-08-01", value: 100 },
      { date: "2025-09-01", value: 100 },
      // 2025-10 결측(셧다운)
      { date: "2026-08-01", value: 110 },
      { date: "2026-09-01", value: 120 },
      { date: "2026-10-01", value: 130 },
    ];
    expect(yoyLatest(pts)).toEqual({ month: "2026-09", yoy: expect.closeTo(20, 6), skipped: "2026-10" });
    const r = computePassThrough({ ...base(), cpiAirfare: pts });
    expect(r.secondRound[0].cpi).toMatchObject({ month: "2026-09", skipped: "2026-10" });
  });

  it("1년 전 값이 하나도 없으면 없음 · 최신 달이 되면 skipped 없음", () => {
    expect(yoyLatest([{ date: "2026-10-01", value: 1 }])).toBeUndefined();
    expect(yoyLatest([{ date: "2025-10-01", value: 100 }, { date: "2026-10-01", value: 105 }])).toEqual({ month: "2026-10", yoy: expect.closeTo(5, 6) });
  });

  it("⚠ 소매가가 비면 기준일이 없고 표도 비운다(부분 표 금지)", () => {
    const r = computePassThrough({ ...base(), gasRetail: [] });
    expect(r.asOf).toBeUndefined();
    expect(r.rows.every((row) => row.changes.every((c) => c.delta === undefined))).toBe(true);
    expect(r.sentence).toBeUndefined();
  });
});

describe("문장", () => {
  it("전가율과 경유를 함께 말한다", () => {
    const s = computePassThrough(base()).sentence!;
    expect(s).toContain("최근 4주");
    expect(s).toContain("도매 변화의 50%");
    expect(s).toContain("경유는 25%");
    expect(s).not.toMatch(/매수|매도|사세요|파세요/);
  });

  it("방향이 다르면 비율 대신 이유를 말한다", () => {
    const rows = computePassThrough(base()).rows.map((r) =>
      r.key === "gasRetail" ? { ...r, changes: r.changes.map((c) => ({ ...c, pass: { kind: "opposite" as const } })) } : r,
    );
    expect(passSentence(rows, 4)).toContain("전가율은 내지 않습니다");
  });
});

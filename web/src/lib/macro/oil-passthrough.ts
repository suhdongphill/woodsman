/**
 * 유가 전가 점검표 — 순수 계산(2026-11-25 · 「물가 압력 보강」 ⑤-3).
 *
 * 독자 질문: 「유가가 내렸는데 주유소 값과 물가는 언제·얼마나 따라 내려오나? 덜 내려온 몫은 어디에 남아 있나?」
 * 사슬: 원유(WTI) → 도매(걸프만 현물: 휘발유·경유·항공유) → 소매(주유소: 휘발유·경유) → CPI(휘발유·항공료·운송 서비스).
 *
 * ## ⚠ 지어낸 숫자를 쓰지 않는다
 * - 단위 환산은 정의뿐이다: **1배럴 = 42갤런**(원유 $/배럴 ÷ 42 = $/갤런).
 * - 전가율 = 뒷 단계 변화 ÷ 앞 단계 변화(같은 기간·같은 주). 해석 기준(몇 %면 정상)은 두지 않는다.
 * - 표시 규칙(분석 주장이 아니다): 두 단계가 **같은 방향**이고 앞 단계 변화가 **5센트/갤런 이상**일 때만 비율을 낸다.
 *   방향이 다르면 「방향 다름」 — 비율(예 −226%)은 뜻이 없다. 앞 단계가 거의 안 움직였으면 「변화 작음」.
 *
 * ## ⚠ 같은 주로 맞춘다
 * - 소매가(EIA 주간)는 **월요일 조사값**, 현물·원유는 **그 월요일까지 7일 평균**이다. 현물은 주 1회 몰아서 올라와
 *   소매가보다 늦다 — 현물 7일 창에 **3일 이상** 값이 있는 가장 최근 월요일을 기준일로 삼는다(부분 주로 비교하지 않는다).
 * - 비교 기준일은 기준일 − 28일(4주) · − 91일(13주) 월요일. 그 날 소매가가 없으면 그 기간은 없다.
 */

export type PtPoint = { date: string; value: number };

export type PassThroughInput = {
  crude: PtPoint[]; // WTI $/배럴 일간
  gasSpot: PtPoint[]; // $/갤런 일간
  dieselSpot: PtPoint[];
  jetSpot: PtPoint[];
  gasRetail: PtPoint[]; // $/갤런 주간(월요일)
  dieselRetail: PtPoint[];
  cpiGasoline: PtPoint[]; // 지수 월간(SA)
  cpiAirfare: PtPoint[];
  cpiTransportSvc: PtPoint[];
};

export type StageKey = "crude" | "gasSpot" | "gasRetail" | "dieselSpot" | "dieselRetail" | "jetSpot";

export type PassRate =
  | { kind: "rate"; value: number }
  | { kind: "opposite" }
  | { kind: "small" }
  | { kind: "none" };

export type StageRow = {
  key: StageKey;
  label: string;
  /** 비교하는 앞 단계 */
  upstream?: StageKey;
  /** 기준일 수준($/갤런) */
  level?: number;
  changes: { weeks: number; delta?: number; pass: PassRate }[];
};

export type PassThrough = {
  /** 기준일(월요일 · 소매 조사일) */
  asOf?: string;
  rows: StageRow[];
  /** 소매 마진 = 소매가 − 그 주 도매 현물 평균($/갤런) · 지금과 지난 52주 평균 */
  margins: { fuel: "휘발유" | "경유"; now?: number; avg52?: number }[];
  /** 이번 달 주유소 휘발유 월평균 vs 지난달 월평균(%) — 다음 CPI 휘발유 방향 미리 보기 */
  cpiPreview?: { month: string; prevMonth: string; change: number; weeks: number };
  /** 최신 CPI 휘발유 전월비(%) */
  cpiGasolineMom?: { month: string; value: number };
  /** 2차 전가 — 전년비(%) 나란히, 판정 없음 */
  secondRound: { pair: string; upstream?: { label: string; yoy: number }; cpi?: { label: string; month: string; yoy: number } }[];
  sentence?: string;
};

export const GALLONS_PER_BARREL = 42;
/** 전가율을 낼 앞 단계 변화의 최소 크기($/갤런) — 표시 규칙 */
export const MIN_UPSTREAM_MOVE = 0.05;
const MIN_SPOT_DAYS = 3;

const day = (d: string) => Math.floor(Date.parse(`${d}T12:00:00Z`) / 86_400_000);
const shift = (d: string, n: number) => new Date((day(d) + n) * 86_400_000 + 43_200_000).toISOString().slice(0, 10);
const sorted = (p: PtPoint[]) => p.filter((x) => Number.isFinite(x.value)).slice().sort((a, b) => a.date.localeCompare(b.date));

/** (end−7, end] 평균 — 값이 `min`개 미만이면 undefined. */
function weekAvg(pts: PtPoint[], end: string, min = MIN_SPOT_DAYS): number | undefined {
  const lo = shift(end, -7);
  const v = pts.filter((p) => p.date > lo && p.date <= end).map((p) => p.value);
  return v.length >= min ? v.reduce((a, b) => a + b, 0) / v.length : undefined;
}

const at = (pts: PtPoint[], d: string) => pts.find((p) => p.date === d)?.value;

export function passRate(up: number | undefined, down: number | undefined): PassRate {
  if (up === undefined || down === undefined) return { kind: "none" };
  if (Math.abs(up) < MIN_UPSTREAM_MOVE) return { kind: "small" };
  if (Math.sign(up) !== Math.sign(down) && down !== 0) return { kind: "opposite" };
  return { kind: "rate", value: down / up };
}

function yoyLatest(pts: PtPoint[]): { month: string; yoy: number } | undefined {
  const s = sorted(pts);
  const last = s.at(-1);
  if (!last) return undefined;
  const prev = at(s, `${Number(last.date.slice(0, 4)) - 1}${last.date.slice(4)}`);
  return prev ? { month: last.date.slice(0, 7), yoy: (last.value / prev - 1) * 100 } : undefined;
}

export function computePassThrough(input: PassThroughInput, weeks: number[] = [4, 13]): PassThrough {
  const crude = sorted(input.crude).map((p) => ({ date: p.date, value: p.value / GALLONS_PER_BARREL }));
  const gasSpot = sorted(input.gasSpot);
  const dieselSpot = sorted(input.dieselSpot);
  const jetSpot = sorted(input.jetSpot);
  const gasRetail = sorted(input.gasRetail);
  const dieselRetail = sorted(input.dieselRetail);

  /** 기준일: 소매 조사일 가운데 원유·도매 세 현물 모두 그 주에 3일 이상 값이 있는 가장 최근 날 */
  const okWeek = (d: string) => [crude, gasSpot, dieselSpot, jetSpot].every((p) => weekAvg(p, d) !== undefined);
  const asOf = [...gasRetail].reverse().find((p) => okWeek(p.date) && at(dieselRetail, p.date) !== undefined)?.date;

  const levelOf = (key: StageKey, d: string): number | undefined => {
    switch (key) {
      case "crude":
        return weekAvg(crude, d);
      case "gasSpot":
        return weekAvg(gasSpot, d);
      case "dieselSpot":
        return weekAvg(dieselSpot, d);
      case "jetSpot":
        return weekAvg(jetSpot, d);
      case "gasRetail":
        return at(gasRetail, d);
      case "dieselRetail":
        return at(dieselRetail, d);
    }
  };

  const spec: { key: StageKey; label: string; upstream?: StageKey }[] = [
    { key: "crude", label: "원유 WTI (배럴 ÷ 42)" },
    { key: "gasSpot", label: "도매 휘발유 (걸프만 현물)", upstream: "crude" },
    { key: "gasRetail", label: "소매 휘발유 (주유소)", upstream: "gasSpot" },
    { key: "dieselSpot", label: "도매 경유 (걸프만 현물)", upstream: "crude" },
    { key: "dieselRetail", label: "소매 경유 (주유소)", upstream: "dieselSpot" },
    { key: "jetSpot", label: "항공유 (걸프만 현물)", upstream: "crude" },
  ];

  const delta = (key: StageKey, w: number): number | undefined => {
    if (!asOf) return undefined;
    const a = levelOf(key, asOf);
    const b = levelOf(key, shift(asOf, -7 * w));
    return a === undefined || b === undefined ? undefined : a - b;
  };

  const rows: StageRow[] = spec.map((s) => ({
    ...s,
    level: asOf ? levelOf(s.key, asOf) : undefined,
    changes: weeks.map((w) => {
      const d = delta(s.key, w);
      return { weeks: w, delta: d, pass: s.upstream ? passRate(delta(s.upstream, w), d) : { kind: "none" as const } };
    }),
  }));

  const marginAt = (retail: PtPoint[], spot: PtPoint[], d: string) => {
    const r = at(retail, d);
    const s = weekAvg(spot, d);
    return r === undefined || s === undefined ? undefined : r - s;
  };
  const avg52 = (retail: PtPoint[], spot: PtPoint[]) => {
    if (!asOf) return undefined;
    const lo = shift(asOf, -364);
    const v = retail
      .filter((p) => p.date > lo && p.date <= asOf)
      .map((p) => marginAt(retail, spot, p.date))
      .filter((x): x is number => x !== undefined);
    // ⚠ 1년 중 절반도 못 채우면 「평균」이라 부르지 않는다
    return v.length >= 26 ? v.reduce((a, b) => a + b, 0) / v.length : undefined;
  };
  const margins: PassThrough["margins"] = [
    { fuel: "휘발유", now: asOf ? marginAt(gasRetail, gasSpot, asOf) : undefined, avg52: avg52(gasRetail, gasSpot) },
    { fuel: "경유", now: asOf ? marginAt(dieselRetail, dieselSpot, asOf) : undefined, avg52: avg52(dieselRetail, dieselSpot) },
  ];

  // 다음 CPI 휘발유 미리 보기 — 소매가의 마지막 달 평균 vs 그 전 달 평균
  let cpiPreview: PassThrough["cpiPreview"];
  const lastRetail = gasRetail.at(-1);
  if (lastRetail) {
    const month = lastRetail.date.slice(0, 7);
    const y = Number(month.slice(0, 4));
    const m = Number(month.slice(5, 7));
    const prevMonth = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
    const cur = gasRetail.filter((p) => p.date.startsWith(month)).map((p) => p.value);
    const prev = gasRetail.filter((p) => p.date.startsWith(prevMonth)).map((p) => p.value);
    if (cur.length && prev.length >= 3) {
      const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
      cpiPreview = { month, prevMonth, change: (mean(cur) / mean(prev) - 1) * 100, weeks: cur.length };
    }
  }

  const cpiG = sorted(input.cpiGasoline);
  const cl = cpiG.at(-1);
  const cp = cpiG.at(-2);
  const cpiGasolineMom =
    cl && cp && day(cl.date) - day(cp.date) < 32 ? { month: cl.date.slice(0, 7), value: (cl.value / cp.value - 1) * 100 } : undefined;

  const spotYoy = (pts: PtPoint[]) => {
    if (!asOf) return undefined;
    const a = weekAvg(pts, asOf);
    const b = weekAvg(pts, shift(asOf, -364));
    return a !== undefined && b !== undefined ? (a / b - 1) * 100 : undefined;
  };
  const retailYoy = (pts: PtPoint[]) => {
    if (!asOf) return undefined;
    const a = at(pts, asOf);
    const b = at(pts, shift(asOf, -364));
    return a !== undefined && b !== undefined ? (a / b - 1) * 100 : undefined;
  };
  const air = yoyLatest(input.cpiAirfare);
  const trans = yoyLatest(input.cpiTransportSvc);
  const jy = spotYoy(jetSpot);
  const dy = retailYoy(dieselRetail);
  const secondRound: PassThrough["secondRound"] = [
    {
      pair: "항공유 → 항공료",
      upstream: jy === undefined ? undefined : { label: "항공유 현물", yoy: jy },
      cpi: air && { label: "CPI 항공료", month: air.month, yoy: air.yoy },
    },
    {
      pair: "경유 → 운송 서비스",
      upstream: dy === undefined ? undefined : { label: "경유 소매", yoy: dy },
      cpi: trans && { label: "CPI 운송 서비스", month: trans.month, yoy: trans.yoy },
    },
  ];

  return { asOf, rows, margins, cpiPreview, cpiGasolineMom, secondRound, sentence: passSentence(rows, 4) };
}

const cents = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(2)}`;

/** 한 문장 — 도매 → 소매 단계에 무엇이 남았는지. 방향 단정·매매 표현 없음. */
export function passSentence(rows: StageRow[], weeks: number): string | undefined {
  const ch = (k: StageKey) => rows.find((r) => r.key === k)?.changes.find((c) => c.weeks === weeks);
  const crude = ch("crude");
  const gs = ch("gasSpot");
  const gr = ch("gasRetail");
  const dr = ch("dieselRetail");
  if (crude?.delta === undefined || gs?.delta === undefined || gr?.delta === undefined) return undefined;
  const rate = (p?: PassRate) => (p?.kind === "rate" ? `${Math.round(p.value * 100)}%` : undefined);
  const g = rate(gr.pass);
  const d = rate(dr?.pass);
  const head = `최근 ${weeks}주 원유 ${cents(crude.delta)}달러/갤런 · 도매 휘발유 ${cents(gs.delta)} · 주유소 휘발유 ${cents(gr.delta)}`;
  if (!g) return `${head}입니다(도매와 소매가 같은 방향이 아니거나 변화가 작아 전가율은 내지 않습니다).`;
  return `${head} — 주유소 값은 도매 변화의 ${g}만큼 따라왔습니다${d ? `(경유는 ${d})` : ""}.`;
}

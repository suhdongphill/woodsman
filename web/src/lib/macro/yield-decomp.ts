/**
 * 10년물 분해 — 순수 계산(2026-11-25 · 「물가 압력 보강」 ⑤-2).
 *
 * 독자 질문: 「10년물이 왜 이 수준이고, 최근엔 왜 움직였나 — 물가 걱정인가, 실질금리인가, 위험 보상인가?」
 *
 * ## 두 갈래 (둘 다 공식 자료 · 우리가 정한 계수 없음)
 * - **시장 분해**(일간): 10년물(DGS10) = 실질금리(TIPS, DFII10) + 기대인플레(BEI, T10YIE).
 *   FRED의 T10YIE는 정의상 DGS10 − DFII10 이라 같은 날이면 잔차가 거의 0이다(반올림).
 * - **모형 분해**(연준 이사회 Kim–Wright): 적합 10년(THREEFY10) = 기대 단기금리 평균 + 텀 프리미엄(THREEFYTP10).
 *   기대 단기금리는 우리가 **빼서** 구한다(적합 − 텀 프리미엄).
 * ⚠ 두 분해는 축이 다르다 — 서로 더하거나 섞지 않는다. 실질금리 안에도 기대 실질 단기금리와 위험 보상이 섞여 있다.
 *
 * ## ⚠ 날짜 규칙
 * - 한 분해 안의 성분은 **같은 날짜**의 값만 짝짓는다. T10YIE는 DGS10보다 하루 늦게 올라오는 날이 있다 —
 *   다른 날짜 값을 섞으면 「잔차」가 생겨 분해가 깨진다. 공통 날짜가 없으면 그 분해는 없다.
 * - 변화 비교의 기준일은 「k개월 전 날짜 이전의 가장 가까운 공통 날짜」, 단 **7일 안**. 휴장·결측으로 더 멀면 그 기간은 없다.
 */

export type DecompPoint = { date: string; value: number };

export type YieldDecompInput = {
  nominal: DecompPoint[];
  real: DecompPoint[];
  bei: DecompPoint[];
  kwFitted: DecompPoint[];
  kwTermPremium: DecompPoint[];
};

export type MarketSplit = { date: string; nominal: number; real: number; bei: number };
export type ModelSplit = { date: string; fitted: number; expected: number; termPremium: number };

export type SplitChange<T> = { months: number; from: string; to: string; delta: Omit<T, "date"> };

export type YieldDecomp = {
  market?: MarketSplit;
  model?: ModelSplit;
  marketChanges: SplitChange<MarketSplit>[];
  modelChanges: SplitChange<ModelSplit>[];
  /** 3개월 변화를 말하는 한 문장 — 기간이 없으면 undefined */
  sentence?: string;
};

/** 비교 기준일을 찾을 때 허용하는 거리(일) — 긴 휴장 뒤의 값을 「k개월 전」이라 부르지 않는다. */
export const BASE_TOLERANCE_DAYS = 7;
/** 이보다 작은 움직임은 「거의 그대로」로 말한다(%p). 10년물 일간 표준편차가 대략 5~7bp다. */
const FLAT_THRESHOLD = 0.05;

const dayNum = (d: string) => Math.floor(Date.parse(`${d}T12:00:00Z`) / 86_400_000);

function monthsBefore(date: string, months: number): string {
  const t = new Date(`${date}T12:00:00Z`);
  const day = t.getUTCDate();
  t.setUTCDate(1);
  t.setUTCMonth(t.getUTCMonth() - months);
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(day, last));
  return t.toISOString().slice(0, 10);
}

/** 모든 계열에 있는 날짜(오름차순). */
function commonDates(series: DecompPoint[][]): string[] {
  if (series.some((s) => s.length === 0)) return [];
  const sets = series.map((s) => new Set(s.filter((p) => Number.isFinite(p.value)).map((p) => p.date)));
  return [...sets[0]].filter((d) => sets.every((s) => s.has(d))).sort();
}

function valueAt(s: DecompPoint[], date: string): number {
  return s.find((p) => p.date === date)!.value;
}

/** `target` 이전(포함) 가장 가까운 공통 날짜 — 7일 안에 없으면 undefined. */
function baseDate(dates: string[], target: string): string | undefined {
  const cands = dates.filter((d) => d <= target);
  const d = cands.at(-1);
  if (!d || dayNum(target) - dayNum(d) > BASE_TOLERANCE_DAYS) return undefined;
  return d;
}

export function decomposeYield(input: YieldDecompInput, periods: number[] = [1, 3]): YieldDecomp {
  const mDates = commonDates([input.nominal, input.real, input.bei]);
  const kDates = commonDates([input.kwFitted, input.kwTermPremium]);

  const marketAt = (d: string): MarketSplit => ({
    date: d,
    nominal: valueAt(input.nominal, d),
    real: valueAt(input.real, d),
    bei: valueAt(input.bei, d),
  });
  const modelAt = (d: string): ModelSplit => {
    const fitted = valueAt(input.kwFitted, d);
    const termPremium = valueAt(input.kwTermPremium, d);
    return { date: d, fitted, expected: fitted - termPremium, termPremium };
  };

  const market = mDates.length ? marketAt(mDates.at(-1)!) : undefined;
  const model = kDates.length ? modelAt(kDates.at(-1)!) : undefined;

  const marketChanges: SplitChange<MarketSplit>[] = [];
  const modelChanges: SplitChange<ModelSplit>[] = [];
  for (const months of periods) {
    if (market) {
      const from = baseDate(mDates, monthsBefore(market.date, months));
      if (from) {
        const a = marketAt(from);
        marketChanges.push({
          months,
          from,
          to: market.date,
          delta: { nominal: market.nominal - a.nominal, real: market.real - a.real, bei: market.bei - a.bei },
        });
      }
    }
    if (model) {
      const from = baseDate(kDates, monthsBefore(model.date, months));
      if (from) {
        const a = modelAt(from);
        modelChanges.push({
          months,
          from,
          to: model.date,
          delta: {
            fitted: model.fitted - a.fitted,
            expected: model.expected - a.expected,
            termPremium: model.termPremium - a.termPremium,
          },
        });
      }
    }
  }

  return { market, model, marketChanges, modelChanges, sentence: changeSentence(marketChanges, modelChanges, 3) };
}

const pp = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(2)}%p`;

/**
 * 한 문장 — 숫자와 기간을 함께(GEO 「한 문장 요약」 규칙). 「무엇이 움직였나」만 말하고 방향을 단정하지 않는다.
 * ⚠ 주된 성분은 **절댓값이 큰 쪽**이다. 둘이 반대로 움직여 상쇄된 경우도 그대로 말한다(10년물만 보면 안 보이는 것).
 */
export function changeSentence(
  market: SplitChange<MarketSplit>[],
  model: SplitChange<ModelSplit>[],
  months: number,
): string | undefined {
  const m = market.find((c) => c.months === months);
  if (!m) return undefined;
  const { nominal, real, bei } = m.delta;
  const driver = Math.abs(real) >= Math.abs(bei) ? "실질금리" : "기대인플레";
  const opposite = Math.sign(real) !== Math.sign(bei) && Math.abs(real) > FLAT_THRESHOLD && Math.abs(bei) > FLAT_THRESHOLD;
  const head =
    Math.abs(nominal) < FLAT_THRESHOLD
      ? `최근 ${months}개월 10년물은 거의 그대로(${pp(nominal)})지만 안에서는 실질금리 ${pp(real)} · 기대인플레 ${pp(bei)}로 움직였습니다.`
      : `최근 ${months}개월 10년물 변화 ${pp(nominal)}는 실질금리 ${pp(real)} · 기대인플레 ${pp(bei)}로, 주로 ${driver}가 움직였습니다${
          opposite ? "(둘이 반대 방향이라 일부 상쇄)" : ""
        }.`;
  const k = model.find((c) => c.months === months);
  const tail = k
    ? ` 모형(Kim–Wright)으로는 기대 단기금리 ${pp(k.delta.expected)} · 텀 프리미엄 ${pp(k.delta.termPremium)}입니다.`
    : "";
  return head + tail;
}

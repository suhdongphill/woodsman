/**
 * 자본 엔진 — 「생산성이 버는 것」과 「돈을 빌리는 값」을 맞대 본다. **순수 계산.**
 *
 * ## 이 모듈이 답하려는 질문
 * 물가를 **수요를 죽여서** 잡고 있는가, **공급을 늘려서** 흡수할 수 있는 단계로 가고 있는가.
 * 그 갈림을 재는 가장 짧은 방법이 두 개의 격차다.
 *
 * ```text
 * 생산성–실질금리 격차 = 추세 생산성 증가율 − 실질 10년 금리
 * 성장–조달 격차      = 명목 GDP 증가율     − 10년 국채 금리
 * ```
 *
 * ⭐ **둘은 다른 질문에 답한다.** 첫째는 「빌려서 투자할 값이 있나」(민간 CAPEX),
 * 둘째는 「경제가 이자보다 빨리 자라나」(부채 지속가능성)다. **엇갈릴 수 있고, 엇갈릴 때가
 * 볼 만한 때다** — 정부 부채는 굴러가는데 민간 투자는 빡빡한 상태가 그것이다.
 *
 * ## ⚠ 규칙
 * - ⚠ **우리가 붙인 이름이다.** 표준 지표가 아니다(`lib/macro/glossary.ts`의 `own: true`).
 *   화면이 그렇게 말해야 한다.
 * - ⚠ **기준일이 다른 값을 맞댄다.** 생산성은 분기 발표(두 달 넘게 늦다)이고 금리는 일간이다.
 *   그래서 **두 기준일을 둘 다 보여주고**, 대표 기준일은 **더 오래된 쪽**으로 적는다
 *   (`service.ts`의 `fedHikeAsOf`·`derivedMeta`와 같은 판단 — 새 값 하나로 묵은 판단을
 *   새것처럼 보이게 하지 않는다).
 * - ⚠ **추세와 최근분기를 함께 낸다.** 생산성 한 분기는 크게 튄다. 한 숫자만 내면 그 분기의
 *   잡음이 결론이 된다. 두 값이 부호까지 갈리면 **갈린다고 적는다.**
 * - ⚠ **값이 없으면 계산하지 않는다.** 0으로 채우지 않는다.
 */
import type { SeriesPoint } from "./series";

/** 두 격차의 기준선. 0을 넘느냐가 해석을 뒤집는다. */
export const SPREAD_BASELINE = 0;

/** 추세를 잡는 분기 수. ⚠ 4분기 = 한 해. 계절성과 한 분기 잡음을 같이 눌러 준다. */
export const TREND_QUARTERS = 4;

function dayIndex(date: string): number {
  return Math.floor(Date.parse(`${date}T00:00:00.000Z`) / 86_400_000);
}

/** 격차 한 칸의 투입값. 화면이 그대로 펼쳐 보여준다 — 되짚을 수 없는 숫자는 장식이다. */
export type SpreadPart = {
  label: string;
  value: number;
  unit: string;
  asOf?: string;
  /** 이 값이 어디서 왔나 — 화면이 링크를 건다 */
  sourceLabel?: string;
  url?: string;
};

export type Spread = {
  key: "prys" | "growth_funding";
  name: string;
  /** 대표값(%p) */
  value: number;
  parts: SpreadPart[];
  /** ⚠ 투입값 중 **가장 오래된** 기준일. 이게 이 판단의 나이다 */
  asOf?: string;
  /** 투입값 기준일 사이의 벌어짐(일). 0이면 같은 날 값이다 */
  gapDays?: number;
};

export type PrysResult = Spread & {
  key: "prys";
  /** 4분기 평균 생산성 증가율(%) */
  trend: number;
  /** 최근 분기 생산성 증가율(%) */
  latest: number;
  /** 추세로 잰 격차(%p) — `value`와 같다 */
  byTrend: number;
  /** 최근분기로 잰 격차(%p) */
  byLatest: number;
  /** ⚠ 두 읽기의 부호가 갈리는가. 갈리면 화면이 단정하지 않는다 */
  split: boolean;
  /** 추세 계산에 실제로 쓴 분기 수 */
  quartersUsed: number;
};

export type CapitalSpreads = {
  prys?: PrysResult;
  growthFunding?: Spread;
};

export type CapitalInput = {
  /** 생산성 전년비(%) 시계열. 날짜 오름차순 */
  productivityYoy: SeriesPoint[];
  /** 실질 10년 금리(%) */
  realYield?: number;
  realYieldAsOf?: string;
  /** 명목 GDP 전년비(%) */
  nominalGrowth?: number;
  nominalGrowthAsOf?: string;
  /** 10년 국채 금리(%) */
  nominalYield?: number;
  nominalYieldAsOf?: string;
};

function isNum(n: number | undefined): n is number {
  return n !== undefined && Number.isFinite(n);
}

/** ⚠ 가장 오래된 기준일. 새 값 하나로 묵은 판단을 새것처럼 보이게 하지 않는다. */
function oldest(dates: (string | undefined)[]): string | undefined {
  const known = dates.filter((d): d is string => !!d);
  if (known.length !== dates.length || known.length === 0) return undefined;
  return known.slice().sort()[0];
}

function gap(dates: (string | undefined)[]): number | undefined {
  const known = dates.filter((d): d is string => !!d);
  if (known.length < 2) return undefined;
  const sorted = known.slice().sort();
  return dayIndex(sorted[sorted.length - 1]) - dayIndex(sorted[0]);
}

/**
 * 생산성–실질금리 격차.
 *
 * ⚠ 생산성 계열이 **4분기보다 짧으면** 추세를 그 길이로 잰다. 다만 몇 분기로 쟀는지
 *   `quartersUsed`로 내보내 화면이 말하게 한다 — 두 분기 평균을 「추세」라 부르면 과장이다.
 * ⚠ 점이 하나도 없거나 실질금리가 없으면 **아무것도 내지 않는다.**
 */
export function computePrys(input: CapitalInput): PrysResult | undefined {
  const { productivityYoy: points, realYield, realYieldAsOf } = input;
  if (points.length === 0 || !isNum(realYield)) return undefined;

  const tail = points.slice(-TREND_QUARTERS);
  const trend = tail.reduce((sum, p) => sum + p.value, 0) / tail.length;
  const last = points[points.length - 1];

  const byTrend = trend - realYield;
  const byLatest = last.value - realYield;

  return {
    key: "prys",
    name: "생산성–실질금리 격차",
    value: byTrend,
    trend,
    latest: last.value,
    byTrend,
    byLatest,
    // ⚠ 부호가 갈리면 「마이너스다」라고 단정할 수 없다. 화면이 범위로 말한다.
    split: byTrend >= 0 !== byLatest >= 0,
    quartersUsed: tail.length,
    asOf: oldest([last.date, realYieldAsOf]),
    gapDays: gap([last.date, realYieldAsOf]),
    parts: [
      {
        label: `추세 생산성 증가율 (${tail.length}분기 평균)`,
        value: trend,
        unit: "%",
        asOf: last.date,
        sourceLabel: "미 노동통계국(BLS) · 비농업 시간당 산출",
        url: "https://www.bls.gov/productivity/",
      },
      {
        label: "실질 10년 금리",
        value: realYield,
        unit: "%",
        asOf: realYieldAsOf,
        sourceLabel: "미 재무부 실질 수익률 곡선 (TIPS)",
        url: "https://home.treasury.gov/policy-issues/financing-the-government/interest-rate-statistics",
      },
    ],
  };
}

/**
 * 성장–조달 격차.
 *
 * ⚠ **부채 지속가능성** 질문이다. 민간 투자 여력(`computePrys`)과 **다른 질문**이고,
 *   둘이 반대로 나올 수 있다. 같은 카드에 두면서 다른 질문이라고 적는 이유다.
 */
export function computeGrowthFunding(input: CapitalInput): Spread | undefined {
  const { nominalGrowth, nominalGrowthAsOf, nominalYield, nominalYieldAsOf } = input;
  if (!isNum(nominalGrowth) || !isNum(nominalYield)) return undefined;

  return {
    key: "growth_funding",
    name: "성장–조달 격차",
    value: nominalGrowth - nominalYield,
    asOf: oldest([nominalGrowthAsOf, nominalYieldAsOf]),
    gapDays: gap([nominalGrowthAsOf, nominalYieldAsOf]),
    parts: [
      {
        label: "명목 GDP 증가율 (전년비)",
        value: nominalGrowth,
        unit: "%",
        asOf: nominalGrowthAsOf,
        sourceLabel: "미 경제분석국(BEA)",
        url: "https://www.bea.gov/data/gdp/gross-domestic-product",
      },
      {
        label: "10년 국채 금리",
        value: nominalYield,
        unit: "%",
        asOf: nominalYieldAsOf,
        sourceLabel: "미 재무부 금리 통계",
        url: "https://home.treasury.gov/policy-issues/financing-the-government/interest-rate-statistics",
      },
    ],
  };
}

export function computeCapitalSpreads(input: CapitalInput): CapitalSpreads {
  return {
    prys: computePrys(input),
    growthFunding: computeGrowthFunding(input),
  };
}

/**
 * 두 격차를 함께 읽은 한 문장.
 *
 * ⚠ **둘이 엇갈릴 때 그것을 말하는 것이 이 함수의 존재 이유다.** 하나만 보고 「좋다/나쁘다」로
 *   뭉개면 이 화면을 만든 이유가 사라진다.
 */
export function capitalSentence(s: CapitalSpreads): string | undefined {
  const { prys, growthFunding: gf } = s;
  if (!prys && !gf) return undefined;

  const parts: string[] = [];

  if (prys) {
    const range = prys.split
      ? `${prys.byLatest >= 0 ? "+" : "−"}${Math.abs(prys.byLatest).toFixed(2)} ~ ${prys.byTrend >= 0 ? "+" : "−"}${Math.abs(prys.byTrend).toFixed(2)}%p로 부호가 갈립니다`
      : `${prys.byTrend >= 0 ? "+" : "−"}${Math.abs(prys.byTrend).toFixed(2)}%p입니다`;
    parts.push(
      `생산성이 버는 실질 수익률에서 실질 자금비용을 뺀 값은 ${range}` +
        (prys.byTrend >= 0
          ? " — 빌려서 투자할 값이 아직 남아 있습니다."
          : " — 실질 자금비용이 생산성 수익을 넘어섰습니다."),
    );
  }

  if (gf) {
    parts.push(
      `명목 성장률에서 10년 국채 금리를 뺀 값은 ${gf.value >= 0 ? "+" : "−"}${Math.abs(gf.value).toFixed(2)}%p로, ` +
        (gf.value >= 0 ? "경제가 이자보다 빨리 자랍니다." : "이자가 성장보다 빠릅니다."),
    );
  }

  // ⭐ 두 답이 엇갈리는 상태 — 이 화면이 잡아내려는 바로 그 모양이다.
  if (prys && gf && prys.byTrend < 0 && gf.value > 0) {
    parts.push(
      "⚠ 두 값이 엇갈립니다 — 정부 부채는 굴러가는데 민간 투자 쪽은 빡빡합니다. " +
        "「부채가 민간의 생산적 투자로 이어지는가」가 바로 이 자리에서 갈립니다.",
    );
  }

  return parts.join(" ");
}

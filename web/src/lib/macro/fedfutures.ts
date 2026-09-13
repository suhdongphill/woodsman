/**
 * 연방기금 선물(ZQ) 내재 정책금리 — 순수 계산.
 *
 * `fedhike.ts`는 **모형이 처방하는 것**(Taylor 준칙)을 낸다. 이 모듈은 **사람들이 거는 것**을
 * 낸다. 둘은 다른 숫자이고, 나란히 놓여야 의미가 생긴다(`docs/분석_막힌_지표_경로.md` §2).
 *
 * ## 식은 단순하다
 * 30일 연방기금 선물은 **계약월의 평균 실효금리(EFFR)**를 거래한다.
 *   `내재 평균금리(%) = 100 − 가격`
 * 96.14 → 3.86%. 즉 "그 한 달 평균이 3.86%가 될 것"에 돈이 걸려 있다.
 *
 * 계약월이 시작되기 **전에** 열리는 회의의 결과는 그 달 전체에 반영된다. 그래서
 * 계약월 안에 회의가 없다면 내재 평균금리는 곧 **그 회의들이 끝난 뒤의 금리**다.
 * 현재 금리와의 차이를 인상폭(25bp)으로 나누면 "인상 한 번" 기준의 비중이 된다.
 *
 * ## ⚠ 이 모듈이 하지 않는 것
 * - **CME 페드워치가 아니다.** 페드워치와 소수점이 다를 수 있고 그 차이를 우리가 설명할 수
 *   없다. 화면에는 「선물 내재(우리 계산)」이라고 적는다.
 *   ⚠ CME는 우리를 막아 두었다(2026-09-13 재확인: CmeWS **403** + "scraping은 이용약관 위반").
 *   그래서 원재료(Yahoo `ZQ=F`)에서 우리가 직접 계산하는 것 외에 길이 없다.
 * - **계약월 안의 회의는 결과를 모른다고 둔다.** 계약 하나로는 미지수가 둘(회의 전·후
 *   금리)인데 식이 하나뿐이다. 그래서 **계약월 안의 회의는 「변화 없음」으로 가정**하고,
 *   ⚠ 그 가정이 얼마나 큰지(그 회의가 차지하는 날수 비중)를 함께 돌려준다.
 *   숨기면 가정이 사실처럼 읽힌다.
 * - **확률이라고 단정하지 않는다.** `hikeShare`는 "인상 한 번(25bp)을 1로 봤을 때의 비중"이다.
 *   실제 확률분포는 0.25 단위 여러 갈래에 걸쳐 있고, 그 갈래를 계약 하나로 못 가른다.
 */

/** 정책금리 조정의 기본 단위(%p). */
export const STEP = 0.25;

/** `2026-10` 꼴. */
export type ContractMonth = string;

/**
 * Yahoo가 주는 이름표에서 계약월을 읽는다.
 *
 * ⚠ **Yahoo는 이름을 31자에서 자른다.** `30 Day Federal Funds Futures,Oc` — 월은
 *   **두 글자만** 남는다(2026-09-13 확인: chart·search 응답 모두 같고, `v7/finance/quote`는 401).
 *   그래서 이름표 하나만으로는 `Ma`(Mar/May)·`Ju`(Jun/Jul)를 가릴 수 없다.
 *
 * ⭐ 가를 수 있게 해 주는 것은 **근월물은 이번 달이나 다음 달**이라는 제약이다. 두 후보의
 *   앞 두 글자가 겹치는 달은 **6월(Jun/Jul)뿐**이고, 나머지 열한 달은 한 쪽으로만 붙는다.
 *
 * ⚠ 이름표가 두 후보 **어느 쪽에도** 안 붙으면 `undefined`를 낸다 — 그때는 우리가 모르는
 *   일이 생긴 것이다(Yahoo가 롤 시점을 바꿨거나 다른 상품을 주고 있다). 조용히 추측하는
 *   대신 수집이 실패로 남게 한다. `^MOVE`가 「그럴듯한 다른 상품」이었던 일과 같은 종류다.
 */
export function monthPrefix(month: number): string {
  return ["Ja", "Fe", "Ma", "Ap", "Ma", "Ju", "Ju", "Au", "Se", "Oc", "No", "De"][month - 1];
}

/**
 * 그 날짜의 **다음 달**. `2026-12-20` → `2027-01`.
 *
 * ⚠ 수집기가 「근월물 = 시세일의 다음 달」 불변식을 검사하는 데 쓴다
 *   (`features/macro/ingest.ts`의 `fetchFrontContract`). 읽는 쪽도 같은 함수로 계약월을
 *   되짚으므로 **여기 하나만 고치면 양쪽이 같이 움직인다.**
 */
export function nextMonthOf(date: string): ContractMonth {
  const m = /^(\d{4})-(\d{2})/.exec(date);
  if (!m) throw new Error(`날짜 형식이 아닙니다: ${date}`);
  const year = Number(m[1]);
  const month = Number(m[2]);
  return month === 12
    ? `${year + 1}-01`
    : `${year}-${String(month + 1).padStart(2, "0")}`;
}

export type FrontContract = {
  month: ContractMonth;
  /** 이름표가 두 후보에 다 붙어 달을 못 가렸는가. ⚠ 6월에만 생긴다. */
  ambiguous: boolean;
};

/**
 * 이름표 + 시세일로 근월물 계약월을 정한다.
 *
 * @param shortName Yahoo `meta.shortName`(잘린 이름표)
 * @param quoteDate 시세일 `YYYY-MM-DD` — ⚠ **받은 날이 아니라 값의 날짜**다.
 */
export function resolveFrontContract(
  shortName: string,
  quoteDate: string,
): FrontContract | undefined {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(quoteDate);
  if (!m) return undefined;

  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return undefined;

  const tag = shortName.split(",").pop()?.trim().slice(0, 2) ?? "";
  if (tag.length < 2) return undefined;

  const thisMonth = { year, month };
  const nextMonth = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };

  const hitsThis = monthPrefix(thisMonth.month) === tag;
  const hitsNext = monthPrefix(nextMonth.month) === tag;
  if (!hitsThis && !hitsNext) return undefined;

  // 겹치면(6월) 다음 달로 읽는다 — 관측된 Yahoo 동작이 그렇다(2026-09-13: 9/11 시세가 10월물).
  // ⚠ 다만 겹쳤다는 사실을 숨기지 않는다. 화면이 그 말을 해야 한다.
  const pick = hitsNext ? nextMonth : thisMonth;
  return {
    month: `${pick.year}-${String(pick.month).padStart(2, "0")}`,
    ambiguous: hitsThis && hitsNext,
  };
}

/** 그 달의 날수. */
export function daysInMonth(month: ContractMonth): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** 그 달 1일. */
function monthStart(month: ContractMonth): string {
  return `${month}-01`;
}

/**
 * 결정이 금리에 닿는 날 — **회의 다음 날**이다.
 *
 * ⚠ FOMC 결정은 발표일 장중에 나오지만 목표범위 변경은 **이튿날부터** 적용된다.
 *   이 하루를 빼먹으면 회의가 월말에 붙은 달에서 가중이 눈에 보이게 틀린다.
 */
export function effectiveDate(decisionDate: string): string {
  return new Date(Date.parse(`${decisionDate}T00:00:00.000Z`) + 86_400_000)
    .toISOString()
    .slice(0, 10);
}

export type FedFuturesInput = {
  /**
   * 계약월의 내재 평균 실효금리(%) = `100 − 가격`.
   *
   * ⚠ **여기서 가격을 금리로 바꾸지 않는다.** 그 변환은 표시 변환 `price100`
   *   (`lib/macro/series.ts`)이 이미 한다. 두 곳에서 바꾸면 한쪽만 고쳐졌을 때
   *   화면과 계산이 조용히 갈린다.
   */
  impliedAvg: number;
  /**
   * 계약월. ⚠ `FrontContract`를 그대로 받지 않는다 — 읽는 쪽은 계약월만 알고
   *   「이름표가 겹쳤는가」는 모른다. 모르는 것을 `false`로 단언하지 않기 위해 쪼갰다.
   */
  contractMonth: ContractMonth;
  /** 현재 실효금리(%) — ⚠ 없으면 계산하지 않는다 */
  currentRate?: number;
  /** FOMC 결정일 `YYYY-MM-DD` 목록. 순서는 상관없다 */
  meetings: string[];
  /** 시세일 — 지난 회의를 걸러내는 기준 */
  quoteDate: string;
};

export type FedFuturesResult = {
  /** 100 − 가격. 계약월의 내재 평균 실효금리(%) */
  impliedAvg: number;
  currentRate: number;
  contractMonth: ContractMonth;
  /** 계약월이 시작되기 전에 열려 이 계약에 **온전히 반영된** 회의들 */
  reflected: string[];
  /** 계약월 **안에** 열려 결과를 모른다고 둔 회의들 */
  assumedFlat: string[];
  /** 그 가정이 걸린 날수 비중(0~1). ⚠ 클수록 이 숫자를 믿지 말라는 뜻이다 */
  assumedWeight: number;
  /** 내재 누적 변화(%p) = impliedAvg − currentRate */
  impliedChange: number;
  /** 인상 한 번(25bp)을 1로 봤을 때의 비중. 음수면 인하 쪽 */
  hikeShare: number;
  /** `reflected`가 하나뿐인가 — 그때만 "그 회의의" 비중이라고 말할 수 있다 */
  singleMeeting: boolean;
};

/**
 * ⚠ 현재 금리가 없거나 계약월에 붙는 회의를 하나도 모르면 **계산하지 않는다.**
 *   회의 일정은 캘린더(`MacroEvent`)에서 온다 — 비어 있으면 「모른다」가 맞는 답이다.
 */
export function impliedFromFutures(input: FedFuturesInput): FedFuturesResult | undefined {
  const { impliedAvg, contractMonth, currentRate, meetings, quoteDate } = input;
  if (!Number.isFinite(impliedAvg) || currentRate === undefined || !Number.isFinite(currentRate)) {
    return undefined;
  }

  const start = monthStart(contractMonth);
  const days = daysInMonth(contractMonth);
  const end = `${contractMonth}-${String(days).padStart(2, "0")}`;

  // 아직 안 열린 회의만 본다. 지난 회의 결과는 이미 현재 금리에 들어 있다.
  const upcoming = meetings.filter((d) => d > quoteDate).sort();

  const reflected = upcoming.filter((d) => effectiveDate(d) <= start);
  const assumedFlat = upcoming.filter((d) => {
    const e = effectiveDate(d);
    return e > start && e <= end;
  });

  // ⚠ 이 계약에 붙는 회의가 하나도 없으면 낼 것이 없다 — 현재 금리를 되풀이할 뿐이다.
  if (reflected.length === 0 && assumedFlat.length === 0) return undefined;

  // 가정이 걸린 날수: 계약월 안 회의들 중 **가장 이른** 것이 적용되는 날부터 월말까지.
  let assumedWeight = 0;
  if (assumedFlat.length > 0) {
    const firstEffective = effectiveDate(assumedFlat[0]);
    const dayOfMonth = Number(firstEffective.slice(8, 10));
    assumedWeight = (days - dayOfMonth + 1) / days;
  }

  const impliedChange = impliedAvg - currentRate;

  return {
    impliedAvg,
    currentRate,
    contractMonth,
    reflected,
    assumedFlat,
    assumedWeight,
    impliedChange,
    hikeShare: impliedChange / STEP,
    singleMeeting: reflected.length === 1,
  };
}

/**
 * 한 문장 요약 — ⚠ 숫자와 **가정**을 같이 넣는다. 검색·AI가 이 문장만 떠 가도
 * 「우리 계산」이라는 사실과 한계가 함께 가야 한다(`docs/계획_AI친화_사이트_GEO.md`).
 */
export function fedFuturesSentence(r: FedFuturesResult): string {
  const dir = r.impliedChange >= 0 ? "인상" : "인하";
  const pct = `${(Math.abs(r.hikeShare) * 100).toFixed(0)}%`;
  const head =
    `${r.contractMonth} 연방기금 선물이 말하는 그 달 평균 실효금리는 ${r.impliedAvg.toFixed(3)}%로, ` +
    `현재 ${r.currentRate.toFixed(2)}%보다 ${r.impliedChange >= 0 ? "+" : ""}${r.impliedChange.toFixed(3)}%p ` +
    `${r.impliedChange >= 0 ? "높습니다" : "낮습니다"}.`;

  const attribution = r.singleMeeting
    ? ` ${r.reflected[0]} 회의에서 ${STEP * 100}bp ${dir} 한 번을 1로 보면 ${pct}에 해당합니다.`
    : r.reflected.length > 1
      ? ` 그 사이 회의 ${r.reflected.length}번(${r.reflected.join(" · ")})의 결과가 합쳐진 값이라, 회의 하나의 몫으로 나눌 수 없습니다.`
      : " 계약월 안의 회의만 걸려 있어 회의 하나의 몫으로 읽을 수 없습니다.";

  const caveat =
    r.assumedFlat.length > 0
      ? ` ⚠ 계약월 안의 ${r.assumedFlat.join(" · ")} 회의는 **변화 없음으로 가정**했고, 그 가정이 이 달의 ${(r.assumedWeight * 100).toFixed(0)}%에 걸려 있습니다.`
      : "";

  return `${head}${attribution}${caveat} CME 페드워치가 아니라 선물 가격에서 우리가 계산한 값입니다.`;
}

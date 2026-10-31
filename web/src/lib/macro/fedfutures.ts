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
 * - **계약월 안의 회의는 결과를 모른다고 둔다** — 단 하나의 예외(아래)를 빼고.
 *   계약 하나로는 미지수가 둘(회의 전·후 금리)인데 식이 하나뿐이다. 그래서 **계약월 안의
 *   회의는 「변화 없음」으로 가정**하고, ⚠ 그 가정이 얼마나 큰지(그 회의가 차지하는 날수
 *   비중)를 함께 돌려준다. 숨기면 가정이 사실처럼 읽힌다.
 *
 * ## ⭐ 예외 — 회의 전 금리를 아는 경우는 푼다 (2026-10-31)
 * 시세일과 계약월 사이에 회의가 **없고**, 계약월 안 회의가 **하나뿐**이면 회의 전 금리는
 * 지금 금리다. 그러면 미지수가 하나라 풀 수 있다(CME 페드워치와 같은 식):
 *   `평균 = (M/N)·지금 금리 + ((N−M)/N)·회의 뒤 금리`  (M = 회의 전 날수, N = 그 달 날수)
 * 볼트 `_scripts/fedwatch.py` `implied_path`가 8/11부터 쓰는 방식이다.
 * 왜 바꿨나: 「다음 달」 계약 안에 회의가 있는 기간(예: 11월 시세 → 12월물 · 12/9 회의)에
 * 카드가 그 회의를 「변화 없음」으로 둬서(날수의 71%) 다음 회의의 몫을 말하지 못했다
 * (CHANGELOG 2026-10-26 확인 절).
 * ⚠ 월말 회의(회의 뒤 날수 < `MIN_TAIL_DAYS`)는 풀지 않는다 — 분모가 작아 가격 잡음이
 *   몇 배로 불어난다. 볼트는 그때 익월 계약을 쓰지만 사이트는 계약을 하나만 저장하므로
 *   예전처럼 「변화 없음」 가정과 그 비중을 보인다.
 * - **확률이라고 단정하지 않는다.** `hikeShare`는 "인상 한 번(25bp)을 1로 봤을 때의 비중"이다.
 *   실제 확률분포는 0.25 단위 여러 갈래에 걸쳐 있고, 그 갈래를 계약 하나로 못 가른다.
 */

/** 정책금리 조정의 기본 단위(%p). */
export const STEP = 0.25;

/**
 * 계약월 안 회의를 풀 때 필요한 「회의 뒤 날수」의 최소값.
 * ⚠ 볼트 `fedwatch.py` `min_tail_days=5`와 같은 값이다 — 회의 뒤가 4일이면 가격 잡음이 31/4 ≈ 8배가 된다.
 */
export const MIN_TAIL_DAYS = 5;

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
 * ⚠ **2026-09-27부터 수집에서 쓰지 않는다** — 이름표와 가격이 다른 계약일 수 있음이 드러나 명시 계약 심볼로 바꿨다(`cmeContractSymbol`).
 *   판단 기록으로 남긴다(테스트 포함).
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

/**
 * ⭐ **계약월을 명시한 심볼**(2026-09-27). `ZQ` + CME 월 코드 + 연도 두 자리 + `.CBT` — 10월 2026 = `ZQV26.CBT`.
 *
 * ## 왜 별칭(`ZQ=F`)을 버렸나
 * `ZQ=F`는 한 계약이 아니라 Yahoo가 **여러 계약을 이어 붙인 계열**이었다(2026-09-27 실측):
 * - 9/23·9/24 값 96.255 = 9월물(`ZQU26`), 9/25 값 95.965 = 11월물(`ZQX26`) — 같은 계열 안에서 계약이 바뀌었다.
 * - 9/14~9/18에 저장된 값(96.25~96.26)은 이름표가 「…,Oc」(10월)였는데 **가격은 9월물**이었다.
 *   9/13 설계가 믿은 「이름표 = 가격의 계약」이 틀렸다 — 이름표만 보고 불변식을 세웠기 때문이다.
 * - 9/19부터는 이름표가 「…,No」(11월)가 되어 안전장치가 8일째 저장을 거부했다(자동 시스템 점검이 잡았다).
 * 계약월을 심볼에 박으면 「어느 계약인가」를 Yahoo의 롤 규칙에 맡기지 않아도 된다.
 */
const CME_MONTH_CODES = "FGHJKMNQUVXZ";

export function cmeContractSymbol(root: string, month: ContractMonth, exchange = "CBT"): string {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) throw new Error(`계약월 형식이 아닙니다: ${month}`);
  const mm = Number(m[2]);
  if (mm < 1 || mm > 12) throw new Error(`계약월 형식이 아닙니다: ${month}`);
  return `${root}${CME_MONTH_CODES[mm - 1]}${m[1].slice(2)}.${exchange}`;
}

/**
 * 받을 계약월 — 오늘 기준 다음 달, 그리고 **열흘 전 기준 다음 달**(달이 막 바뀐 날 06:00에는 마지막 시세가 아직 지난달이다).
 * 오름차순 · 중복 없음.
 */
export function contractMonthsToFetch(today: string): ContractMonth[] {
  const d = new Date(`${today}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`날짜 형식이 아닙니다: ${today}`);
  const earlier = new Date(d.getTime() - 10 * 86_400_000).toISOString().slice(0, 10);
  return [...new Set([nextMonthOf(earlier), nextMonthOf(today)])].sort();
}

/**
 * 한 계약의 시세 가운데 **「시세일의 다음 달 = 이 계약」인 날**만 남긴다 — 저장 불변식(`nextMonthOf`)을 지키는 자리.
 * 예: 10월물(`2026-10`)의 시세 중 9월 날짜만.
 */
export function pointsForContract<T extends { date: string }>(points: T[], month: ContractMonth): T[] {
  return points.filter((p) => nextMonthOf(p.date) === month);
}

/** 명시 심볼의 이름표가 그 달을 말하는가(두 글자). ⚠ 심볼과 이름표가 어긋나면 받은 것을 믿지 않는다. */
export function labelMatchesMonth(shortName: string, month: ContractMonth): boolean {
  const mm = Number(month.slice(5, 7));
  const tag = shortName.split(",").pop()?.trim().slice(0, 2) ?? "";
  return mm >= 1 && mm <= 12 && tag === monthPrefix(mm);
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
  /**
   * 계약월 안 회의를 날수 가중으로 푼 경우(⭐ 모듈 주석의 예외). 없으면 `undefined`.
   * ⚠ 이때 `reflected`·`assumedFlat`은 비어 있다 — 그 회의는 반영된 것도, 가정한 것도 아니고 **푼** 것이다.
   */
  solved?: {
    meeting: string;
    /** 회의 전 날수(지금 금리가 이어진다고 본 날) */
    daysBefore: number;
    /** 회의 뒤 날수 */
    daysAfter: number;
  };
  /**
   * 시장이 거는 **회의 뒤 금리**(%). 푼 경우는 그 값, 아니면 `impliedAvg`와 같다.
   * ⚠ 푼 값은 가격 잡음이 `N / daysAfter`배로 불어난 값이다 — 소수 셋째 자리를 믿지 않는다.
   */
  rateAfter: number;
  /** 내재 누적 변화(%p) = rateAfter − currentRate */
  impliedChange: number;
  /** 인상 한 번(25bp)을 1로 봤을 때의 비중. 음수면 인하 쪽 */
  hikeShare: number;
  /** 회의 하나의 몫인가 — `reflected`가 하나뿐이거나, 하나를 풀었을 때만 "그 회의의" 비중이라고 말할 수 있다 */
  singleMeeting: boolean;
  /** `singleMeeting`일 때 그 회의 */
  meeting?: string;
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
  let daysBefore = 0;
  if (assumedFlat.length > 0) {
    const firstEffective = effectiveDate(assumedFlat[0]);
    daysBefore = Number(firstEffective.slice(8, 10)) - 1;
    assumedWeight = (days - daysBefore) / days;
  }

  // ⭐ 회의 전 금리를 아는 경우(사이에 회의 없음 · 계약월 안 회의 하나 · 월말 아님)는 푼다.
  const daysAfter = days - daysBefore;
  if (reflected.length === 0 && assumedFlat.length === 1 && daysAfter >= MIN_TAIL_DAYS) {
    const rateAfter = (impliedAvg * days - daysBefore * currentRate) / daysAfter;
    const impliedChange = rateAfter - currentRate;
    return {
      impliedAvg,
      currentRate,
      contractMonth,
      reflected: [],
      assumedFlat: [],
      assumedWeight: 0,
      solved: { meeting: assumedFlat[0], daysBefore, daysAfter },
      rateAfter,
      impliedChange,
      hikeShare: impliedChange / STEP,
      singleMeeting: true,
      meeting: assumedFlat[0],
    };
  }

  const impliedChange = impliedAvg - currentRate;

  return {
    impliedAvg,
    currentRate,
    contractMonth,
    reflected,
    assumedFlat,
    assumedWeight,
    rateAfter: impliedAvg,
    impliedChange,
    hikeShare: impliedChange / STEP,
    singleMeeting: reflected.length === 1,
    meeting: reflected.length === 1 ? reflected[0] : undefined,
  };
}

/**
 * ⭐ 계산을 못 낸 **이유** (2026-10-31).
 *
 * 왜: `impliedFromFutures`가 `undefined`를 내는 경우가 넷인데 홈 카드는 전부 「시장 내재 값 **수집 전**」이라고 했다.
 * 10/29~31에는 10/30 시세(11월물)가 들어와 있었는데 11월물에 걸리는 회의가 없었을 뿐이다 — 「없음」과 「못 읽음」이
 * 같은 화면이 된 것이다(CLAUDE.md §3). 회의 직후 월말마다(회의가 없는 달의 계약을 받는 동안) 되풀이된다.
 */
export type FedFuturesGap =
  /** 선물 시세가 없다 — 정말 수집 전 */
  | { reason: "no-quote" }
  /** 시세는 있는데 일간 실효금리(DFF)가 없다 */
  | { reason: "no-rate"; contractMonth: ContractMonth; quoteDate: string }
  /** FOMC 일정이 비었다 — 캘린더를 못 읽었거나 비어 있다 */
  | { reason: "no-calendar"; contractMonth: ContractMonth; quoteDate: string }
  /** 다 있는데 이 계약에 걸리는 회의가 없다 — 다음 회의는 뒤 계약에 걸린다 */
  | {
      reason: "no-meeting";
      contractMonth: ContractMonth;
      quoteDate: string;
      impliedAvg: number;
      currentRate: number;
      nextMeeting?: string;
      /** 다음 회의가 걸리는 계약월(효력일의 달) */
      nextContract?: ContractMonth;
      /** 그 계약을 받기 시작하는 시세월 — 저장 불변식 「시세일의 다음 달」의 역 */
      readyFromMonth?: ContractMonth;
    };

function prevMonthOf(month: ContractMonth): ContractMonth {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

/**
 * `impliedFromFutures`가 아무것도 내지 않았을 때 **왜인지**. 이유를 아는 순서대로 본다.
 * ⚠ 결과가 있을 때 부르지 않는다 — 이 함수는 결과를 다시 계산하지 않는다.
 */
export function fedFuturesGap(input: Partial<FedFuturesInput> & { meetings: string[] }): FedFuturesGap {
  const { impliedAvg, contractMonth, currentRate, meetings, quoteDate } = input;
  if (impliedAvg === undefined || !Number.isFinite(impliedAvg) || !contractMonth || !quoteDate) {
    return { reason: "no-quote" };
  }
  if (currentRate === undefined || !Number.isFinite(currentRate)) {
    return { reason: "no-rate", contractMonth, quoteDate };
  }
  if (meetings.length === 0) return { reason: "no-calendar", contractMonth, quoteDate };

  const nextMeeting = meetings.filter((d) => d > quoteDate).sort()[0];
  const nextContract = nextMeeting ? effectiveDate(nextMeeting).slice(0, 7) : undefined;
  return {
    reason: "no-meeting",
    contractMonth,
    quoteDate,
    impliedAvg,
    currentRate,
    nextMeeting,
    nextContract,
    readyFromMonth: nextContract ? prevMonthOf(nextContract) : undefined,
  };
}

/**
 * 한 문장 요약 — ⚠ 숫자와 **가정**을 같이 넣는다. 검색·AI가 이 문장만 떠 가도
 * 「우리 계산」이라는 사실과 한계가 함께 가야 한다(`docs/계획_AI친화_사이트_GEO.md`).
 */
export function fedFuturesSentence(r: FedFuturesResult): string {
  const dir = r.impliedChange >= 0 ? "인상" : "인하";
  const pct = `${(Math.abs(r.hikeShare) * 100).toFixed(0)}%`;
  if (r.solved) {
    const s = r.solved;
    return (
      `${r.contractMonth} 연방기금 선물이 말하는 그 달 평균 실효금리는 ${r.impliedAvg.toFixed(3)}%입니다. ` +
      `${s.meeting} 회의 전 ${s.daysBefore}일을 현재 금리 ${r.currentRate.toFixed(2)}%로 두고 풀면 회의 뒤 금리는 ${r.rateAfter.toFixed(2)}%로, ` +
      `${STEP * 100}bp ${dir} 한 번을 1로 보면 ${pct}에 해당합니다. ` +
      `CME 페드워치가 아니라 선물 가격에서 우리가 계산한 값입니다.`
    );
  }
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

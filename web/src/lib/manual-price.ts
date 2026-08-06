/**
 * 수기(手記) 시세의 기준일 — 순수 계산.
 *
 * ## 왜 이 모듈이 필요한가
 * 대표 포트폴리오의 현재가는 **관리자가 손으로 넣는 값**이다. 실시세 연동은 아직 없다.
 * 그런데 화면에 숫자만 덩그러니 놓으면 읽는 사람은 **자동으로 갱신되는 시세**로 읽는다.
 * 계좌를 공개하는 사이트에서 그건 거짓말이 된다 — 모의 투자임을 밝히기로 한 것과 같은 선이다
 * (`data-mode.ts`, `/disclaimer`).
 *
 * 그래서 값이 아니라 **"언제 적은 값인가"**를 항상 같이 낸다. 오래된 값은 오래됐다고 말한다.
 *
 * ⚠ 여기서 "괜찮다/오래됐다"를 판단만 하고, 값을 지우거나 0으로 바꾸지 않는다.
 *    오래된 값도 정보다. 감추는 대신 날짜를 붙인다.
 */

/** 며칠이 지나면 "오래된 값"이라고 말할 것인가. 월 1회 기록 리듬에서 2주가 절반이다. */
export const STALE_AFTER_DAYS = 14;

export type ManualPriced = {
  /** 수기로 넣은 현재가 */
  price?: number;
  /** 그 값을 적은 기준일 (YYYY-MM-DD) */
  priceAsOf?: string;
  /** 보유 수량 — 수량이 있는데 시세가 없으면 평가액을 못 낸다 */
  shares?: number;
};

/** YYYY-MM-DD 두 날짜의 간격(일). 형식이 아니면 undefined. */
export function priceAgeDays(asOf: string | undefined, today: string): number | undefined {
  if (!asOf) return undefined;
  const from = Date.parse(`${asOf}T00:00:00.000Z`);
  const to = Date.parse(`${today}T00:00:00.000Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return undefined;
  return Math.round((to - from) / 86_400_000);
}

export type ManualPriceSummary = {
  /** 가장 오래된 기준일 — 화면은 이 날짜를 "…기준"으로 적는다 */
  asOf?: string;
  /** 그 날짜로부터 지난 일수 */
  ageDays?: number;
  /** 2주가 넘었나 */
  stale: boolean;
  /** 수량은 있는데 시세를 적지 않은 종목 수 — 이만큼 평가액이 비어 있다 */
  missing: number;
  /** 화면에 그대로 쓰는 한 문장 */
  note: string;
};

/**
 * 목록 전체의 시세 신선도.
 *
 * **가장 오래된** 기준일을 대표로 삼는다. 하나라도 낡았으면 합계도 낡은 것이라,
 * 최신 날짜를 보여주면 실제보다 최신인 것처럼 읽힌다.
 */
export function summarizeManualPrices(
  items: ManualPriced[],
  today: string,
): ManualPriceSummary {
  const priced = items.filter((i) => i.price != null);
  const missing = items.filter((i) => i.shares != null && i.price == null).length;

  const dates = priced.map((i) => i.priceAsOf).filter((d): d is string => !!d);
  const asOf = dates.length ? dates.slice().sort()[0] : undefined;
  const ageDays = priceAgeDays(asOf, today);
  const stale = ageDays != null && ageDays > STALE_AFTER_DAYS;

  return { asOf, ageDays, stale, missing, note: buildNote({ priced: priced.length, asOf, ageDays, stale, missing }) };
}

function buildNote(input: {
  priced: number;
  asOf?: string;
  ageDays?: number;
  stale: boolean;
  missing: number;
}): string {
  if (input.priced === 0) {
    return "현재가를 아직 적지 않았습니다. 평가액·비중은 계산되지 않습니다.";
  }

  // ⚠ "수기 입력"을 반드시 말한다. 자동 시세로 오해되면 안 된다.
  const base = input.asOf
    ? `현재가는 ${input.asOf} 기준으로 직접 입력한 값입니다(실시간 시세 아님).`
    : "현재가는 직접 입력한 값입니다(실시간 시세 아님). 기준일이 적혀 있지 않습니다.";

  const parts = [base];
  if (input.stale && input.ageDays != null) {
    parts.push(`마지막 갱신에서 ${input.ageDays}일 지났습니다.`);
  }
  if (input.missing > 0) {
    parts.push(`${input.missing}개 종목은 현재가가 없어 평가액에서 빠집니다.`);
  }
  return parts.join(" ");
}

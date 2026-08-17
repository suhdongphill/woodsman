/**
 * 시세 시계열의 한 점 — 순수 타입.
 *
 * ⚠ 거시(`macro/series.ts`)의 `SeriesPoint`와 모양이 비슷하지만 **일부러 나눈다.**
 *    거시는 값 하나(`value`)면 되지만 종목은 **거래량이 함께 와야** 거래량 배수를 낼 수 있다.
 *    한 타입으로 합치면 거시 쪽에 항상 비는 필드가 생긴다.
 */
export type QuotePoint = {
  /** YYYY-MM-DD (거래일) */
  date: string;
  /** 종가 */
  close: number;
  /** 거래량. ⚠ 없을 수 있다 — 없는 것과 0은 다르다 */
  volume?: number;
};

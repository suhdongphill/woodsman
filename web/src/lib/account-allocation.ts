/**
 * 계좌 전체 기준 배분 — 순수 함수 (2026-11-07 운영자 「계좌 전체 기준으로」).
 *
 * 목표(성장·인컴·방어·현금)는 현금을 포함한 계좌 기준인데, 현재 비중은 공개 종목만의 합으로 계산해 비교가 어긋났다.
 * 볼트가 계좌 전체로 계산한 **비율만** `AccountAllocation`에 싣고, 화면은 그 값을 쓴다.
 *
 * ⚠ 금액을 받지 않는다. 비율 넷과 기준일뿐이다.
 * ⚠ 합이 100에서 벗어나면 믿지 않는다(`null`). 못 읽으면 화면이 공개 종목 기준이라고 밝힌다 — 조용히 섞지 않는다.
 */
import { holdingWeightsPct, type AllocationRow } from "./allocation";
import { sortBuckets, type PortfolioBucket } from "./bucket-target";

export type AccountAllocation = {
  asOf: string;
  growthPct: number;
  incomePct: number;
  defensePct: number;
  cashPct: number;
};

/** 표시용 현금 자리의 키 — 관리자가 만드는 버킷이 아니다. */
export const CASH_ROW_KEY = "CASH";

const round1 = (v: number) => Math.round(v * 10) / 10;

export function validAccountAllocation(a: AccountAllocation | null | undefined): AccountAllocation | null {
  if (!a) return null;
  const values = [a.growthPct, a.incomePct, a.defensePct, a.cashPct];
  if (!values.every((v) => Number.isFinite(v) && v >= 0 && v <= 100)) return null;
  const sum = values.reduce((s, v) => s + v, 0);
  return Math.abs(sum - 100) <= 0.5 ? a : null;
}

/**
 * 계좌 기준 행. 기본 세 버킷만 볼트 값과 잇는다.
 * ⚠ 관리자가 더 만든 버킷은 볼트 값이 없다 — 0으로 지어내지 않도록 그런 구성이면 `null`을 돌려 공개 종목 기준으로 돌아간다.
 */
export function accountAllocationRows(buckets: PortfolioBucket[], a: AccountAllocation, cashTarget: number): AllocationRow[] | null {
  const current: Record<string, number> = { GROWTH: a.growthPct, INCOME: a.incomePct, DEFENSE: a.defensePct };
  const sorted = sortBuckets(buckets);
  if (sorted.some((b) => !(b.key in current))) return null;
  const row = (functionType: string, target: number, value: number): AllocationRow => ({
    functionType,
    targetPct: round1(target),
    currentPct: round1(value),
    gapPct: round1(round1(value) - round1(target)),
  });
  return [...sorted.map((b) => row(b.key, b.targetPct || 0, current[b.key])), row(CASH_ROW_KEY, cashTarget, a.cashPct)];
}

/**
 * 종목별 계좌 비중(%) · 공개 종목이 계좌에서 차지하는 비중.
 * 보유 전체(비공개 포함)로 주식 안의 비중을 낸 뒤 (100 − 현금)을 곱한다. ⚠ 결과에 금액이 없다.
 */
export function accountHoldingWeights(
  held: { id: string; shares?: number; price?: number; currency?: "KRW" | "USD" }[],
  publishedIds: Set<string>,
  usdKrwRate: number,
  cashPct: number,
): { weights: Map<string, number>; publishedPct: number } {
  const inStocks = holdingWeightsPct(held, usdKrwRate);
  const weights = new Map<string, number>();
  let publishedPct = 0;
  for (const [id, w] of inStocks) {
    if (!publishedIds.has(id)) continue;
    const accountW = (w * (100 - cashPct)) / 100;
    weights.set(id, accountW);
    publishedPct += accountW;
  }
  return { weights, publishedPct: round1(publishedPct) };
}

/**
 * 목표 비중 대비 현재 비중 — 순수 계산.
 *
 * ## 왜 이 화면이 필요한가
 * 포트폴리오는 하루에 완성되지 않는다. 목표 배분을 정해 두고 **매달 넣는 돈으로 조금씩
 * 채워 가는 것**이 실제 모습이다. 그런데 화면이 목표 비중만 보여주면 마치 이미 그렇게
 * 굴리고 있는 것처럼 읽힌다 — 사실과 다르고, 나중에 실제 기록을 올렸을 때 신뢰를 잃는다.
 *
 * 그래서 **목표와 현재를 나란히** 보여주고, 얼마나 채웠는지(구성 완료율)를 함께 낸다.
 *
 * ⚠ "무엇을 얼마나 사라"는 계산은 하지 않는다. 이 사이트는 매매를 권유하지 않는다
 * (`/disclaimer`, `src/lib/ai/persona.ts`의 공통 규범과 같은 선).
 * 여기서 내는 것은 **차이(gap)**까지다. 그 차이를 어떻게 메울지는 사람이 정한다.
 */
import type { FunctionType } from "./types";

export type AllocationInput = {
  /** 기능 분류 */
  functionType: FunctionType;
  /** 목표 비중(%) */
  targetWeight?: number;
  /**
   * 현재 평가액 — **원화 기준으로 환산된 값**이어야 한다.
   * ⚠ 달러 종목을 환산 없이 넣으면 원화 종목에 파묻혀 비중이 통째로 틀린다.
   *    `holdingValueKrw()`를 거쳐서 넣을 것.
   */
  marketValue?: number;
};

/**
 * 보유 종목의 평가액을 **원화로** 환산한다.
 *
 * ⚠ 2026-08-02에 이걸 빼먹어서 성장 버킷이 0.1%로 표시됐다(달러 종목의 숫자가
 *    원화 종목보다 세 자릿수 작아서 반올림에 묻혔다). 통화가 섞인 계좌에서
 *    환산 없는 합계는 **항상** 틀린 값이다.
 */
export function holdingValueKrw(
  holding: { shares?: number; price?: number; currency?: "KRW" | "USD" },
  usdKrwRate: number,
): number | undefined {
  if (holding.shares == null || holding.price == null) return undefined;
  const raw = holding.shares * holding.price;
  return holding.currency === "USD" ? raw * usdKrwRate : raw;
}

export type AllocationRow = {
  functionType: FunctionType;
  targetPct: number;
  currentPct: number;
  /** 현재 − 목표. 양수면 과다, 음수면 미달 */
  gapPct: number;
};

const FUNCTIONS: FunctionType[] = ["GROWTH", "INCOME", "DEFENSE"];

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** 총 평가액. 값이 없는 종목은 0으로 본다. */
export function totalValue(items: AllocationInput[]): number {
  return items.reduce((sum, i) => sum + (i.marketValue ?? 0), 0);
}

/**
 * 기능별 목표·현재 비중.
 *
 * 평가액이 하나도 없으면 현재 비중은 전부 0이다 — **목표 비중을 현재인 것처럼
 * 되돌리지 않는다.** 그게 "이미 그렇게 굴리는 중"으로 보이게 만드는 지점이었다.
 */
export function summarizeAllocation(items: AllocationInput[]): AllocationRow[] {
  const total = totalValue(items);

  return FUNCTIONS.map((functionType) => {
    const inBucket = items.filter((i) => i.functionType === functionType);
    const targetPct = round1(inBucket.reduce((sum, i) => sum + (i.targetWeight ?? 0), 0));
    const currentPct =
      total > 0
        ? round1((inBucket.reduce((sum, i) => sum + (i.marketValue ?? 0), 0) / total) * 100)
        : 0;

    return { functionType, targetPct, currentPct, gapPct: round1(currentPct - targetPct) };
  });
}

/**
 * 구성 완료율(0~100).
 *
 * 목표 배분과 현재 배분이 얼마나 겹치는지다. 겹치는 부분의 합이 곧 완료율이 된다
 * (각 버킷에서 `min(목표, 현재)`를 더한 값). 아직 아무것도 없으면 0, 완전히 맞으면 100.
 *
 * 총 목표가 100%가 아니어도(작성 중이라 그럴 수 있다) 목표 합계 기준으로 환산한다.
 */
export function fillProgressPct(rows: AllocationRow[]): number {
  const targetSum = rows.reduce((sum, r) => sum + r.targetPct, 0);
  if (targetSum <= 0) return 0;

  const overlap = rows.reduce((sum, r) => sum + Math.min(r.targetPct, r.currentPct), 0);
  return round1((overlap / targetSum) * 100);
}

/** 아직 채우지 못한 버킷 — 큰 것부터. 화면에서 "다음에 채울 자리"로 보여준다. */
export function underweightBuckets(rows: AllocationRow[]): AllocationRow[] {
  return rows.filter((r) => r.gapPct < 0).sort((a, b) => a.gapPct - b.gapPct);
}

/** 목표 합계가 100%인지 — 관리자 화면에서 경고를 띄운다. */
export function targetSumPct(rows: AllocationRow[]): number {
  return round1(rows.reduce((sum, r) => sum + r.targetPct, 0));
}

/** 종목 목록의 목표 비중 합계. 버킷으로 묶기 전에 바로 쓴다(관리자 편집 화면). */
export function sumTargetWeights(items: { targetWeight?: number }[]): number {
  return round1(items.reduce((sum, i) => sum + (i.targetWeight ?? 0), 0));
}

/**
 * 목표 비중 합계에 대한 경고 문구. 맞으면 null.
 *
 * ⚠ **저장을 막지 않는다.** 종목을 하나씩 넣는 중에는 합계가 100%가 아닌 게 정상이다.
 *    막아 버리면 중간 저장을 못 해 작업이 통째로 날아간다. 말해 주기만 한다.
 */
export function targetSumWarning(sumPct: number): string | null {
  const diff = round1(sumPct - 100);
  if (diff === 0) return null;
  return diff > 0
    ? `목표 비중 합계가 ${sumPct}%로 ${diff}%p 넘칩니다. 작성 중이면 그대로 두어도 됩니다.`
    : `목표 비중 합계가 ${sumPct}%로 ${Math.abs(diff)}%p 모자랍니다. 작성 중이면 그대로 두어도 됩니다.`;
}

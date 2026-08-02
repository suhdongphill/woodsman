/**
 * 계좌 성과 계산 — 순수 함수.
 *
 * 운용자의 계좌를 공개하는 콘텐츠의 근간이라 숫자가 틀리면 신뢰가 통째로 무너진다.
 * 그래서 화면과 분리해 두고 `performance.test.ts`로 고정한다.
 *
 * 원칙: **납입원금 기준**으로만 수익률을 말한다.
 * 시간가중수익률(TWR)처럼 입금 시점을 지워버리는 지표는 쓰지 않는다 —
 * "내가 넣은 돈이 얼마가 됐나"가 이 사이트가 답하려는 질문이기 때문이다.
 */
import type { AccountSnapshot } from "./types";

export type PerformanceSummary = {
  /** 최신 스냅샷 기준 납입원금 누계 */
  principal: number;
  /** 최신 평가액 */
  value: number;
  /** 누적 배당·이자 */
  income: number;
  /** 평가손익 = 평가액 − 원금 */
  profit: number;
  /** 원금 대비 수익률(%) */
  returnPct: number;
  /** 기록된 개월 수 */
  months: number;
  /** 원금 대비 가장 깊게 내려갔던 지점 (없으면 null) */
  worst: { date: string; pct: number } | null;
  /** 평가액이 원금을 밑돌았던 개월 수 */
  underwaterMonths: number;
  /** 기준일 (최신 스냅샷 날짜) */
  asOf: string;
};

/** 스냅샷 한 점의 원금 대비 손익률(%) */
export function returnPctAt(s: AccountSnapshot): number {
  if (s.principal <= 0) return 0;
  return ((s.value - s.principal) / s.principal) * 100;
}

/** 날짜 오름차순으로 정렬한 사본 (입력을 건드리지 않는다) */
export function sortByDate(snapshots: AccountSnapshot[]): AccountSnapshot[] {
  return [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
}

export function summarizePerformance(
  snapshots: AccountSnapshot[],
): PerformanceSummary | null {
  const rows = sortByDate(snapshots);
  const last = rows.at(-1);
  if (!last) return null;

  let worst: { date: string; pct: number } | null = null;
  let underwaterMonths = 0;
  for (const s of rows) {
    const pct = returnPctAt(s);
    if (pct < 0) underwaterMonths++;
    if (!worst || pct < worst.pct) worst = { date: s.date, pct };
  }
  // 한 번도 원금을 밑돈 적이 없으면 '최악 구간'을 말하지 않는다(있는 척하지 않는다).
  if (worst && worst.pct >= 0) worst = null;

  return {
    principal: last.principal,
    value: last.value,
    income: last.income,
    profit: last.value - last.principal,
    returnPct: returnPctAt(last),
    months: rows.length,
    worst,
    underwaterMonths,
    asOf: last.date,
  };
}

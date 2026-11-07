/**
 * 섹터 ETF 설정·환매 유입 — 관리자 화면 표. 순수 함수 (2026-11-07).
 *
 * 자료: 볼트 `record-rotation-watch.py`가 State Street 펀드 파일로 계산해 `SectorEtfFlow`에 싣는다.
 * 유입률 = 그 달 Δ설정주식수 × NAV 합 ÷ 달 초 순자산.
 *
 * ⚠ **공개 화면에 내지 않는다.** 원자료 화면에 「복제·제3자 공개 금지」 문구가 있다. 운영자 동의 확인 전까지 관리자 전용이다.
 * ⚠ **발굴 신호로 쓰지 않는다.** 2016~2026 검증에서 3개월 유입 상위−하위의 다음 3개월 차이는 −0.23%p(t −0.44)였다
 *    (`docs/연구_주도주_비AI확장_ETF자금유입_2026-11-07.md`). 돈이 어디로 움직이는지 **보는** 표다.
 * ⚠ 값이 모자라면 0으로 만들지 않고 `null`이다.
 */
export type SectorFlowRow = { month: string; ticker: string; name: string; flowPct: number };

export type SectorFlowView = {
  ticker: string;
  name: string;
  m1: number | null;
  m3: number | null;
  m12: number | null;
  /** 3개월 합 유입률 순위(1이 최대) */
  rank: number | null;
  /** 3개월 전의 같은 순위 */
  rankThen: number | null;
};

function sumLast(values: Map<string, number>, months: string[], end: number, n: number): number | null {
  if (end - n + 1 < 0) return null;
  let sum = 0;
  for (let i = end - n + 1; i <= end; i += 1) {
    const v = values.get(months[i]);
    if (v === undefined || !Number.isFinite(v)) return null;
    sum += v;
  }
  return sum;
}

function ranks(entries: { ticker: string; value: number | null }[]): Map<string, number> {
  const known = entries.filter((e): e is { ticker: string; value: number } => e.value !== null);
  known.sort((a, b) => b.value - a.value);
  return new Map(known.map((e, i) => [e.ticker, i + 1]));
}

/** @returns 표와 기준 달. 자료가 없으면 빈 표. */
export function buildSectorFlowView(rows: SectorFlowRow[]): { asOf: string | null; items: SectorFlowView[] } {
  const months = [...new Set(rows.map((r) => r.month))].sort();
  if (months.length === 0) return { asOf: null, items: [] };
  const end = months.length - 1;

  const byTicker = new Map<string, { name: string; values: Map<string, number> }>();
  for (const r of rows) {
    const entry = byTicker.get(r.ticker) ?? { name: r.name, values: new Map<string, number>() };
    entry.values.set(r.month, r.flowPct);
    byTicker.set(r.ticker, entry);
  }

  const tickers = [...byTicker.entries()];
  const now = ranks(tickers.map(([ticker, e]) => ({ ticker, value: sumLast(e.values, months, end, 3) })));
  const then = ranks(tickers.map(([ticker, e]) => ({ ticker, value: sumLast(e.values, months, end - 3, 3) })));

  const items = tickers.map(([ticker, e]) => ({
    ticker,
    name: e.name,
    m1: sumLast(e.values, months, end, 1),
    m3: sumLast(e.values, months, end, 3),
    m12: sumLast(e.values, months, end, 12),
    rank: now.get(ticker) ?? null,
    rankThen: then.get(ticker) ?? null,
  }));
  items.sort((a, b) => (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER));
  return { asOf: months[end], items };
}

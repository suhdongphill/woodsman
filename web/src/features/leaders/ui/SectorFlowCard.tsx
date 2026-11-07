import { Card, CardTitle } from "@/components/ui/Card";
import type { SectorFlowView } from "@/lib/sector-flow";

const pct = (v: number | null) => (v === null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`);

function move(rank: number | null, then: number | null): string {
  if (rank === null || then === null) return "—";
  if (rank === then) return "=";
  return rank < then ? `▲${then - rank}` : `▼${rank - then}`;
}

/** 섹터 ETF 유입 — ⚠ 관리자 화면 전용. 공개 화면에 넣지 않는다(`lib/sector-flow.ts`). */
export function SectorFlowCard({ asOf, items, failed }: { asOf: string | null; items: SectorFlowView[]; failed: boolean }) {
  return (
    <Card className="mb-6">
      <CardTitle>섹터 ETF 자금 유입 · 운영자 전용</CardTitle>
      {failed ? (
        <p className="mt-3 text-[13px] text-red-400">유입 자료를 불러오지 못했습니다.</p>
      ) : items.length === 0 ? (
        <p className="mt-3 text-[13px] text-muted">아직 실린 자료가 없습니다. PC의 일일 수집이 처음 돌면 채워집니다.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-[11px] text-muted">
                <th className="py-1.5 pr-3 font-normal">섹터 ({asOf} 기준)</th>
                <th className="py-1.5 pr-3 text-right font-normal">1개월</th>
                <th className="py-1.5 pr-3 text-right font-normal">3개월</th>
                <th className="py-1.5 pr-3 text-right font-normal">12개월</th>
                <th className="py-1.5 text-right font-normal">3개월 순위 변화</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.ticker} className="border-t border-border/60">
                  <td className="py-1.5 pr-3 text-ink">
                    {s.name} <span className="font-mono text-[11px] text-ink-3">{s.ticker}</span>
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-muted">{pct(s.m1)}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-ink">{pct(s.m3)}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-muted">{pct(s.m12)}</td>
                  <td className="py-1.5 text-right tabular-nums text-ink">{move(s.rank, s.rankThen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-[11.5px] leading-relaxed text-ink-3">
        순자산 대비 유입률입니다(설정주식수 변화 × NAV · State Street 섹터 ETF 11종). 돈이 어디로 움직이는지 보는 표이고, 주도주 판정이 아닙니다 —
        2016~2026 검증에서 유입 상위 섹터가 이후 더 오르지 않았습니다. 원자료의 공개 금지 문구 때문에 공개 화면에는 싣지 않습니다.
      </p>
    </Card>
  );
}

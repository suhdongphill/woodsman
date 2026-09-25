import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { StatBar } from "@/components/ui/StatBar";
import type { MixClass, VerdictMix } from "@/lib/verdict-mix";

/**
 * 관리자 운영 화면 — 운영 포트폴리오 **전체**(공개 여부 무관)가 주도주 칸 안에 있나 밖에 있나(2026-09-25).
 * 볼트 「내 포트폴리오」의 첫 막대를 옮겼다. 순서·색은 안(초록) → 경계(파랑) → 밖(주황·회색) → 모름(옅은 회색).
 */
const CLASS_COLOR: Record<MixClass, string> = {
  leader: "var(--w-series-1)",
  candidate: "var(--w-series-3)",
  watch: "var(--w-series-2)",
  out: "var(--w-flat)",
  unknown: "var(--w-border)",
  none: "var(--w-surface-2)",
};

export function VerdictMixCard({ mix, verdictAsOf }: { mix: VerdictMix; verdictAsOf?: string }) {
  if (mix.valued === 0) return null;
  const noTags = mix.byClass.length === 1 && mix.byClass[0].key === "none";
  return (
    <Card className="mb-5">
      <CardTitle
        action={
          <Badge tone="neutral">{verdictAsOf ? `판정 ${verdictAsOf}` : "판정일 없음"}</Badge>
        }
      >
        주도주 칸 안/밖 — 운영 포트폴리오 전체
      </CardTitle>

      {noTags ? (
        <p className="rounded-lg border border-dashed border-border bg-bg px-3 py-4 text-center text-[12px] text-gray-500">
          아직 판정 태그가 없습니다. 볼트에서 <code>export-portal-portfolio.py</code> → <code>apply-portfolio.ps1</code>로 적재하면 채워집니다.
        </p>
      ) : (
        <>
          <dl className="mb-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-bg py-2.5">
              <dt className="text-[10px] text-gray-500">주도주 칸 안</dt>
              <dd className="mt-0.5 text-[15px] font-bold tabular-nums text-ink">{mix.insidePct}%</dd>
            </div>
            <div className="rounded-lg bg-bg py-2.5">
              <dt className="text-[10px] text-gray-500">그중 ★ 이상</dt>
              <dd className="mt-0.5 text-[15px] font-bold tabular-nums text-ink">{mix.starPct}%</dd>
            </div>
            <div className="rounded-lg bg-bg py-2.5">
              <dt className="text-[10px] text-gray-500">밖 (추격 주의·제외)</dt>
              <dd className="mt-0.5 text-[15px] font-bold tabular-nums text-ink">{mix.outsidePct}%</dd>
            </div>
          </dl>

          <StatBar
            height="h-3"
            segments={mix.byClass.map((r) => ({
              label: `${r.label} ${r.pct}% · ${r.count}종목`,
              value: r.pct,
              color: CLASS_COLOR[r.key],
            }))}
          />

          <h4 className="mb-2 mt-5 text-[12px] font-semibold text-gray-400">레이어별 비중</h4>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {mix.byLayer.map((r) => (
              <li key={r.key} className="flex items-center gap-2 text-[12.5px]">
                <span className="w-28 shrink-0 truncate text-gray-300">{r.label}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-bg">
                  <span className="block h-full rounded-full bg-gold-500/60" style={{ width: `${r.pct}%` }} />
                </span>
                <span className="w-20 shrink-0 text-right tabular-nums text-gray-400">
                  {r.pct}% · {r.count}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="mt-3 text-[11px] text-gray-500">
        원화 환산 종목 평가액 기준(현금 제외), 공개 여부와 무관하게 전체.
        {mix.unvalued > 0 && ` 수량·현재가가 없는 ${mix.unvalued}종목은 빠졌습니다.`}
      </p>
    </Card>
  );
}

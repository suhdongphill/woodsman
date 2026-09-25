import { Card, SectionHeader } from "@/components/ui/Card";
import type { Change } from "@/lib/leaders/view";
import { LeaderBadge } from "./LeaderBadge";

/**
 * 이번 주 판정 변화 — 볼트 화면에 없던, 포털이 더한 것(2026-09-25).
 * 판정표는 매주 같은 모양이라 **무엇이 바뀌었나**가 다시 올 이유가 된다. 새 주도주 → 탈락 → 그 밖의 이동 순서.
 * ⚠ 지난 실행이 없으면 「비교할 실행이 아직 없다」고 말한다 — 빈 목록을 「변화 없음」으로 보이게 하지 않는다.
 */
export function LeaderChanges({ changes, prevRunId }: { changes: Change[]; prevRunId?: string }) {
  return (
    <section>
      <SectionHeader
        title="지난 판정과 달라진 것"
        subtitle={prevRunId ? `${prevRunId} 판정과 비교했습니다. 같은 레이어 안의 같은 종목끼리만 비교합니다.` : undefined}
      />
      <Card>
        {!prevRunId ? (
          <p className="text-[13px] text-muted">
            비교할 지난 판정이 아직 없습니다. 다음 주 판정부터 무엇이 주도주 칸에 들어오고 나갔는지 여기에 쌓입니다.
          </p>
        ) : changes.length === 0 ? (
          <p className="text-[13px] text-muted">지난 판정과 달라진 종목이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-border">
            {changes.map((c) => (
              <li key={`${c.group}-${c.ticker}`} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5 text-[13px]">
                <span className="min-w-[8rem] font-semibold text-ink">
                  {c.name}
                  <span className="ml-1.5 font-mono text-[11px] font-normal text-gray-500">{c.ticker}</span>
                </span>
                <span className="text-[11.5px] text-gray-500">{c.group}</span>
                <span className="ml-auto flex items-center gap-1.5">
                  <LeaderBadge cls={c.from} />
                  <span className="text-gray-500">→</span>
                  <LeaderBadge cls={c.to} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}

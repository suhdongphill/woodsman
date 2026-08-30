import Link from "next/link";
import { Card, SectionHeader } from "@/components/ui/Card";
import { ChevronRightIcon } from "@/components/icons";
import { DataModeNotice } from "@/components/ui/DataModeNotice";
import { CapitalFlowChart } from "@/features/portfolio/ui/CapitalFlowChart";
import type { AccountSnapshot, Rebalance } from "@/lib/types";
import type { DataMode } from "@/lib/data-mode";

/**
 * 넣은 돈과 불어난 돈.
 *
 * ⚠ 이 블록은 **스냅숏이 있을 때만** 그린다(`lib/home-layout.ts`가 정한다).
 * ⚠ Step 2에서 `/portfolio`로 옮긴다 — 거기에 이미 같은 차트가 있다.
 */
export function CapitalFlowSection({
  snapshots,
  rebalances,
  dataMode,
}: {
  snapshots: AccountSnapshot[];
  rebalances: Rebalance[];
  dataMode: DataMode;
}) {
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6 py-14">
      {/* ⚠ 계좌 숫자가 나오는 자리에는 모의/실계좌를 반드시 밝힌다 */}
      <DataModeNotice mode={dataMode} className="mb-5" compact />

      <SectionHeader
        title="넣은 돈과 불어난 돈"
        subtitle="매달 납입한 원금 위로 평가액이 얼마나 떠 있는지 — 벌어진 폭이 곧 성과입니다."
        action={
          <Link
            href="/portfolio"
            className="text-xs text-gold-400 hover:text-gold-500 flex items-center gap-0.5 shrink-0"
          >
            자세히
            <ChevronRightIcon size={13} />
          </Link>
        }
      />
      <Card>
        <CapitalFlowChart
          snapshots={snapshots}
          rebalances={rebalances.map((r) => ({ date: r.date, memo: r.memo }))}
        />
      </Card>
    </section>
  );
}

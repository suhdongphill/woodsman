import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { seoulDay, seoulTime } from "@/lib/kst";
import { elapsedText, type FreshnessState, type ModelFreshnessRow } from "@/lib/model-freshness";
import { QuickIngestButton } from "@/features/macro/ui/QuickIngestButton";

/**
 * 관리자 대시보드 맨 위 — 모델의 최신성.
 *
 * ⚠ 정상일 때도 줄을 모두 보여 준다. 늦을 때만 뜨는 경고는, 경고 자체가 고장 났을 때 아무도 모른다.
 * ⚠ 늦거나 없으면 **그 줄에서 바로** 할 일을 누를 수 있게 한다(자동이 안 돌았으면 수동 수집).
 */
const STATE_LABEL: Record<FreshnessState, string> = { ok: "정상", late: "늦음", missing: "없음" };
const STATE_TONE: Record<FreshnessState, "emerald" | "warn" | "danger"> = { ok: "emerald", late: "warn", missing: "danger" };

function when(at: string): string {
  // 날짜만 있는 관측일은 날짜로, 시각이 있으면 KST 시각까지
  return /^\d{4}-\d{2}-\d{2}$/.test(at) ? `${at} 관측` : `${seoulDay(at)} ${seoulTime(at)}`;
}

export function ModelFreshnessCard({ rows, now }: { rows: ModelFreshnessRow[]; now: Date }) {
  const bad = rows.filter((r) => r.state !== "ok");
  const needsIngest = rows.some((r) => r.state !== "ok" && r.action === "ingest");
  return (
    <Card className="mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>모델 최신성</CardTitle>
        <span className={bad.length ? "text-[12px] text-gold-500" : "text-[12px] text-emerald-400"}>
          {bad.length ? `⚠ 확인할 것 ${bad.length}개` : "모두 제때 갱신됐습니다"}
        </span>
      </div>
      {needsIngest && (
        <div className="mt-3 rounded-xl border border-gold-600/40 bg-gold-500/[0.05] p-3">
          <p className="mb-2 text-[12.5px] text-ink">자동 수집이 제때 돌지 않았거나 값이 비었습니다. 지금 수동으로 돌리면 점수도 따라 계산됩니다.</p>
          <QuickIngestButton />
        </div>
      )}
      <ul className="mt-3 divide-y divide-border/60">
        {rows.map((r) => (
          <li key={r.key} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2 text-[12.5px]">
            <Badge tone={STATE_TONE[r.state]}>{STATE_LABEL[r.state]}</Badge>
            <span className="min-w-[10rem] font-medium text-ink">{r.label}</span>
            <span className="text-muted">
              {r.lastAt ? `${when(r.lastAt)} · ${elapsedText(r.lastAt, now)}` : "기록 없음"}
            </span>
            <span className="basis-full text-[11.5px] text-ink-3 sm:basis-auto">{r.reason}</span>
            {r.state !== "ok" && r.action === "macro" && (
              <Link href="/admin/macro" className="text-[12px] text-gold-500 hover:text-gold-400">
                거시 지표 화면 →
              </Link>
            )}
            {r.state !== "ok" && r.action === "bubble" && (
              <Link href="/admin/bubble" className="text-[12px] text-gold-500 hover:text-gold-400">
                버블 채점 화면 →
              </Link>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

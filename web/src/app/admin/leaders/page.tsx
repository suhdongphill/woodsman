import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader, AdminShell } from "@/components/layout/AdminPageHeader";
import { Card, CardTitle } from "@/components/ui/Card";
import { requireAdmin } from "@/lib/session";
import { loadLeaderRuns } from "@/features/leaders/repository";
import { loadRefreshRequests } from "@/features/leaders/refresh-repo";
import { requestLeaderRefreshAction } from "@/features/leaders/refresh-actions";
import { LEADER_STALE_DAYS, leaderAgeDays, refreshView, type RefreshStatus } from "@/lib/leaders/refresh";

export const metadata: Metadata = { title: "주도주 최신화" };
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<RefreshStatus, string> = {
  REQUESTED: "대기",
  RUNNING: "실행 중",
  DONE: "완료",
  FAILED: "실패",
};

const seoul = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "short", timeStyle: "short" }) : "—";

/** 주도주 판정이 언제 것인지 보고, 다시 계산을 요청한다. 계산은 운영자 PC에서 돈다(`lib/leaders/refresh.ts`). */
export default async function AdminLeadersPage() {
  await requireAdmin("/admin/leaders");
  const [runs, requests] = await Promise.all([loadLeaderRuns(1), loadRefreshRequests(5)]);
  const now = new Date();
  const collectedAt = runs[0]?.collectedAt;
  const age = leaderAgeDays(collectedAt, now);
  const view = refreshView(requests[0], now);
  const toneClass = view.tone === "warn" ? "text-gold-500" : "text-muted";

  return (
    <AdminShell>
      <AdminPageHeader
        title="주도주 최신화"
        description="버튼을 누르면 운영자 PC가 주도주 판정을 다시 계산해 사이트에 싣습니다."
        action={
          <Link href="/leaders" className="rounded-xl border border-border px-3 py-2 text-[12.5px] text-gray-300 hover:text-ink">
            공개 화면 보기
          </Link>
        }
      />

      <Card className="mb-6">
        <CardTitle>지금 판정</CardTitle>
        <p className="mt-3 text-2xl font-bold tabular-nums text-ink">{collectedAt ?? "판정 없음"}</p>
        <p className={`mt-1 text-[12.5px] ${age !== null && age > LEADER_STALE_DAYS ? "text-gold-500" : "text-muted"}`}>
          {age === null ? "언제 판정인지 읽지 못했습니다." : age === 0 ? "오늘 판정입니다." : `${age}일 전 판정입니다.`}
        </p>

        <form action={requestLeaderRefreshAction} className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={!view.canRequest}
            className="rounded-lg bg-gold-500 px-4 py-2 text-[13px] font-semibold text-onAccent disabled:opacity-50"
          >
            지금 최신화 요청
          </button>
          <p className={`text-[12.5px] ${toneClass}`} aria-live="polite">
            {view.line}
          </p>
        </form>
        <p className="mt-3 text-[11.5px] leading-relaxed text-ink-3">
          PC가 켜져 있으면 07:40~23:40 사이 10분 안에 시작하고, 보통 몇 분 안에 끝납니다. 그 밖의 시간이거나 PC가 꺼져 있으면 다음 호출 때 시작합니다.
          시세·상대강도는 새로 받고, 실적·EPS는 마지막 일일 수집 값을 씁니다.
        </p>
      </Card>

      <Card>
        <CardTitle>최근 요청</CardTitle>
        {requests.length === 0 ? (
          <p className="mt-3 text-[13px] text-muted">아직 요청한 적이 없습니다.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border text-[12.5px]">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="w-16 font-medium text-ink">{STATUS_LABEL[r.status]}</span>
                <span className="text-muted">요청 {seoul(r.requestedAt)}</span>
                {r.finishedAt && <span className="text-muted">끝 {seoul(r.finishedAt)}</span>}
                {r.note && <span className="min-w-0 flex-1 truncate text-ink-3">{r.note}</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </AdminShell>
  );
}

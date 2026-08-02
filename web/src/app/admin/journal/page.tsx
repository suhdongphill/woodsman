import type { Metadata } from "next";
import { AdminPageHeader, AdminShell } from "@/components/layout/AdminPageHeader";
import { Card, CardTitle } from "@/components/ui/Card";
import { Table, Th, Td, Tr } from "@/components/ui/Table";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { TrashIcon } from "@/components/icons";
import { formatDate, formatNumber, formatPct } from "@/lib/format";
import { returnPctAt, summarizePerformance } from "@/lib/performance";
import { dataModeNotice } from "@/lib/data-mode";
import { getSiteBasics } from "@/lib/site-settings";
import { requireAdmin } from "@/lib/session";
import { loadAllJournal, loadSnapshots } from "@/features/journal/repository";
import { deleteJournalAction, deleteSnapshotAction } from "@/features/journal/actions";
import { JournalForm } from "@/features/journal/ui/JournalForm";
import { SnapshotForm } from "@/features/journal/ui/SnapshotForm";
import type { JournalAction } from "@/lib/types";

export const metadata: Metadata = { title: "투자일지 · 계좌 기록" };

/** ⚠ 정적 생성 금지 — 기록을 저장해도 화면이 안 바뀌는 사고가 난다. */
export const dynamic = "force-dynamic";

const ACTION_LABEL: Record<JournalAction, { label: string; tone: BadgeTone }> = {
  BUY: { label: "매수", tone: "emerald" },
  SELL: { label: "매도", tone: "danger" },
  REBALANCE: { label: "리밸런싱", tone: "gold" },
  NOTE: { label: "관찰", tone: "neutral" },
};

/**
 * 투자일지 · 계좌 스냅샷 관리.
 *
 * ⚠ 전에는 이 화면이 `lib/mock.ts`를 읽어서 **저장 버튼이 아무 일도 하지 않았다.**
 * 지금은 D1을 읽고 쓴다. 여기서 넣은 기록이 곧 공개 화면(/journal, /portfolio)이 된다.
 */
export default async function AdminJournalPage() {
  await requireAdmin("/admin/journal");

  const [entries, snapshots, basics] = await Promise.all([
    loadAllJournal(),
    loadSnapshots(),
    getSiteBasics(),
  ]);

  const perf = summarizePerformance(snapshots);
  const notice = dataModeNotice(basics.dataMode);
  const today = new Date().toISOString().slice(0, 10);
  const recent = [...snapshots].reverse();

  return (
    <AdminShell>
      <AdminPageHeader
        title="투자일지 · 계좌 기록"
        description="여기에 넣은 기록이 그대로 공개 화면이 됩니다. 매매할 때마다 일지를, 월 1회 계좌 스냅샷을 남기세요."
      />

      <p className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-[12px] text-gray-400">
        <Badge tone={notice.tone === "ok" ? "emerald" : "info"}>{notice.badge}</Badge>
        <span>{notice.line}</span>
      </p>

      {perf && (
        <div className="mb-6 grid gap-3 sm:grid-cols-4">
          <Card>
            <p className="text-[11px] text-muted">평가액</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-white">
              {formatNumber(perf.value)}
            </p>
          </Card>
          <Card>
            <p className="text-[11px] text-muted">납입원금</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-gray-300">
              {formatNumber(perf.principal)}
            </p>
          </Card>
          <Card>
            <p className="text-[11px] text-muted">수익률</p>
            <p
              className={`mt-1 text-lg font-bold tabular-nums ${
                perf.returnPct >= 0 ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {formatPct(perf.returnPct)}
            </p>
          </Card>
          <Card>
            <p className="text-[11px] text-muted">기록</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-white">
              {perf.months}개월 · {entries.length}건
            </p>
          </Card>
        </div>
      )}

      <Card className="mb-6">
        <CardTitle>일지 쓰기</CardTitle>
        <JournalForm today={today} />
      </Card>

      <Card className="mb-6" padding="p-0">
        <div className="px-5 pt-5">
          <CardTitle>투자일지 ({entries.length}건)</CardTitle>
        </div>
        {entries.length === 0 ? (
          <p className="px-5 pb-5 text-[13px] text-muted">
            아직 기록이 없습니다. 위에서 첫 일지를 남겨 보세요.
          </p>
        ) : (
          <Table>
            <thead>
              <Tr>
                <Th>날짜</Th>
                <Th>구분</Th>
                <Th>제목</Th>
                <Th>종목</Th>
                <Th className="text-right">체결</Th>
                <Th className="text-center">공개</Th>
                <Th className="text-right">관리</Th>
              </Tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const meta = ACTION_LABEL[e.action];
                return (
                  <Tr key={e.id}>
                    <Td className="whitespace-nowrap tabular-nums text-muted">
                      {formatDate(e.date)}
                    </Td>
                    <Td>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </Td>
                    <Td className="text-white">{e.title}</Td>
                    <Td className="text-muted">
                      {e.name ?? "—"}
                      {e.ticker && <span className="ml-1 font-mono text-gray-600">{e.ticker}</span>}
                    </Td>
                    <Td className="text-right tabular-nums text-gray-400">
                      {e.shares != null && e.price != null
                        ? `${e.shares.toLocaleString("ko-KR")}주 · ${formatNumber(e.price, e.currency ?? "KRW")}`
                        : "—"}
                    </Td>
                    <Td className="text-center">
                      {e.published ? (
                        <Badge tone="emerald">공개</Badge>
                      ) : (
                        <Badge tone="neutral">비공개</Badge>
                      )}
                    </Td>
                    <Td className="text-right">
                      <form action={deleteJournalAction} className="flex justify-end">
                        <input type="hidden" name="id" value={e.id} />
                        <button
                          type="submit"
                          aria-label={`${e.title} 삭제`}
                          className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-cardHover hover:text-red-400"
                        >
                          <TrashIcon size={14} />
                        </button>
                      </form>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <Card className="mb-6">
        <CardTitle>계좌 스냅샷 기록 (월 1회)</CardTitle>
        <SnapshotForm today={today} />
      </Card>

      <Card padding="p-0">
        <div className="px-5 pt-5">
          <CardTitle>스냅샷 ({snapshots.length}개월)</CardTitle>
        </div>
        {snapshots.length === 0 ? (
          <p className="px-5 pb-5 text-[13px] text-muted">
            아직 스냅샷이 없습니다. 위에서 이번 달 기록을 남기면 자금흐름 곡선이 그려집니다.
          </p>
        ) : (
          <Table>
            <thead>
              <Tr>
                <Th>기준일</Th>
                <Th className="text-right">납입원금</Th>
                <Th className="text-right">평가액</Th>
                <Th className="text-right">수익률</Th>
                <Th className="text-right">누적 배당·이자</Th>
                <Th>메모</Th>
                <Th className="text-right">관리</Th>
              </Tr>
            </thead>
            <tbody>
              {recent.map((s) => {
                const pct = returnPctAt(s);
                return (
                  <Tr key={s.date}>
                    <Td className="whitespace-nowrap tabular-nums text-muted">{s.date}</Td>
                    <Td className="text-right tabular-nums text-gray-400">
                      {formatNumber(s.principal)}
                    </Td>
                    <Td className="text-right tabular-nums text-white">{formatNumber(s.value)}</Td>
                    <Td
                      className={`text-right tabular-nums ${
                        pct >= 0 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {formatPct(pct)}
                    </Td>
                    <Td className="text-right tabular-nums text-gold-400">
                      {formatNumber(s.income)}
                    </Td>
                    <Td className="text-[12px] text-gray-500">{s.memo ?? "—"}</Td>
                    <Td className="text-right">
                      <form action={deleteSnapshotAction} className="flex justify-end">
                        <input type="hidden" name="date" value={s.date} />
                        <button
                          type="submit"
                          aria-label={`${s.date} 스냅샷 삭제`}
                          className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-cardHover hover:text-red-400"
                        >
                          <TrashIcon size={14} />
                        </button>
                      </form>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </AdminShell>
  );
}

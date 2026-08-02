import type { Metadata } from "next";
import { AdminPageHeader, AdminShell } from "@/components/layout/AdminPageHeader";
import { Card, CardTitle } from "@/components/ui/Card";
import { Table, Th, Td, Tr } from "@/components/ui/Table";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EditIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { formatDate, formatNumber, formatPct } from "@/lib/format";
import { returnPctAt, sortByDate, summarizePerformance } from "@/lib/performance";
import { accountSnapshots, journalEntries } from "@/lib/mock";
import type { JournalAction } from "@/lib/types";

export const metadata: Metadata = { title: "투자일지 · 계좌 기록" };

const ACTION_LABEL: Record<JournalAction, { label: string; tone: BadgeTone }> = {
  BUY: { label: "매수", tone: "emerald" },
  SELL: { label: "매도", tone: "danger" },
  REBALANCE: { label: "리밸런싱", tone: "gold" },
  NOTE: { label: "관찰", tone: "neutral" },
};

/**
 * 투자일지 · 계좌 스냅샷 관리.
 *
 * 이 두 가지가 사이트의 주력 콘텐츠다 — 월 1회 스냅샷을 넣고,
 * 매매할 때마다 일지를 쓰면 공개 화면(/portfolio, /journal)이 그대로 갱신된다.
 * (Phase 4에서 실제 CRUD 서버 액션과 연결)
 */
export default function AdminJournalPage() {
  const perf = summarizePerformance(accountSnapshots);
  const snapshots = sortByDate(accountSnapshots).reverse();

  return (
    <AdminShell>
      <AdminPageHeader
        title="투자일지 · 계좌 기록"
        description="월 1회 계좌 스냅샷과 매매 일지를 남기면 공개 포트폴리오 화면이 갱신됩니다."
        action={
          <Button variant="gold" size="sm">
            <PlusIcon size={14} />
            일지 작성
          </Button>
        }
      />

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
              {perf.months}개월 · {journalEntries.length}건
            </p>
          </Card>
        </div>
      )}

      <Card className="mb-6" padding="p-0">
        <div className="px-5 pt-5">
          <CardTitle>투자일지</CardTitle>
        </div>
        <Table>
          <thead>
            <Tr>
              <Th>날짜</Th>
              <Th>구분</Th>
              <Th>제목</Th>
              <Th>종목</Th>
              <Th className="text-right">체결</Th>
              <Th className="text-right">관리</Th>
            </Tr>
          </thead>
          <tbody>
            {journalEntries.map((e) => {
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
                  <Td className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button variant="ghost" size="sm" aria-label="수정">
                        <EditIcon size={14} />
                      </Button>
                      <Button variant="ghost" size="sm" aria-label="삭제">
                        <TrashIcon size={14} />
                      </Button>
                    </div>
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
      </Card>

      <Card padding="p-0">
        <div className="flex items-center justify-between px-5 pt-5">
          <CardTitle>계좌 스냅샷 (월 1회)</CardTitle>
          <Button variant="outline" size="sm">
            <PlusIcon size={14} />
            이번 달 기록
          </Button>
        </div>
        <Table>
          <thead>
            <Tr>
              <Th>기준일</Th>
              <Th className="text-right">납입원금</Th>
              <Th className="text-right">평가액</Th>
              <Th className="text-right">수익률</Th>
              <Th className="text-right">누적 배당·이자</Th>
              <Th>메모</Th>
            </Tr>
          </thead>
          <tbody>
            {snapshots.map((s) => {
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
                </Tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
    </AdminShell>
  );
}

import type { Metadata } from "next";
import { AdminPageHeader, AdminShell } from "@/components/layout/AdminPageHeader";
import { Card, CardTitle } from "@/components/ui/Card";
import { Table, Th, Td, Tr } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { requireAdmin } from "@/lib/session";
import { actionLabel, groupByDay, seoulTime, LOGGED_AREAS, UNLOGGED_AREAS } from "@/lib/admin-log";
import { countAdminLogs, loadAdminLogs } from "@/features/admin-log/repository";

export const metadata: Metadata = { title: "활동 로그" };

/** ⚠ 정적 생성 금지 — 방금 한 일이 안 보이면 로그가 아니다. */
export const dynamic = "force-dynamic";

const SHOWN = 200;

/**
 * 관리자 활동 로그.
 *
 * ⚠ 2026-08-30에 「편집을 눌러도 아무 일이 없다」를 재현으로 반나절 걸려 좁혔다. 이 화면이
 *    있었으면 *"편집 화면 열림이 하나도 없고 새 글 저장만 쌓였다"* 를 보고 10분에 끝났다.
 *
 * ⚠ **아직 기록하지 않는 자리를 화면에 적는다.** 부분만 기록하는 로그의 가장 큰 위험은
 *    없는 것을 "안 한 것"으로 읽는 것이다. 어디가 비어 있는지 말해 두면 그 오해가 안 생긴다.
 */
export default async function AdminLogsPage() {
  await requireAdmin("/admin/logs");

  const [entries, total] = await Promise.all([loadAdminLogs(SHOWN), countAdminLogs()]);
  const days = groupByDay(entries);

  return (
    <AdminShell>
      <AdminPageHeader
        title="활동 로그"
        description="관리자 화면에서 한 일을 시간순으로 남깁니다. 무엇이 언제 바뀌었는지 되짚을 때 여기부터 봅니다."
      />

      <div className="mb-5 flex flex-wrap gap-2 text-[12px] text-gray-400">
        <Badge tone="neutral">전체 {total.toLocaleString("ko-KR")}건</Badge>
        {total > SHOWN && <Badge tone="neutral">최근 {SHOWN}건만 표시</Badge>}
      </div>

      <Card className="mb-6">
        <CardTitle>무엇을 기록하고 있나</CardTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-[11px] text-emerald-400">기록합니다</p>
            <ul className="space-y-1 text-[12.5px] text-gray-300">
              {LOGGED_AREAS.map((area) => (
                <li key={area}>· {area}</li>
              ))}
            </ul>
          </div>
          <div>
            {/* ⚠ 비어 있는 자리를 숨기지 않는다. 없는 기록을 "안 한 일"로 읽으면 안 된다. */}
            <p className="mb-1.5 text-[11px] text-yellow-300">아직 기록하지 않습니다</p>
            <ul className="space-y-1 text-[12.5px] text-gray-500">
              {UNLOGGED_AREAS.map((area) => (
                <li key={area}>· {area}</li>
              ))}
            </ul>
          </div>
        </div>
        <p className="mt-4 text-[11px] leading-relaxed text-gray-600">
          시각은 한국 시간(KST)입니다. ⚠ 로그를 남기다 실패해도 하던 일은 계속됩니다 — 대신
          서버 로그에 남습니다.
        </p>
      </Card>

      {days.length === 0 ? (
        <Card>
          <p className="text-[13px] text-muted">
            아직 기록이 없습니다. 관리자 화면에서 무언가를 저장하면 여기에 쌓입니다.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {days.map(({ day, items }) => (
            <Card key={day} padding="p-0">
              <div className="px-5 pt-5">
                <CardTitle>
                  {day} ({items.length}건)
                </CardTitle>
              </div>
              <Table>
                <caption className="sr-only">{day}의 관리자 활동</caption>
                <thead>
                  <Tr>
                    <Th className="w-16">시각</Th>
                    <Th className="w-36">한 일</Th>
                    <Th>내용</Th>
                    <Th className="w-44">대상</Th>
                    <Th className="w-48">누가</Th>
                  </Tr>
                </thead>
                <tbody>
                  {items.map((entry) => (
                    <Tr key={entry.id}>
                      <Td className="whitespace-nowrap tabular-nums text-muted">
                        {seoulTime(entry.at)}
                      </Td>
                      <Td className="text-ink">{actionLabel(entry.action)}</Td>
                      <Td className="text-gray-300">{entry.summary ?? "—"}</Td>
                      <Td className="truncate font-mono text-[11px] text-gray-600">
                        {entry.target ?? "—"}
                      </Td>
                      <Td className="truncate text-[12px] text-gray-500">{entry.actor}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          ))}
        </div>
      )}
    </AdminShell>
  );
}

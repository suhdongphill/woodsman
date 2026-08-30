import type { Metadata } from "next";
import { AdminPageHeader, AdminShell } from "@/components/layout/AdminPageHeader";
import { Card, CardTitle } from "@/components/ui/Card";
import { Table, Th, Td, Tr } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { ExternalIcon } from "@/components/icons";
import { formatDateTime } from "@/lib/format";
import { loadFeeds } from "@/features/feeds/repository";

export const metadata: Metadata = { title: "RSS 피드" };

/** 티스토리 유입 집계처럼 D1을 읽으므로 정적 생성하지 않는다. */
export const dynamic = "force-dynamic";

/**
 * RSS 피드 화면.
 *
 * ⚠ 2026-08-07 점검 전까지 이 화면은 **통째로 목업**이었다. `lib/mock.ts`의 고정 배열을
 *   읽어 등록된 피드가 2건 있는 것처럼 보였고(실제 D1에는 1건), 화면의 버튼 6개
 *   ─ 피드 추가·등록·지금 수집·삭제·글로 가져오기·활성 토글 ─ 에는 핸들러가 하나도 없었다.
 *   눌러도 아무 일이 없는데 화면은 성공한 것처럼 보이는 상태였다.
 *
 * 지금은 **등록된 피드를 D1에서 그대로 읽어 보여주기만 한다.** 수집·가져오기(P5.5)를
 * 붙이기 전까지 조작 버튼을 두지 않는다 — 운영지침 1장 "죽은 버튼을 두지 않는다".
 */
export default async function AdminFeedsPage() {
  const feeds = await loadFeeds();

  return (
    <AdminShell>
      <AdminPageHeader
        title="RSS 피드 (티스토리 큐레이션)"
        description="등록된 외부 블로그 RSS 목록입니다. 자동 수집은 아직 붙이지 않았습니다."
      />

      <Card className="mb-6 border-gold-600/30">
        <CardTitle>아직 수집하지 않습니다</CardTitle>
        <p className="text-[12.5px] leading-relaxed text-muted">
          피드 등록·수집·글 가져오기는 <strong className="text-gray-300">P5.5에서 붙입니다.</strong>{" "}
          그때까지 티스토리 글은 <strong className="text-gray-300">콘텐츠 화면에서 직접</strong>{" "}
          등록하세요(원문 주소를 넣으면 canonical이 원문으로 잡힙니다).
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
          ⚠ 전에는 이 자리에 동작하지 않는 버튼이 여섯 개 있었습니다. 눌러도 아무 일이 없는
          버튼은 &ldquo;처리했다&rdquo;고 믿게 만들기 때문에 없애 두었습니다.
        </p>
      </Card>

      {feeds.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card px-4 py-10 text-center text-sm text-gray-500">
          등록된 피드가 없습니다.
        </p>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>이름</Th>
              <Th>주소</Th>
              <Th className="w-24 text-center">상태</Th>
              <Th className="w-40">마지막 수집</Th>
            </tr>
          </thead>
          <tbody>
            {feeds.map((f) => (
              <Tr key={f.id}>
                <Td className="text-ink">{f.name}</Td>
                <Td>
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[12px] text-gray-400 hover:text-gold-400"
                  >
                    {f.url}
                    <ExternalIcon size={12} />
                  </a>
                </Td>
                <Td className="text-center">
                  {f.active ? (
                    <Badge tone="emerald">활성</Badge>
                  ) : (
                    <Badge tone="neutral">중지</Badge>
                  )}
                </Td>
                <Td>
                  <span className="text-[11px] tabular-nums text-gray-500">
                    {/* ⚠ "없음"과 "못 읽음"을 구분한다. null은 한 번도 안 돌았다는 뜻이다. */}
                    {f.lastFetchedAt ? formatDateTime(f.lastFetchedAt) : "아직 수집한 적 없음"}
                  </span>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </AdminShell>
  );
}

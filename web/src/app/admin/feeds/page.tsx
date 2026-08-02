import type { Metadata } from "next";
import { AdminPageHeader, AdminShell } from "@/components/layout/AdminPageHeader";
import { Card, CardTitle } from "@/components/ui/Card";
import { Table, Th, Td, Tr } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Toggle } from "@/components/ui/Toggle";
import { Button } from "@/components/ui/Button";
import { PlusIcon, TrashIcon, ExternalIcon, DownloadIcon } from "@/components/icons";
import { formatDate, formatDateTime } from "@/lib/format";
import { feedItems, feeds } from "@/lib/mock";

export const metadata: Metadata = { title: "RSS 피드" };

export default function AdminFeedsPage() {
  return (
    <AdminShell>
      <AdminPageHeader
        title="RSS 피드 (티스토리 큐레이션)"
        description="외부 블로그 RSS를 등록하면 서버가 파싱·캐시하고, 원하는 항목만 source=TISTORY 글로 가져옵니다."
        action={
          <Button variant="gold" size="sm">
            <PlusIcon size={14} />
            피드 추가
          </Button>
        }
      />

      <Card className="mb-6">
        <CardTitle>피드 등록</CardTitle>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            placeholder="표시 이름"
            className="sm:w-52 bg-[#12141c] border border-border rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500"
          />
          <input
            placeholder="https://블로그주소/rss"
            className="flex-1 bg-[#12141c] border border-border rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-600 font-mono focus:outline-none focus:border-emerald-500"
          />
          <Button variant="emerald" size="md">
            등록
          </Button>
        </div>
        <p className="mt-3 text-[11px] text-gray-600">
          등록 시 서버에서 URL 스킴·호스트를 검증합니다(SSRF 방지). 내부망 주소는 차단됩니다.
        </p>
      </Card>

      <Table className="mb-7">
        <thead>
          <tr>
            <Th>피드</Th>
            <Th className="w-28 text-right">항목</Th>
            <Th className="w-40">최근 수집</Th>
            <Th className="w-20 text-center">활성</Th>
            <Th className="w-28 text-right">작업</Th>
          </tr>
        </thead>
        <tbody>
          {feeds.map((f) => (
            <Tr key={f.id}>
              <Td>
                <p className="text-white text-[13px]">{f.name}</p>
                <span className="text-[11px] text-gray-600 font-mono break-all">{f.url}</span>
              </Td>
              <Td className="text-right tabular-nums text-gray-400">{f.itemCount}</Td>
              <Td className="text-[11px] text-gray-500 tabular-nums">
                {formatDateTime(f.lastFetchedAt)}
              </Td>
              <Td>
                <div className="flex justify-center">
                  <Toggle defaultOn={f.active} size="sm" />
                </div>
              </Td>
              <Td>
                <div className="flex justify-end gap-1">
                  <button
                    type="button"
                    className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-cardHover transition-colors"
                    aria-label="지금 수집"
                  >
                    <DownloadIcon size={15} />
                  </button>
                  <button
                    type="button"
                    className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-cardHover transition-colors"
                    aria-label="삭제"
                  >
                    <TrashIcon size={15} />
                  </button>
                </div>
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>

      <h2 className="text-sm font-semibold text-white mb-3">수집된 항목</h2>
      <Table>
        <thead>
          <tr>
            <Th>제목</Th>
            <Th className="w-40">피드</Th>
            <Th className="w-28">게시일</Th>
            <Th className="w-28 text-right">가져오기</Th>
          </tr>
        </thead>
        <tbody>
          {feedItems.map((it) => (
            <Tr key={it.id}>
              <Td>
                <div className="flex items-center gap-2">
                  <span className="text-white text-[13px] line-clamp-1">{it.title}</span>
                  <ExternalIcon size={12} className="text-gray-600 shrink-0" />
                </div>
                <span className="text-[11px] text-gray-600 font-mono break-all">{it.link}</span>
              </Td>
              <Td className="text-[12px] text-gray-400">{it.feedName}</Td>
              <Td className="text-[11px] text-gray-500 tabular-nums">
                {formatDate(it.publishedAt)}
              </Td>
              <Td>
                <div className="flex justify-end">
                  {it.imported ? (
                    <Badge tone="neutral">가져옴</Badge>
                  ) : (
                    <Button variant="emerald" size="sm">
                      글로 가져오기
                    </Button>
                  )}
                </div>
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </AdminShell>
  );
}

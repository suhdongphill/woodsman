import type { Metadata } from "next";
import { AdminPageHeader, AdminShell } from "@/components/layout/AdminPageHeader";
import { Table, Th, Td, Tr } from "@/components/ui/Table";
import { Badge, PostTypeBadge, Chip } from "@/components/ui/Badge";
import { Toggle } from "@/components/ui/Toggle";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { PlusIcon, EditIcon, TrashIcon, SearchIcon, ExternalIcon } from "@/components/icons";
import { formatDate } from "@/lib/format";
import { allPosts } from "@/lib/mock";

export const metadata: Metadata = { title: "콘텐츠" };

const TABS = ["전체", "인사이트", "종목분석", "공지", "작성중"];

export default function AdminPostsPage() {
  return (
    <AdminShell>
      <AdminPageHeader
        title="콘텐츠 관리"
        description="인사이트·종목분석·공지는 관리자만 작성합니다. 글별 댓글 허용을 여기서 켜고 끕니다."
        action={
          <Button variant="gold" size="sm">
            <PlusIcon size={14} />
            새 글
          </Button>
        }
      />

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <div className="flex flex-wrap gap-2 flex-1">
          {TABS.map((t, i) => (
            <Chip key={t} active={i === 0}>
              {t}
            </Chip>
          ))}
        </div>
        <div className="relative sm:w-60">
          <SearchIcon
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600"
          />
          <input
            type="search"
            placeholder="제목 검색"
            className="w-full bg-card border border-border rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gold-600 transition-colors"
          />
        </div>
      </div>

      <Table>
        <thead>
          <tr>
            <Th>제목</Th>
            <Th className="w-24">유형</Th>
            <Th className="w-24">출처</Th>
            <Th className="w-24">발행</Th>
            <Th className="w-20 text-center">댓글</Th>
            <Th className="w-20 text-right">조회</Th>
            <Th className="w-24 text-right">작업</Th>
          </tr>
        </thead>
        <tbody>
          {allPosts.map((p) => (
            <Tr key={p.id}>
              <Td>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-white truncate max-w-[280px]">{p.title}</span>
                  {p.externalUrl && <ExternalIcon size={12} className="text-gray-600 shrink-0" />}
                </div>
                <span className="text-[11px] text-gray-600 font-mono">/{p.slug}</span>
              </Td>
              <Td>
                <PostTypeBadge type={p.type} />
              </Td>
              <Td>
                <Badge tone={p.source === "TISTORY" ? "gold" : "neutral"}>
                  {p.source === "TISTORY" ? "티스토리" : "직접"}
                </Badge>
              </Td>
              <Td>
                {p.published ? (
                  <span className="text-[12px] text-gray-300 tabular-nums">
                    {formatDate(p.publishedAt)}
                  </span>
                ) : (
                  <Badge tone="warn">작성중</Badge>
                )}
              </Td>
              <Td className="text-center">
                <div className="flex justify-center">
                  <Toggle defaultOn={p.commentsEnabled} size="sm" />
                </div>
              </Td>
              <Td className="text-right tabular-nums text-gray-400">
                {p.viewCount.toLocaleString("ko-KR")}
              </Td>
              <Td>
                <div className="flex justify-end gap-1">
                  <button
                    type="button"
                    className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-cardHover transition-colors"
                    aria-label="편집"
                  >
                    <EditIcon size={15} />
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

      {/* 에디터 미리보기 (Phase 3에서 실제 CRUD 폼으로 대체) */}
      <Card className="mt-7">
        <CardTitle action={<Badge tone="neutral">Phase 3에서 연결</Badge>}>
          글 작성 폼 (미리보기)
        </CardTitle>
        <div className="grid lg:grid-cols-2 gap-5">
          <div className="space-y-3.5">
            <input
              placeholder="제목"
              className="w-full bg-[#12141c] border border-border rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500"
            />
            <div className="grid grid-cols-2 gap-3">
              <select className="bg-[#12141c] border border-border rounded-xl px-3 py-2.5 text-sm text-ink">
                <option>INSIGHT</option>
                <option>ANALYSIS</option>
                <option>NOTICE</option>
              </select>
              <select className="bg-[#12141c] border border-border rounded-xl px-3 py-2.5 text-sm text-ink">
                <option>SELF</option>
                <option>TISTORY</option>
              </select>
            </div>
            <input
              placeholder="slug (예: three-bucket-portfolio)"
              className="w-full bg-[#12141c] border border-border rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-600 font-mono focus:outline-none focus:border-emerald-500"
            />
            <input
              placeholder="태그 (쉼표 구분) · 연결 종목 티커"
              className="w-full bg-[#12141c] border border-border rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500"
            />
            <textarea
              rows={7}
              placeholder="<p>본문 HTML — 저장 시 sanitize 됩니다.</p>"
              className="w-full bg-[#12141c] border border-border rounded-xl px-3.5 py-3 text-sm text-white placeholder-gray-600 font-mono resize-none focus:outline-none focus:border-emerald-500"
            />
            <Toggle
              label="이 글의 댓글 허용"
              description="끄면 상세 화면에 🔒 댓글이 잠긴 글입니다 로 표시됩니다."
              defaultOn
            />
          </div>
          <div>
            <p className="text-[11px] text-muted mb-2">미리보기</p>
            <div className="bg-[#12141c] border border-border rounded-xl p-5 h-[380px] overflow-auto">
              <div
                className="prose-woodsman"
                dangerouslySetInnerHTML={{
                  __html:
                    "<h2>미리보기</h2><p>왼쪽에 입력한 <strong>HTML</strong>이 이곳에 렌더링됩니다. 저장 시 서버에서 sanitize 처리해 XSS를 차단합니다.</p><ul><li>목록 항목</li><li>목록 항목</li></ul>",
                }}
              />
            </div>
          </div>
        </div>
      </Card>
    </AdminShell>
  );
}

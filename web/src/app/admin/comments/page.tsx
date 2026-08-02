import type { Metadata } from "next";
import { AdminPageHeader, AdminShell } from "@/components/layout/AdminPageHeader";
import { Card, CardTitle } from "@/components/ui/Card";
import { Table, Th, Td, Tr } from "@/components/ui/Table";
import { Badge, Chip } from "@/components/ui/Badge";
import { Toggle } from "@/components/ui/Toggle";
import { Button } from "@/components/ui/Button";
import { CheckIcon, EyeIcon, TrashIcon } from "@/components/icons";
import { formatDateTime } from "@/lib/format";
import { comments, siteConfig } from "@/lib/mock";
import type { CommentStatus } from "@/lib/types";

export const metadata: Metadata = { title: "댓글 · 정책" };

const STATUS_LABEL: Record<CommentStatus, string> = {
  VISIBLE: "노출",
  PENDING: "승인대기",
  HIDDEN: "숨김",
};

const TABS = ["전체", "승인대기", "신고됨", "숨김"];

export default function AdminCommentsPage() {
  return (
    <AdminShell>
      <AdminPageHeader
        title="댓글 · 정책"
        description="사이트 전체 댓글 정책을 설정하고, 개별 댓글을 승인·숨김·삭제합니다."
      />

      {/* 사이트 개방 스위치 — 커뮤니티 기능은 코드로 남아 있고 여기서만 열린다 */}
      <Card className="mb-5 border-gold-600/30">
        <CardTitle>사이트 개방</CardTitle>
        <p className="mb-3 text-[12px] leading-relaxed text-muted">
          지금 Woodsman은 <strong className="text-gray-300">운영자 1인 콘텐츠 사이트</strong>로
          동작합니다. 회원가입·게시판·댓글 기능은 지워진 게 아니라 아래 스위치로 잠겨 있으며,
          켜는 즉시 준비된 화면이 그대로 살아납니다.
        </p>
        <div className="divide-y divide-border">
          <Toggle
            label="공개 회원가입 받기"
            description="끄면 /register가 '가입 미지원' 안내로 바뀌고 상단 로그인·회원가입 링크가 사라집니다. 관리자는 로고를 더블클릭해 로그인합니다."
            defaultOn={siteConfig.signupEnabled}
          />
          <Toggle
            label="커뮤니티(게시판) 열기"
            description="끄면 /board가 404로 응답하고 메뉴에서 사라집니다. 댓글도 함께 닫힙니다."
            defaultOn={siteConfig.communityEnabled}
          />
        </div>
        <p className="mt-3 border-t border-border/70 pt-3 text-[11px] leading-relaxed text-gray-500">
          ⚠ 가입을 열기 전에 <strong className="text-gray-400">개인정보 처리방침</strong>의 수집
          항목·목적·보유기간을 먼저 갱신하세요. 현재 방침에는 &ldquo;회원정보를 수집하지
          않는다&rdquo;고 명시돼 있습니다.
        </p>
      </Card>

      <div className="grid lg:grid-cols-2 gap-5 mb-7">
        <Card>
          <CardTitle>댓글 전역 설정</CardTitle>
          <div className="divide-y divide-border">
            <Toggle
              label="사이트 전체 댓글 사용"
              description="끄면 모든 글에서 댓글 작성 폼이 사라집니다."
              defaultOn={siteConfig.commentsGloballyEnabled}
            />
            <Toggle
              label="댓글 작성 시 로그인 필요"
              description="비로그인 사용자는 열람만 가능합니다."
              defaultOn={siteConfig.requireLoginToComment}
            />
            <Toggle
              label="승인제(모더레이션)"
              description="켜면 새 댓글이 승인대기 상태로 저장되고, 승인해야 노출됩니다."
              defaultOn={siteConfig.moderationOn}
            />
          </div>
        </Card>

        <Card>
          <CardTitle>금지어 필터</CardTitle>
          <p className="text-[12px] text-muted mb-3">
            쉼표로 구분해 입력합니다. 포함된 댓글은 자동으로 숨김 처리됩니다.
          </p>
          <textarea
            rows={4}
            defaultValue={siteConfig.bannedWords}
            className="w-full bg-[#12141c] border border-border rounded-xl px-3.5 py-3 text-sm text-white resize-none focus:outline-none focus:border-emerald-500"
          />
          <div className="flex justify-end mt-3">
            <Button variant="emerald" size="sm">
              저장
            </Button>
          </div>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {TABS.map((t, i) => (
          <Chip key={t} active={i === 0}>
            {t}
          </Chip>
        ))}
      </div>

      <Table>
        <thead>
          <tr>
            <Th className="w-24">상태</Th>
            <Th>내용</Th>
            <Th className="w-40">글</Th>
            <Th className="w-32">작성</Th>
            <Th className="w-28 text-right">작업</Th>
          </tr>
        </thead>
        <tbody>
          {comments.map((c) => (
            <Tr key={c.id}>
              <Td>
                <div className="flex flex-col gap-1 items-start">
                  <Badge
                    tone={
                      c.status === "VISIBLE"
                        ? "emerald"
                        : c.status === "PENDING"
                          ? "warn"
                          : "neutral"
                    }
                  >
                    {STATUS_LABEL[c.status]}
                  </Badge>
                  {c.reported && <Badge tone="danger">신고</Badge>}
                </div>
              </Td>
              <Td>
                <p className="text-white text-[12.5px] line-clamp-2 max-w-[360px]">{c.body}</p>
                <span className="text-[11px] text-gray-600">{c.authorName}</span>
              </Td>
              <Td>
                <span className="text-[12px] text-gray-400 line-clamp-1">{c.postTitle}</span>
              </Td>
              <Td>
                <span className="text-[11px] text-gray-500 tabular-nums">
                  {formatDateTime(c.createdAt)}
                </span>
              </Td>
              <Td>
                <div className="flex justify-end gap-1">
                  <button
                    type="button"
                    className="p-1.5 rounded-lg text-gray-500 hover:text-emerald-400 hover:bg-cardHover transition-colors"
                    aria-label="승인"
                  >
                    <CheckIcon size={15} />
                  </button>
                  <button
                    type="button"
                    className="p-1.5 rounded-lg text-gray-500 hover:text-yellow-400 hover:bg-cardHover transition-colors"
                    aria-label="숨김"
                  >
                    <EyeIcon size={15} />
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

      <p className="mt-5 text-[11px] text-gray-600">
        노출 규칙은 서버에서 계산합니다: 전역 스위치 &amp;&amp; 글별 스위치가 모두 켜져 있을 때만
        작성 폼이 노출됩니다.
      </p>
    </AdminShell>
  );
}

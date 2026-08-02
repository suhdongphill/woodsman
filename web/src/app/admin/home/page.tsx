import type { Metadata } from "next";
import { AdminPageHeader, AdminShell } from "@/components/layout/AdminPageHeader";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Toggle } from "@/components/ui/Toggle";
import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/Button";
import { EditIcon, ExternalIcon } from "@/components/icons";
import { siteConfig } from "@/lib/mock";

export const metadata: Metadata = { title: "홈 편집" };

const BLOCKS = [
  { key: "hero", label: "히어로", desc: "제목·부제·CTA 버튼", on: true },
  { key: "funnel", label: "이용 안내(퍼널)", desc: "4단계 카드", on: true },
  { key: "portfolio", label: "대표 포트폴리오 요약", desc: "상위 3종목 + 기능별 배분", on: true },
  { key: "insights", label: "최신 인사이트", desc: "최근 발행 3건", on: true },
  { key: "board", label: "커뮤니티 인기글", desc: "조회수 상위 4건", on: true },
  { key: "stocks", label: "주목 종목", desc: "관찰 종목 4개", on: true },
];

export default function AdminHomePage() {
  return (
    <AdminShell>
      <AdminPageHeader
        title="홈 편집"
        description="홈 히어로 문구와 노출 블록을 관리합니다."
        action={
          <LinkButton href="/" variant="ghost" size="sm">
            <ExternalIcon size={14} />
            홈 미리보기
          </LinkButton>
        }
      />

      <div className="grid lg:grid-cols-2 gap-5">
        <Card>
          <CardTitle>히어로</CardTitle>
          <div className="space-y-3.5">
            <div>
              <label className="block text-[11px] text-muted mb-1.5">제목</label>
              <input
                defaultValue={siteConfig.heroTitle}
                className="w-full bg-[#12141c] border border-border rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-[11px] text-muted mb-1.5">부제</label>
              <textarea
                rows={3}
                defaultValue={siteConfig.heroSubtitle}
                className="w-full bg-[#12141c] border border-border rounded-xl px-3.5 py-3 text-sm text-white resize-none focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="flex justify-end">
              <Button variant="emerald" size="sm">
                저장
              </Button>
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-border/70">
            <p className="text-[11px] text-muted mb-2">미리보기</p>
            <div className="rounded-xl border border-border bg-[#12141c] p-5">
              <h2 className="text-lg font-bold text-white leading-snug">
                {siteConfig.heroTitle}
              </h2>
              <p className="mt-2 text-[12.5px] text-muted leading-relaxed">
                {siteConfig.heroSubtitle}
              </p>
            </div>
          </div>
        </Card>

        <Card padding="p-0">
          <div className="px-5 pt-5">
            <CardTitle action={<Badge tone="neutral">드래그 정렬은 Phase 3</Badge>}>
              홈 블록
            </CardTitle>
          </div>
          <ul>
            {BLOCKS.map((b) => (
              <li
                key={b.key}
                className="flex items-center gap-3 px-5 py-3.5 border-t border-border"
              >
                <span className="text-gray-700 cursor-grab select-none">⋮⋮</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-white">{b.label}</p>
                  <p className="text-[11px] text-muted mt-0.5">{b.desc}</p>
                </div>
                <button
                  type="button"
                  className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-cardHover transition-colors"
                  aria-label="편집"
                >
                  <EditIcon size={15} />
                </button>
                <Toggle defaultOn={b.on} size="sm" />
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </AdminShell>
  );
}

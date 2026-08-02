import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { Chip } from "@/components/ui/Badge";
import { PostCard } from "@/features/posts/ui/PostCard";
import { EmptyState } from "@/components/ui/Card";
import { FileTextIcon } from "@/components/icons";
import { AdSlot } from "@/components/analytics/AdSlot";
import { posts } from "@/lib/mock";

export const metadata: Metadata = {
  title: "인사이트",
  description: "포트폴리오 전략, 종목 분석, 인컴 투자에 대한 기록.",
};

const CATEGORIES = ["전체", "포트폴리오 전략", "종목분석", "인컴 투자", "공지"];

export default function InsightsPage() {
  const list = posts;

  return (
    <>
      <PageHeader
        eyebrow="INSIGHTS"
        title="인사이트"
        description="시황이 아니라 원칙을 다룹니다. 티스토리 원문 글도 함께 큐레이션합니다."
      />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
        {/* 카테고리 필터 (Phase 4에서 실제 필터링 연결) */}
        <div className="flex flex-wrap gap-2 mb-7">
          {CATEGORIES.map((c, i) => (
            <Chip key={c} active={i === 0}>
              {c}
            </Chip>
          ))}
        </div>

        {list.length === 0 ? (
          <EmptyState
            icon={<FileTextIcon size={30} />}
            title="아직 발행된 글이 없습니다"
            description="관리자가 첫 인사이트를 발행하면 이곳에 표시됩니다."
          />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {list.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        )}

        {/* 광고 — 목록을 다 훑은 자리. 페이지네이션과 떨어뜨려 오조작을 피한다. */}
        <AdSlot placement="feed-end" />

        {/* 페이지네이션 목업 */}
        <div className="flex items-center justify-center gap-1.5 mt-10">
          {[1, 2, 3].map((n) => (
            <span
              key={n}
              className={
                "w-8 h-8 flex items-center justify-center rounded-lg text-xs border transition-colors cursor-pointer " +
                (n === 1
                  ? "bg-gold-500/15 text-gold-400 border-gold-500/40"
                  : "bg-card text-muted border-border hover:text-white")
              }
            >
              {n}
            </span>
          ))}
        </div>
      </div>
    </>
  );
}

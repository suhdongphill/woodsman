import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { Chip } from "@/components/ui/Badge";
import { PostCard } from "@/features/posts/ui/PostCard";
import { EmptyState } from "@/components/ui/Card";
import { FileTextIcon } from "@/components/icons";
import { AdSlot } from "@/components/analytics/AdSlot";
import { TistoryCta } from "@/features/site/ui/TistoryCta";
import { loadPublishedPosts } from "@/features/posts/repository";

export const metadata: Metadata = {
  alternates: { canonical: "/insights" },
  title: "인사이트",
  description: "포트폴리오 전략, 종목 분석, 인컴 투자에 대한 기록.",
};

const ALL = "전체";

/** 실제로 발행된 글의 카테고리만 보여준다 — 눌렀는데 0건인 칩을 만들지 않는다. */
function categoriesOf(posts: { category?: string }[]): string[] {
  const seen = new Set<string>();
  for (const p of posts) if (p.category) seen.add(p.category);
  return [ALL, ...[...seen].sort()];
}

/** ⚠ 정적 생성 금지 — 글을 발행해도 목록이 안 바뀐다. */
export const dynamic = "force-dynamic";

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const all = await loadPublishedPosts();
  const categories = categoriesOf(all);

  // 모르는 카테고리는 전체로 떨어뜨린다(쿼리스트링은 무엇이든 올 수 있다).
  const raw = (await searchParams).category;
  const selected = raw && categories.includes(raw) ? raw : ALL;
  const list = selected === ALL ? all : all.filter((p) => p.category === selected);

  return (
    <>
      <PageHeader
        eyebrow="INSIGHTS"
        title="인사이트"
        description="시황이 아니라 원칙을 다룹니다. 티스토리 원문 글도 함께 큐레이션합니다."
      />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
        {/* 카테고리 필터 — 누르면 실제로 걸러진다 */}
        <div className="flex flex-wrap gap-2 mb-7">
          {categories.map((c) => (
            <Chip
              key={c}
              active={c === selected}
              href={c === ALL ? "/insights" : `/insights?category=${encodeURIComponent(c)}`}
            >
              {c}
            </Chip>
          ))}
        </div>

        {list.length === 0 ? (
          <EmptyState
            icon={<FileTextIcon size={30} />}
            title={selected === ALL ? "아직 발행된 글이 없습니다" : `${selected} 글이 아직 없습니다`}
            description="관리자가 첫 인사이트를 발행하면 이곳에 표시됩니다."
          />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {list.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        )}

        {/* 목록을 다 훑은 자리 — 블로그 유도가 먼저, 광고는 그 아래로. */}
        <TistoryCta variant="compact" className="mt-8" />

        {/* 광고 — 티스토리 CTA 아래에 둔다(자리 경쟁에서 트래픽 유도가 이긴다). */}
        <AdSlot placement="feed-end" />

      </div>
    </>
  );
}

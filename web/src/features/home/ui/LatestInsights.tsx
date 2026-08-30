import Link from "next/link";
import { SectionHeader } from "@/components/ui/Card";
import { ChevronRightIcon } from "@/components/icons";
import { PostCard } from "@/features/posts/ui/PostCard";
import { TistoryCta } from "@/features/site/ui/TistoryCta";
import type { Post } from "@/lib/types";

/**
 * 최신 인사이트 + 티스토리 CTA.
 *
 * ⚠ 티스토리 CTA는 **인사이트를 훑은 직후**에 둔다 — 가장 잘 넘어가는 자리다.
 *    1순위 목적이 블로그 유입이라, 이 자리는 광고보다 위다(운영지침 §4).
 * ⚠ Step 3에서 글 수가 3편 → 6편으로 늘고, CTA가 하나 더 위로 올라간다.
 */
export function LatestInsights({
  posts,
  featuredTitle,
  featuredExcerpt,
}: {
  posts: Post[];
  featuredTitle: string;
  featuredExcerpt: string;
}) {
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-14">
      <SectionHeader
        title="최신 인사이트"
        subtitle="시장이 아니라 원칙을 다룹니다."
        action={
          <Link
            href="/insights"
            className="text-xs text-gold-400 hover:text-gold-500 flex items-center gap-0.5 shrink-0"
          >
            전체 보기
            <ChevronRightIcon size={13} />
          </Link>
        }
      />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {posts.map((p) => (
          <PostCard key={p.id} post={p} />
        ))}
      </div>

      {/* 티스토리 유도 — 인사이트를 훑은 직후가 가장 잘 넘어가는 자리 */}
      <TistoryCta
        variant="compact"
        className="mt-4"
        postTitle={featuredTitle}
        postExcerpt={featuredExcerpt}
      />
    </section>
  );
}

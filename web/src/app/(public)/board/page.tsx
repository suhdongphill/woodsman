import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { getSiteFlags, getSitePolicy } from "@/lib/site-settings";
import { Chip } from "@/components/ui/Badge";
import { BoardRow } from "@/components/ui/BoardRow";
import { EmptyState } from "@/components/ui/Card";
import { MessageIcon, LockIcon } from "@/components/icons";
import { loadPublishedPosts } from "@/features/posts/repository";

export const metadata: Metadata = {
  alternates: { canonical: "/board" },
  title: "커뮤니티",
  description: "인사이트·종목분석·공지 게시판. 댓글로 의견을 나눕니다.",
};

const ALL = "전체";

/** 실제로 발행된 글의 카테고리만 — 눌렀는데 0건인 칩을 만들지 않는다. */
function categoriesOf(posts: { category?: string }[]): string[] {
  const seen = new Set<string>();
  for (const p of posts) if (p.category) seen.add(p.category);
  return [ALL, ...[...seen].sort()];
}

/**
 * 개방 여부를 DB에서 읽으므로 정적 생성하면 안 된다.
 * 빌드 시점의 "닫힘" 판정이 그대로 구워져, 나중에 스위치를 켜도 열리지 않는다.
 */
export const dynamic = "force-dynamic";

/**
 * 커뮤니티가 닫혀 있으면 404로 응답한다.
 * 링크만 숨기고 페이지를 남겨두면 검색엔진과 광고 심사에 '빈 커뮤니티'가 노출된다.
 * 관리자가 `SiteConfig.communityEnabled`를 켜면 이 화면이 그대로 살아난다.
 */
export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const policy = await getSitePolicy();
  if (!policy.communityEnabled) notFound();

  const [flags, posts] = await Promise.all([getSiteFlags(), loadPublishedPosts(100)]);
  const categories = categoriesOf(posts);
  const raw = (await searchParams).category;
  const selected = raw && categories.includes(raw) ? raw : ALL;
  const shown = selected === ALL ? posts : posts.filter((p) => p.category === selected);

  const notices = shown.filter((p) => p.type === "NOTICE");
  const list = shown.filter((p) => p.type !== "NOTICE");

  return (
    <>
      <PageHeader
        eyebrow="COMMUNITY"
        title="커뮤니티"
        description="글은 관리자가 작성하고, 회원은 댓글로 참여합니다. 🔒 표시는 댓글이 잠긴 글입니다."
      />

      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10">
        {/* 카테고리 — 누르면 실제로 걸러진다. 검색은 아직 없어서 입력창을 두지 않는다. */}
        <div className="mb-6 flex flex-wrap gap-2">
          {categories.map((c) => (
            <Chip
              key={c}
              active={c === selected}
              href={c === ALL ? "/board" : `/board?category=${encodeURIComponent(c)}`}
            >
              {c}
            </Chip>
          ))}
        </div>
        {/* 상태 안내 */}
        <div className="flex items-center gap-4 mb-3 text-[11px] text-gray-600">
          <span className="flex items-center gap-1">
            <MessageIcon size={12} /> 댓글 수
          </span>
          <span className="flex items-center gap-1">
            <LockIcon size={12} /> 댓글 잠금
          </span>
          {!flags.commentsGloballyEnabled && (
            <span className="text-yellow-500">현재 사이트 전체 댓글이 꺼져 있습니다</span>
          )}
        </div>

        {shown.length === 0 ? (
          <EmptyState title={selected === ALL ? "아직 게시글이 없습니다" : selected + " 글이 아직 없습니다"} />
        ) : (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {notices.map((p) => (
              <BoardRow key={p.id} post={p} />
            ))}
            {list.map((p) => (
              <BoardRow key={p.id} post={p} />
            ))}
          </div>
        )}

      </div>
    </>
  );
}

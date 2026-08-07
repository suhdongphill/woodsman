import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { getSiteFlags, getSitePolicy } from "@/lib/site-settings";
import { Chip } from "@/components/ui/Badge";
import { BoardRow } from "@/components/ui/BoardRow";
import { EmptyState } from "@/components/ui/Card";
import { SearchIcon, MessageIcon, LockIcon } from "@/components/icons";
import { loadPublishedPosts } from "@/features/posts/repository";

export const metadata: Metadata = {
  title: "커뮤니티",
  description: "인사이트·종목분석·공지 게시판. 댓글로 의견을 나눕니다.",
};

const CATEGORIES = ["전체", "포트폴리오 전략", "종목분석", "인컴 투자", "공지"];

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
export default async function BoardPage() {
  const policy = await getSitePolicy();
  if (!policy.communityEnabled) notFound();

  const [flags, posts] = await Promise.all([getSiteFlags(), loadPublishedPosts(100)]);
  const notices = posts.filter((p) => p.type === "NOTICE");
  const list = posts.filter((p) => p.type !== "NOTICE");

  return (
    <>
      <PageHeader
        eyebrow="COMMUNITY"
        title="커뮤니티"
        description="글은 관리자가 작성하고, 회원은 댓글로 참여합니다. 🔒 표시는 댓글이 잠긴 글입니다."
      />

      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10">
        {/* 필터 + 검색 */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
          <div className="flex flex-wrap gap-2 flex-1">
            {CATEGORIES.map((c, i) => (
              <Chip key={c} active={i === 0}>
                {c}
              </Chip>
            ))}
          </div>
          <div className="relative sm:w-64">
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

        {posts.length === 0 ? (
          <EmptyState title="아직 게시글이 없습니다" />
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

        <div className="flex items-center justify-center gap-1.5 mt-8">
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

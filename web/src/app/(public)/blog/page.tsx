import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/Card";
import { loadBlogEntries } from "@/features/blog/repository";
import { BlogEntryRow } from "@/features/blog/ui/BlogEntryRow";
import { TistoryCta } from "@/features/site/ui/TistoryCta";
import { categoryTree, filterByCategory, popularEntries, visibleEntries } from "@/lib/blog/tistory";
import { cx } from "@/lib/format";
import { outboundHref } from "@/lib/outbound";

export const metadata: Metadata = {
  alternates: { canonical: "/blog" },
  title: "블로그 글 전체",
  description: "WoodsMan 티스토리 블로그의 글을 카테고리별로 모았습니다. 요약을 보고 원문으로 이어서 읽을 수 있습니다.",
};

/** ⚠ 정적 생성 금지 — 수집이 새 글을 넣어도 화면이 안 바뀐다. */
export const dynamic = "force-dynamic";

type Search = { c?: string; s?: string; sort?: string };

function href(q: Search): string {
  const p = new URLSearchParams();
  if (q.c) p.set("c", q.c);
  if (q.s) p.set("s", q.s);
  if (q.sort === "popular") p.set("sort", "popular");
  const qs = p.toString();
  return qs ? `/blog?${qs}` : "/blog";
}

function Chip({ to, active, children }: { to: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={to}
      scroll={false}
      aria-current={active ? "page" : undefined}
      className={cx(
        "rounded-full border px-3 py-1.5 text-[12.5px] transition-colors",
        active ? "border-gold-500 bg-gold-500/10 text-ink font-semibold" : "border-border text-muted hover:border-gold-600/40 hover:text-ink",
      )}
    >
      {children}
    </Link>
  );
}

/**
 * 블로그 글 전체 — 티스토리 글을 카테고리별로 훑고 원문으로 넘어가는 화면(2026-09-27).
 * **조립만 한다.** 규칙은 `lib/blog/tistory.ts`, 읽기는 `features/blog/repository.ts`.
 *
 * 순서(UI 권고): 카테고리(무엇이 있나) → 정렬 → 목록 → 블로그 대문.
 * ⚠ 카테고리 칩은 **글 수 많은 순**이고 개수를 같이 적는다 — 무엇이 두꺼운 블로그인지 첫눈에 보인다(힉의 법칙: 고를 것이 많을수록 느리다 → 많은 것부터).
 */
export default async function BlogPage({ searchParams }: { searchParams: Promise<Search> }) {
  const q = await searchParams;
  const all = visibleEntries(await loadBlogEntries());
  const tree = categoryTree(all);
  const top = tree.find((n) => n.name === q.c) ? q.c! : null;
  const topNode = tree.find((n) => n.name === top);
  const sub = topNode?.children.find((c) => c.name === q.s) ? q.s! : null;
  const popular = q.sort === "popular";

  const filtered = filterByCategory(all, top, sub);
  const list = popular ? popularEntries(filtered, filtered.length) : filtered;

  return (
    <>
      <PageHeader
        eyebrow="BLOG"
        title="블로그 글 전체"
        description="티스토리에 쓴 글을 카테고리별로 모았습니다. 요약을 보고, 누르면 원문으로 이어서 읽습니다."
      />

      <section className="mx-auto max-w-4xl px-4 sm:px-6 pb-14">
        {all.length === 0 ? (
          <EmptyState title="아직 모은 글이 없습니다" description="블로그 글 목록은 매일 아침 6시에 모읍니다. 다음 수집 뒤에 보입니다." />
        ) : (
          <>
            <nav aria-label="카테고리" className="flex flex-wrap gap-2">
              <Chip to={href({ sort: q.sort })} active={!top}>
                전체 {all.length}
              </Chip>
              {tree.map((n) => (
                <Chip key={n.name} to={href({ c: n.name, sort: q.sort })} active={top === n.name}>
                  {n.name} {n.count}
                </Chip>
              ))}
            </nav>

            {topNode && topNode.children.length > 0 && (
              <nav aria-label="하위 카테고리" className="mt-2.5 flex flex-wrap gap-2 border-l-2 border-gold-500/40 pl-3">
                <Chip to={href({ c: top!, sort: q.sort })} active={!sub}>
                  {top} 전체
                </Chip>
                {topNode.children.map((c) => (
                  <Chip key={c.name} to={href({ c: top!, s: c.name, sort: q.sort })} active={sub === c.name}>
                    {c.name} {c.count}
                  </Chip>
                ))}
              </nav>
            )}

            <div className="mt-6 flex items-center justify-between gap-3 text-[12.5px]">
              <p className="text-muted">
                {sub ? `${top} · ${sub}` : top ?? "전체"} — <span className="tabular-nums">{list.length}</span>편
                {popular && <span className="text-gray-500"> · 공감이 있는 글만, 티스토리 공감 많은 순</span>}
              </p>
              <div className="flex gap-3">
                <Link href={href({ c: top ?? undefined, s: sub ?? undefined })} scroll={false} className={cx(!popular ? "font-semibold text-ink" : "text-muted hover:text-ink")}>
                  최신순
                </Link>
                <Link href={href({ c: top ?? undefined, s: sub ?? undefined, sort: "popular" })} scroll={false} className={cx(popular ? "font-semibold text-ink" : "text-muted hover:text-ink")}>
                  인기순
                </Link>
              </div>
            </div>

            <div className="mt-3 grid min-w-0 gap-3">
              {list.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-[13px] text-muted">
                  이 분류에는 아직 공감이 달린 글이 없습니다. 최신순으로 보면 전부 보입니다.
                </p>
              ) : (
                list.map((e) => <BlogEntryRow key={e.entryId} entry={e} />)
              )}
            </div>

            {/* 목록을 다 본 사람은 블로그 **대문**으로 — 대표 글 하나가 아니라 구독·검색이 있는 곳이다. */}
            <TistoryCta
              variant="compact"
              className="mt-8"
              headline="블로그 대문에서 더 보기"
              description="구독하면 새 글이 올라올 때 먼저 받아 봅니다."
              href={outboundHref("tistory-home")}
            />
          </>
        )}
      </section>
    </>
  );
}

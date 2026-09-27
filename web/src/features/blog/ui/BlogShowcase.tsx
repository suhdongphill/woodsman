import Link from "next/link";
import { SectionHeader } from "@/components/ui/Card";
import { ChevronRightIcon } from "@/components/icons";
import { outboundBlogHref } from "@/lib/outbound";
import type { BlogEntry } from "@/lib/blog/tistory";
import { BlogEntryRow } from "./BlogEntryRow";

/**
 * 홈 「블로그」 — 최근 글 10편(요약) + 인기 글 5편(2026-09-27 운영자 요청).
 *
 * ## 배치 (UI 권고 — `docs/설계_블로그_목록.md` §3)
 * - 넓은 화면: 왼쪽 2/3 **최근 글**, 오른쪽 1/3 **인기 글**. F자 훑기에서 왼쪽 목록이 먼저 읽히고,
 *   인기 글은 곁눈으로 보는 「다른 길」이다.
 * - 좁은 화면: 최근 글 → 인기 글 순으로 쌓인다.
 * - 맨 끝 「카테고리별 전체 보기」 — 10편 밖을 찾는 사람의 길(`/blog`).
 *
 * ⚠ 모든 링크는 `/go/blog-<번호>` 경유 — 1순위 지표에 잡혀야 한다.
 * ⚠ 인기의 기준(티스토리 공감 수)을 **화면에 적는다** — 숫자가 작은 지금(0~4) 근거를 숨기면 과장이 된다.
 */
export function BlogShowcase({ recent, popular, total }: { recent: BlogEntry[]; popular: BlogEntry[]; total: number }) {
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-14">
      <SectionHeader
        title="블로그 — 최근 글"
        subtitle="티스토리에 쓴 글입니다. 요약을 보고, 누르면 원문으로 갑니다."
        action={
          <Link href="/blog" className="flex shrink-0 items-center gap-0.5 text-xs text-gold-400 hover:text-gold-500">
            카테고리별 전체 {total}편
            <ChevronRightIcon size={13} />
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 lg:col-span-2">
          <div className="divide-y divide-border/70">
            {recent.map((e) => (
              <BlogEntryRow key={e.entryId} entry={e} compact />
            ))}
          </div>
        </div>

        <aside aria-label="인기 글" className="h-fit rounded-2xl border border-border bg-card p-4 sm:p-5">
          <h3 className="text-[15px] font-bold text-ink">인기 글</h3>
          <p className="mt-0.5 text-[11.5px] text-gray-500">기준: 티스토리 공감 수 · 같으면 최신</p>
          {popular.length === 0 ? (
            <p className="mt-3 text-[12.5px] text-muted">아직 공감이 달린 글이 없습니다.</p>
          ) : (
            <ol className="mt-3 space-y-3">
              {popular.map((e, i) => (
                <li key={e.entryId}>
                  <a href={outboundBlogHref(e.entryId)} target="_blank" rel="noopener" className="group flex gap-3">
                    <span className="w-5 shrink-0 text-right text-[15px] font-bold tabular-nums text-gold-500">{i + 1}</span>
                    <span className="min-w-0">
                      <span className="block text-[13.5px] font-semibold leading-snug text-ink transition-colors group-hover:text-gold-400 line-clamp-2">
                        {e.title}
                      </span>
                      <span className="mt-0.5 block text-[11px] tabular-nums text-gray-500">공감 {e.likes}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ol>
          )}
          <Link href="/blog?sort=popular" className="mt-4 inline-flex items-center gap-0.5 text-[12px] text-gold-400 hover:text-gold-500">
            인기순 전체
            <ChevronRightIcon size={12} />
          </Link>
        </aside>
      </div>
    </section>
  );
}

import Link from "next/link";
import type { HomeBriefingDigest, HomeBriefingItem } from "@/lib/briefing/home-digest";
import type { StoredBriefing } from "../repository";
import { briefingDateLabel } from "./BriefingArticleView";

/**
 * 홈 브리핑 블록 — 「오늘의 브리핑」 큰 카드 + 「이번 주 주요 이슈」 목록(2026-11-28 · `docs/설계_홈_섹션계획.md` 1-c).
 * 큰 카드는 제목 · 3줄 요약 · 날짜만, 목록은 날짜 + 제목 첫 문장만 — 본문은 `/briefing/[날짜]`에서.
 * ⚠ 무엇을 올릴지(큰 카드 여부 · 목록 편수 · 첫 문장)는 `lib/briefing/home-digest.ts`가 정한다 — 여기서 다시 판단하지 않는다.
 *    최신이 오래됐으면 큰 카드 없이 제목이 「최근 브리핑」이 된다(운영자 결정 11/28).
 */
export function HomeBriefing({ digest }: { digest: HomeBriefingDigest<StoredBriefing> }) {
  const { featured, list } = digest;
  return (
    <section aria-labelledby="briefing-heading" className="mx-auto max-w-6xl px-4 pb-10 sm:px-6">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="briefing-heading" className="text-[13px] font-semibold tracking-tight text-ink">
          {featured ? (
            <>
              오늘의 브리핑 <span className="font-normal text-ink-3">· {briefingDateLabel(featured.date)}</span>
            </>
          ) : (
            "최근 브리핑"
          )}
        </h2>
        <Link href="/briefing" className="text-[11.5px] text-muted hover:text-gold-500">
          지난 브리핑 →
        </Link>
      </div>

      {featured && <FeaturedCard briefing={featured} />}

      {list.length > 0 && (
        <div className={featured ? "mt-5" : ""}>
          {featured && <h3 className="mb-2 text-[12px] font-semibold text-ink-2">이번 주 주요 이슈</h3>}
          <ul className="divide-y divide-border/70 rounded-2xl border border-border bg-card">
            {list.map((item) => (
              <IssueRow key={item.date} item={item} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function FeaturedCard({ briefing }: { briefing: StoredBriefing }) {
  return (
    <Link
      href={`/briefing/${briefing.date}`}
      className="group block rounded-2xl border border-border bg-card p-5 transition-colors hover:border-gold-500/40"
    >
      <p className="text-[16px] font-semibold leading-snug text-ink group-hover:text-gold-500 sm:text-[17px]">
        {briefing.headline}
      </p>
      {briefing.article.summary.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {briefing.article.summary.map((s, i) => (
            <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-ink-2">
              <span className="text-gold-500">·</span>
              <span>{s}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[12px] font-medium text-gold-500">브리핑 읽기 →</p>
    </Link>
  );
}

function IssueRow({ item }: { item: HomeBriefingItem }) {
  return (
    <li>
      <Link
        href={`/briefing/${item.date}`}
        title={item.title}
        className="group flex items-baseline gap-3 px-4 py-2.5 transition-colors hover:bg-gold-500/5"
      >
        <span className="w-[4.6rem] shrink-0 text-[12.5px] font-semibold tabular-nums text-ink">
          {briefingDateLabel(item.date).slice(5)}
        </span>
        <span className="line-clamp-2 min-w-0 text-[13px] leading-snug text-ink-2 group-hover:text-gold-500 sm:line-clamp-1">{item.title}</span>
      </Link>
    </li>
  );
}

import Link from "next/link";
import type { StoredBriefing } from "../repository";
import { briefingDateLabel } from "./BriefingArticleView";

/**
 * 홈 「오늘의 브리핑」 — 파도(오늘의 기사) 바로 아래(2026-10-31 운영자 요청 · `docs/설계_홈_섹션계획.md` 1-c).
 * 파도는 기관 원문 목록, 이 블록은 그 사건들을 엮은 해설이다. 제목 · 3줄 요약 · 날짜만 싣고 본문은 `/briefing/[날짜]`에서.
 * ⚠ 언제 보일지는 `lib/home-layout.ts`(`isBriefingFresh`)가 정한다 — 여기서 다시 판단하지 않는다.
 */
export function HomeBriefing({ briefing }: { briefing: StoredBriefing }) {
  const href = `/briefing/${briefing.date}`;
  return (
    <section aria-labelledby="briefing-heading" className="mx-auto max-w-6xl px-4 pb-10 sm:px-6">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="briefing-heading" className="text-[13px] font-semibold tracking-tight text-ink">
          오늘의 브리핑 <span className="font-normal text-ink-3">· {briefingDateLabel(briefing.date)}</span>
        </h2>
        <Link href="/briefing" className="text-[11.5px] text-muted hover:text-gold-500">
          지난 브리핑 →
        </Link>
      </div>

      <Link
        href={href}
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
    </section>
  );
}

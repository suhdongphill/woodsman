import type { Metadata } from "next";
import Link from "next/link";
import { AdSlot } from "@/components/analytics/AdSlot";
import { loadPublishedBriefings } from "@/features/briefing/repository";
import { briefingDateLabel } from "@/features/briefing/ui/BriefingArticleView";

export const metadata: Metadata = {
  alternates: { canonical: "/briefing" },
  title: "오늘의 브리핑",
  description: "매일 아침, 지난밤 시장의 큰 줄기와 다음에 확인할 것을 공식 발표·보도·시세로 정리합니다.",
};

/** 관리자가 공개한 날 바로 보이게 — 정적으로 굽지 않는다. */
export const dynamic = "force-dynamic";

export default async function BriefingListPage() {
  const list = await loadPublishedBriefings();

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
      <p className="text-[11px] font-semibold tracking-[0.14em] text-gold-500">DAILY BRIEFING</p>
      <h1 className="mt-2 text-2xl sm:text-[30px] font-bold tracking-tight text-ink">오늘의 브리핑</h1>
      <p className="mt-3 text-[14px] leading-relaxed text-muted">
        지난밤 시장의 큰 줄기와 다음에 확인할 것을 매일 아침 정리합니다. 수치는 공식 발표·보도·시세 기준입니다.
      </p>

      {list.length === 0 ? (
        <p className="mt-10 rounded-xl border border-border bg-card px-4 py-6 text-center text-[13px] text-muted">
          아직 공개된 브리핑이 없습니다.
        </p>
      ) : (
        <ul className="mt-8 divide-y divide-border border-y border-border">
          {list.map((b) => (
            <li key={b.date}>
              <Link href={`/briefing/${b.date}`} className="block py-5 group">
                <p className="text-[11px] text-ink-3">{briefingDateLabel(b.date)}</p>
                <p className="mt-1 text-[16px] font-semibold leading-snug text-ink group-hover:text-gold-500 transition-colors">
                  {b.headline}
                </p>
                {b.article.summary[0] && (
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted line-clamp-2">{b.article.summary[0]}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <AdSlot placement="feed-end" />
    </div>
  );
}

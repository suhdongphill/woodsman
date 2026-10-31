import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdSlot } from "@/components/analytics/AdSlot";
import { ChevronRightIcon } from "@/components/icons";
import { TistoryCta } from "@/features/site/ui/TistoryCta";
import { findBriefing } from "@/features/briefing/repository";
import { BriefingArticleView } from "@/features/briefing/ui/BriefingArticleView";
import { OG_DEFAULT_IMAGES } from "@/lib/site-identity";

type Props = { params: Promise<{ date: string }> };

export const dynamic = "force-dynamic";

async function load(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const b = await findBriefing(date);
  // ⚠ 초안은 공개 화면에 없다 — 관리자 미리보기(/admin/briefing/[date])에서만 본다.
  return b && b.status === "PUBLISHED" ? b : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { date } = await params;
  const b = await load(date);
  if (!b) return { title: "브리핑을 찾을 수 없습니다" };
  const description = b.article.summary.join(" ").slice(0, 160);
  return {
    title: `${b.headline} — 오늘의 브리핑 ${date}`,
    description,
    alternates: { canonical: `/briefing/${date}` },
    openGraph: { title: b.headline, description, type: "article", images: OG_DEFAULT_IMAGES },
  };
}

export default async function BriefingPage({ params }: Props) {
  const { date } = await params;
  const b = await load(date);
  if (!b) notFound();

  return (
    <article className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
      <nav className="mb-6 flex items-center gap-1 text-[11px] text-gray-600">
        <Link href="/briefing" className="hover:text-gold-400 transition-colors">
          오늘의 브리핑
        </Link>
        <ChevronRightIcon size={11} />
        <span className="text-muted">{date}</span>
      </nav>

      <BriefingArticleView article={b.article} />

      {/*
        글을 다 읽은 자리 — ⚠ 티스토리 CTA가 광고보다 위다(운영지침 §4 · CLAUDE.md §5).
        광고는 운영자 요청(10/31 「브리핑 게시글에는 광고가 등재되도록」)으로 그 아래에 둔다.
      */}
      <div className="mt-10">
        <TistoryCta />
      </div>
      <AdSlot placement="article-end" />
    </article>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader, AdminShell } from "@/components/layout/AdminPageHeader";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { requireAdmin } from "@/lib/session";
import { seoulDay } from "@/lib/kst";
import { loadNewsForAdmin } from "@/features/news/repository";
import { setNewsHiddenAction } from "@/features/news/actions";
import { NewsForm } from "@/features/news/ui/NewsForm";

export const metadata: Metadata = { title: "파도 기사" };

/** ⚠ 정적 생성 금지 — 올려도 목록이 안 바뀐다. */
export const dynamic = "force-dynamic";

/**
 * 파도 기사 — 홈 「바람」 아래에 나가는 기사를 관리한다(통합 계획 S3b).
 *
 * - 연준 연설 · FOMC 성명 · 의회 증언 · BLS CPI는 **수집 때 자동으로** 들어온다.
 * - 유가 · 지정학 · 환율 같은 기사는 여기서 **운영자가 올린다** — 제목 · 원문 링크 · 날짜 · 우리 한 줄 요약.
 * - ⚠ 지우지 않고 **숨긴다** — 지우면 다음 자동 수집에 같은 기사가 다시 들어온다.
 */
export default async function AdminNewsPage() {
  await requireAdmin("/admin/news");
  const news = await loadNewsForAdmin(60);
  const today = new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);

  return (
    <AdminShell>
      <AdminPageHeader
        title="파도 기사"
        description="홈 「지금 부는 바람」 아래에 나가는 오늘의 기사입니다. 연준 발언·FOMC·CPI는 자동으로 들어오고, 유가·지정학은 여기서 올립니다."
        action={
          <Link href="/" className="rounded-xl border border-border px-3 py-2 text-[12.5px] text-gray-300 hover:border-gold-600/40 hover:text-ink">
            홈에서 보기
          </Link>
        }
      />

      <Card className="mb-6">
        <CardTitle>기사 올리기</CardTitle>
        <NewsForm today={today} />
      </Card>

      <Card>
        <CardTitle>최근 기사 {news.length}건</CardTitle>
        {news.length === 0 ? (
          <p className="text-[12.5px] text-muted">아직 기사가 없습니다 — 자료 가져오기를 한 번 돌리면 연준·BLS 기사가 들어옵니다.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {news.map((n) => (
              <li key={n.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2.5 text-[12.5px]">
                <Badge tone={n.hidden ? "neutral" : n.source === "MANUAL" ? "warn" : "emerald"}>
                  {n.hidden ? "숨김" : n.source === "MANUAL" ? "운영자" : "자동"}
                </Badge>
                <span className="text-ink-3">{seoulDay(n.publishedAt)}</span>
                <span className="text-ink-3">{n.category}</span>
                <a href={n.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 text-ink hover:text-gold-500">
                  {n.speaker ? `${n.speaker} — ` : ""}
                  {n.title}
                </a>
                <form action={setNewsHiddenAction}>
                  <input type="hidden" name="id" value={n.id} />
                  <input type="hidden" name="hidden" value={n.hidden ? "0" : "1"} />
                  <button type="submit" className="text-[12px] text-gold-500 hover:text-gold-400">
                    {n.hidden ? "다시 보이기" : "숨기기"}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </AdminShell>
  );
}

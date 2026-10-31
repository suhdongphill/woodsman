import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader, AdminShell } from "@/components/layout/AdminPageHeader";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { requireAdmin } from "@/lib/session";
import { loadAllBriefings } from "@/features/briefing/repository";
import { BriefingUploadForm } from "@/features/briefing/ui/BriefingUploadForm";

export const metadata: Metadata = { title: "오늘의 브리핑" };
export const dynamic = "force-dynamic";

/**
 * 오늘의 브리핑 — 원고 올리기 · 목록.
 * 올리면 ① 규칙으로 SNS 출처·채널 평가·내부 칸을 지우고 ② AI가 문장을 다듬어 ③ 초안이 된다. 공개는 미리보기에서.
 */
export default async function AdminBriefingPage() {
  await requireAdmin("/admin/briefing");
  const list = await loadAllBriefings();

  return (
    <AdminShell>
      <AdminPageHeader
        title="오늘의 브리핑"
        description="briefing 폴더의 원고(.md·.html)를 올리면 SNS 출처를 지우고 기사 문체로 다듬어 초안을 만듭니다. 미리보기에서 공개합니다."
      />

      <Card className="mb-6">
        <CardTitle>원고 올리기</CardTitle>
        <div className="mt-4">
          <BriefingUploadForm />
        </div>
      </Card>

      <Card>
        <CardTitle>브리핑 목록</CardTitle>
        {list.length === 0 ? (
          <p className="mt-3 text-[13px] text-muted">아직 올린 브리핑이 없습니다.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {list.map((b) => (
              <li key={b.date} className="flex items-center gap-3 py-3">
                <span className="w-24 shrink-0 font-mono text-[12px] text-muted">{b.date}</span>
                {b.status === "PUBLISHED" ? <Badge tone="emerald">공개</Badge> : <Badge tone="neutral">초안</Badge>}
                <Link
                  href={`/admin/briefing/${b.date}`}
                  className="min-w-0 flex-1 truncate text-[13px] text-ink hover:text-gold-500"
                >
                  {b.headline}
                </Link>
                <span className="shrink-0 text-[11px] text-ink-3">{b.editor}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </AdminShell>
  );
}

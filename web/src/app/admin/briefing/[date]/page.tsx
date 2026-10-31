import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPageHeader, AdminShell } from "@/components/layout/AdminPageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { requireAdmin } from "@/lib/session";
import { findBriefing } from "@/features/briefing/repository";
import { deleteBriefingAction, publishBriefingAction, unpublishBriefingAction } from "@/features/briefing/actions";
import { BriefingArticleView } from "@/features/briefing/ui/BriefingArticleView";

export const metadata: Metadata = { title: "브리핑 미리보기" };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ date: string }> };

const button = "rounded-lg px-3.5 py-2 text-[12.5px] font-semibold";

/** 미리보기 — 공개 화면과 **같은 컴포넌트**로 그린다. ⚠ 공개는 여기서 사람이 누른다. */
export default async function AdminBriefingPreviewPage({ params }: Props) {
  await requireAdmin("/admin/briefing");
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();
  const b = await findBriefing(date);
  if (!b) notFound();

  return (
    <AdminShell>
      <AdminPageHeader title={`브리핑 미리보기 · ${date}`} description={`원고 ${b.sourceName ?? "?"} · ${b.editor}`} />

      <Card className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          {b.status === "PUBLISHED" ? <Badge tone="emerald">공개 중</Badge> : <Badge tone="neutral">초안</Badge>}
          <Link href="/admin/briefing" className="text-[12.5px] text-muted underline">
            목록
          </Link>
          {b.status === "PUBLISHED" ? (
            <>
              <Link href={`/briefing/${date}`} className="text-[12.5px] text-gold-500 underline">
                공개 화면 보기
              </Link>
              <form action={unpublishBriefingAction} className="ml-auto">
                <input type="hidden" name="date" value={date} />
                <button className={`${button} border border-border text-ink`}>내리기</button>
              </form>
            </>
          ) : (
            <>
              <form action={publishBriefingAction} className="ml-auto">
                <input type="hidden" name="date" value={date} />
                <button className={`${button} bg-gold-500 text-onAccent`}>공개하기</button>
              </form>
              <form action={deleteBriefingAction}>
                <input type="hidden" name="date" value={date} />
                <button className={`${button} border border-border text-muted`}>초안 지우기</button>
              </form>
            </>
          )}
        </div>
        {b.editNote.length > 0 && (
          <p className="mt-3 text-[12px] text-muted">
            ⚠ AI가 다듬었다가 원문으로 되돌린 문장 {b.editNote.length}개 —{" "}
            {b.editNote.map((r) => `${r.id}(${r.reason})`).join(" · ")}
          </p>
        )}
      </Card>

      <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-bg px-4 py-8 sm:px-8">
        <BriefingArticleView article={b.article} />
      </div>
    </AdminShell>
  );
}

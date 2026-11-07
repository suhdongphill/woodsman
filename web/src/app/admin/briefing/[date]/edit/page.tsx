import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/layout/AdminPageHeader";
import { requireAdmin } from "@/lib/session";
import { findBriefing } from "@/features/briefing/repository";
import { BriefingEditForm } from "@/features/briefing/ui/BriefingEditForm";

export const metadata: Metadata = { title: "브리핑 수정" };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ date: string }> };

/** 수정 — 왼쪽 칸에서 고치면 오른쪽 미리보기(공개 화면과 같은 컴포넌트)가 바로 바뀐다. */
export default async function AdminBriefingEditPage({ params }: Props) {
  await requireAdmin("/admin/briefing");
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();
  const b = await findBriefing(date);
  if (!b) notFound();

  return (
    // ⚠ AdminShell(max-w-6xl)보다 넓게 — 고치는 칸과 미리보기를 나란히 둔다.
    <div className="px-4 sm:px-6 lg:px-8 py-7">
      <AdminPageHeader title={`브리핑 수정 · ${date}`} description={`원고 ${b.sourceName ?? "?"} · ${b.editor}`} />
      <BriefingEditForm date={date} status={b.status} article={b.article} updatedAt={b.updatedAt} editNote={b.editNote} />
    </div>
  );
}

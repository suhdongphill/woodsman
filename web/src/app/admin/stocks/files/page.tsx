import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader, AdminShell } from "@/components/layout/AdminPageHeader";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { requireAdmin } from "@/lib/session";
import { loadAllReportFiles } from "@/features/reports/file-repo";
import { ReportFileForm } from "@/features/reports/ui/ReportFileForm";

export const metadata: Metadata = { title: "보고서 파일·블로그 연결" };
export const dynamic = "force-dynamic";

/** 종목에 보고서 HTML이나 블로그 글을 잇는다. 공개 종목 카드와 `/stocks`에 나간다. */
export default async function AdminReportFilesPage() {
  await requireAdmin("/admin/stocks/files");
  const list = await loadAllReportFiles();

  return (
    <AdminShell>
      <AdminPageHeader
        title="보고서 파일·블로그 연결"
        description="만들어 둔 보고서 HTML이나 티스토리 글을 종목에 잇습니다. 공개하면 포트폴리오 카드와 종목분석에 나옵니다."
      />

      <Card className="mb-6">
        <CardTitle>연결 추가·수정</CardTitle>
        <div className="mt-4">
          <ReportFileForm />
        </div>
      </Card>

      <Card>
        <CardTitle>연결 목록</CardTitle>
        {list.length === 0 ? (
          <p className="mt-3 text-[13px] text-muted">아직 연결한 보고서가 없습니다.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {list.map((f) => (
              <li key={f.ticker} className="flex flex-wrap items-center gap-3 py-3">
                <span className="w-20 shrink-0 font-mono text-[12px] text-muted">{f.ticker}</span>
                {f.status === "PUBLISHED" ? <Badge tone="emerald">공개</Badge> : <Badge tone="neutral">초안</Badge>}
                <Link
                  href={`/admin/stocks/files/${encodeURIComponent(f.ticker)}`}
                  className="min-w-0 flex-1 truncate text-[13px] text-ink hover:text-gold-500"
                >
                  {f.name} — {f.headline}
                </Link>
                <span className="shrink-0 text-[11px] text-ink-3">
                  {[f.hasHtml && "HTML", f.blogUrl && "블로그"].filter(Boolean).join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </AdminShell>
  );
}

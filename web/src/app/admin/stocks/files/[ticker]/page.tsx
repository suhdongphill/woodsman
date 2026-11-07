import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPageHeader, AdminShell } from "@/components/layout/AdminPageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { requireAdmin } from "@/lib/session";
import { findReportFile } from "@/features/reports/file-repo";
import {
  deleteReportFileAction,
  publishReportFileAction,
  unpublishReportFileAction,
} from "@/features/reports/file-actions";
import { ReportFileView } from "@/features/reports/ui/ReportFileView";

export const metadata: Metadata = { title: "보고서 미리보기" };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ ticker: string }> };

const button = "rounded-lg px-3.5 py-2 text-[12.5px] font-semibold";

/** 미리보기 — 공개 화면과 **같은 컴포넌트**로 그린다. ⚠ 공개는 여기서 사람이 누른다. */
export default async function AdminReportFilePreviewPage({ params }: Props) {
  await requireAdmin("/admin/stocks");
  const { ticker } = await params;
  const file = await findReportFile(decodeURIComponent(ticker));
  if (!file) notFound();

  const hidden = <input type="hidden" name="ticker" value={file.ticker} />;

  return (
    <AdminShell>
      <AdminPageHeader title={`보고서 미리보기 · ${file.name}`} description={`원본 ${file.sourceName ?? "없음"} · ${file.headline}`} />
      <Card className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          {file.status === "PUBLISHED" ? <Badge tone="emerald">공개 중</Badge> : <Badge tone="neutral">초안</Badge>}
          <Link href="/admin/stocks" className="text-[12.5px] text-muted underline">
            목록
          </Link>
          {file.blogUrl && (
            <a href={file.blogUrl} target="_blank" rel="noopener noreferrer" className="text-[12.5px] text-gold-500 underline">
              블로그 글 열기
            </a>
          )}
          {file.status === "PUBLISHED" ? (
            <form action={unpublishReportFileAction} className="ml-auto">
              {hidden}
              <button className={`${button} border border-border text-ink`}>내리기</button>
            </form>
          ) : (
            <>
              <form action={publishReportFileAction} className="ml-auto">
                {hidden}
                <button className={`${button} bg-gold-500 text-onAccent`}>공개하기</button>
              </form>
              <form action={deleteReportFileAction}>
                {hidden}
                <button className={`${button} border border-border text-muted`}>지우기</button>
              </form>
            </>
          )}
        </div>
      </Card>

      {file.html ? (
        <ReportFileView
          ticker={file.ticker}
          name={file.name}
          html={file.html}
          blogUrl={file.blogUrl}
          publishedAt={file.publishedAt}
        />
      ) : (
        <Card>
          <p className="text-[13px] text-muted">
            HTML 없이 블로그만 잇는 연결입니다. 공개하면 포트폴리오 카드의 「블로그 글」이 이 주소로 갑니다.
          </p>
        </Card>
      )}
    </AdminShell>
  );
}

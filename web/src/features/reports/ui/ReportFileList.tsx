import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import type { ReportFileRow } from "../file-repo";

/** 올린 보고서·블로그 연결 목록. 줄을 누르면 미리보기(공개·내리기·지우기)로 간다. */
export function ReportFileList({ files }: { files: ReportFileRow[] }) {
  if (files.length === 0) {
    return <p className="mt-4 border-t border-border/60 pt-3 text-[13px] text-muted">아직 올린 보고서가 없습니다.</p>;
  }
  return (
    <ul className="mt-4 divide-y divide-border border-t border-border/60">
      {files.map((f) => (
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
  );
}

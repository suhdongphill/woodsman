import Link from "next/link";
import { SectionHeader } from "@/components/ui/Card";
import { ChevronRightIcon } from "@/components/icons";
import { JournalTimeline } from "@/features/portfolio/ui/JournalTimeline";
import { ReportCard } from "@/features/reports/ui/ReportCard";
import type { ReportSummary } from "@/features/reports/repository";
import type { JournalEntry } from "@/lib/types";

/**
 * 최근 투자일지 + 종목 보고서.
 *
 * ⚠ 2026-08-15: 목업 종목 4건(지어낸 시세 포함)을 걷어냈다.
 *    발행된 보고서가 없으면 이 자리를 **비운다** — 목업으로 채우면 방문자에게
 *    "이만큼 분석했다"는 거짓 신호를 준다(운영지침 §5).
 */
export function JournalAndReports({
  entries,
  reports,
}: {
  entries: JournalEntry[];
  reports: ReportSummary[];
}) {
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-16 grid lg:grid-cols-2 gap-8">
      <div className="min-w-0">
        <SectionHeader
          title="최근 투자일지"
          action={
            <Link
              href="/journal"
              className="text-xs text-gold-400 hover:text-gold-500 flex items-center gap-0.5 shrink-0"
            >
              전체 기록
              <ChevronRightIcon size={13} />
            </Link>
          }
        />
        <JournalTimeline entries={entries} />
      </div>

      {reports.length > 0 && (
        <div className="min-w-0">
          <SectionHeader
            title="종목 보고서"
            action={
              <Link
                href="/stocks"
                className="text-xs text-gold-400 hover:text-gold-500 flex items-center gap-0.5 shrink-0"
              >
                전체 보기
                <ChevronRightIcon size={13} />
              </Link>
            }
          />
          <div className="grid sm:grid-cols-2 gap-4">
            {reports.map((r) => (
              <ReportCard key={r.ticker} report={r} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

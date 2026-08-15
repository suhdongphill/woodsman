import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { CanslimScore } from "@/components/ui/CanslimScore";
import type { PublishedSummary } from "../repository";

/**
 * 발행된 보고서 카드.
 *
 * ## ⚠ 옛 `StockCard`와 무엇이 다른가
 * 옛 카드는 **현재가·등락률·스파크라인**을 보여줬는데, 그 값들은 전부 `lib/mock`에
 * 손으로 박아 둔 **지어낸 숫자**였다(AAPL 232.6 같은). 숫자를 공개해 신뢰를 얻는 사이트에서
 * 가장 크게 깨지는 지점이다(운영지침 §5).
 *
 * 그래서 이 카드는 **우리가 실제로 가진 것만** 보여준다 — 한 줄 논지, CANSLIM 종합,
 * 다음 판단 시점. 시세는 실데이터가 붙는 단계에서 더한다.
 * ⚠ CANSLIM 종합은 **채점된 축이 없으면 아예 표시하지 않는다.** 0.0으로 그리면 '저조'로 읽힌다.
 */
export function ReportCard({ report }: { report: PublishedSummary }) {
  return (
    <Link
      href={`/stocks/${report.ticker}`}
      className="group flex flex-col bg-card border border-border rounded-2xl p-4 card-hover hover:border-gold-600/40"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate group-hover:text-gold-400 transition-colors">
            {report.name}
          </p>
          <p className="text-[11px] font-mono text-gray-500 mt-0.5">
            {report.ticker} · {report.market === "KR" ? "한국" : "미국"}
          </p>
        </div>
        <CanslimScore score={report.composite10} size="sm" showLabel={false} />
      </div>

      <p className="mt-3 text-[12.5px] leading-relaxed text-muted line-clamp-3">
        {report.headline}
      </p>

      <div className="mt-auto pt-3 flex items-center justify-between gap-2">
        {report.industry ? <Badge tone="neutral">{report.industry}</Badge> : <span />}
        {report.nextCheckAt && (
          <span className="text-[10.5px] text-gray-600 tabular-nums whitespace-nowrap">
            다음 판단 {report.nextCheckAt}
          </span>
        )}
      </div>
    </Link>
  );
}

import Link from "next/link";
import { ChevronRightIcon } from "@/components/icons";
import { formatDate, formatNumber } from "@/lib/format";
import type { JournalAction, JournalEntry } from "@/lib/types";

/**
 * 투자일지 타임라인.
 *
 * 성과 곡선이 "무슨 일이 있었나"라면 여기는 "왜 그렇게 했나"다.
 * 체결 정보(수량·단가)를 같이 보여 주는 이유는, 근거만 있고 숫자가 없으면
 * 사후에 쓴 글과 구분되지 않기 때문이다.
 */

const ACTION: Record<JournalAction, { label: string; className: string; dot: string }> = {
  BUY: {
    label: "매수",
    className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
    dot: "bg-emerald-500",
  },
  SELL: {
    label: "매도",
    className: "border-red-500/40 bg-red-500/10 text-red-400",
    dot: "bg-red-500",
  },
  REBALANCE: {
    label: "리밸런싱",
    className: "border-gold-600/40 bg-gold-500/10 text-gold-400",
    dot: "bg-gold-500",
  },
  NOTE: {
    label: "관찰",
    className: "border-border bg-cardHover text-muted",
    dot: "bg-gray-600",
  },
};

export function JournalTimeline({ entries }: { entries: JournalEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-[13px] text-muted">아직 기록이 없습니다.</p>;
  }

  return (
    <ol className="relative space-y-4 border-l border-border pl-6">
      {entries.map((e) => {
        const meta = ACTION[e.action];
        return (
          <li key={e.id} className="relative">
            <span
              className={`absolute -left-[27px] top-5 h-2.5 w-2.5 rounded-full ring-4 ring-bg ${meta.dot}`}
              aria-hidden="true"
            />
            <article className="rounded-2xl border border-border bg-card p-5 card-hover">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-lg border px-2 py-0.5 text-[11px] font-medium ${meta.className}`}
                >
                  {meta.label}
                </span>
                <time className="text-[11px] text-gray-500" dateTime={e.date}>
                  {formatDate(e.date)}
                </time>
                {e.name && (
                  <span className="text-[11px] text-muted">
                    {e.name}
                    {e.ticker && <span className="ml-1 font-mono text-gray-600">{e.ticker}</span>}
                  </span>
                )}
              </div>

              <h3 className="mt-2.5 text-[15px] font-semibold text-white">{e.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-gray-300">{e.body}</p>

              {e.shares != null && e.price != null && (
                <p className="mt-3 border-t border-border/70 pt-3 text-[12px] text-muted tabular-nums">
                  체결 {e.shares.toLocaleString("ko-KR")}주 ·{" "}
                  {formatNumber(e.price, e.currency ?? "KRW")}
                </p>
              )}

              {e.postSlug && (
                <Link
                  href={`/insights/${e.postSlug}`}
                  className="mt-3 inline-flex items-center gap-0.5 text-[12px] text-gold-400 hover:text-gold-500"
                >
                  관련 인사이트 읽기
                  <ChevronRightIcon size={12} />
                </Link>
              )}
            </article>
          </li>
        );
      })}
    </ol>
  );
}

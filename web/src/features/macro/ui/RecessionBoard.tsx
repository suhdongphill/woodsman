/**
 * 침체 시그널 보드 — "지금 경제는 어떤 상태인가"를 맨 앞에 한 줄로.
 *
 * ## 왜 종합부터 보여주나
 * 지표 5개를 나란히 놓고 "알아서 판단하세요"는 초보자에게 불친절하다.
 * **결론 → 근거** 순서로 둔다. 종합 등급을 먼저 주고, 그 아래 다섯 지표를 편다.
 *
 * ⚠ 이 등급은 읽는 법이지 매매 신호가 아니다. 문구에서 그 선을 넘지 않는다.
 */
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import type { IndicatorView } from "../service";
import type { RecessionSummary } from "@/lib/macro/signal";
import { LevelBadge, SignalPill } from "./SignalPill";

export function RecessionBoard({
  summary,
  signals,
  asOf,
  compact = false,
}: {
  summary: RecessionSummary;
  signals: IndicatorView[];
  asOf?: string;
  /** 홈에서는 촘촘하게, 허브에서는 넉넉하게 */
  compact?: boolean;
}) {
  return (
    <Card padding={compact ? "p-5" : "p-5 sm:p-6"}>
      <div className="flex flex-wrap items-center gap-3">
        <LevelBadge level={summary.level} label={`침체 신호 ${summary.label}`} />
        <span className="text-[11px] text-gray-500">
          {asOf ? `${asOf} 기준` : "수집 전"} · 지표 {summary.total}개
        </span>
      </div>

      <p className="mt-3 text-[13.5px] leading-relaxed text-gray-300">{summary.line}</p>

      <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {signals.map((s) => (
          <li
            key={s.indicator.key}
            className="rounded-xl border border-border bg-[#12141c] px-3 py-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[12px] text-gray-400">{s.indicator.name}</span>
              <SignalPill status={s.status} />
            </div>
            <p className="mt-1 text-[17px] font-bold tabular-nums text-white">{s.display}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-gray-600">
              {s.indicator.signal?.rule}
            </p>
          </li>
        ))}
      </ul>

      {!compact && (
        <p className="mt-4 text-[11.5px] leading-relaxed text-gray-600">
          ※ 다섯 지표는 과거 미국 침체 앞에서 자주 함께 움직였던 것들입니다. 하나가 기준선을
          넘었다고 침체가 오는 것은 아니며, 여기서 내는 것은 <strong>상태 표시</strong>까지입니다.
          투자 판단과 그 결과의 책임은 투자자 본인에게 있습니다.{" "}
          <Link href="/disclaimer" className="underline hover:text-gold-400">
            투자 판단 책임 고지
          </Link>
        </p>
      )}
    </Card>
  );
}

/**
 * 침체 시그널 보드 — "지금 경제는 어떤 상태인가"를 맨 앞에 한 줄로.
 *
 * ## 왜 종합부터 보여주나
 * 지표 5개를 나란히 놓고 "알아서 판단하세요"는 초보자에게 불친절하다.
 * **결론 → 근거** 순서로 둔다. 종합 등급을 먼저 주고, 그 아래 다섯 지표를 편다.
 *
 * ⚠ 이 등급은 읽는 법이지 매매 신호가 아니다. 문구에서 그 선을 넘지 않는다.
 *
 * ## ⚠ 낡은 시그널을 등급 계산에서 빼지 않는다 (2026-08-22)
 * 볼트 사양서 §2-3이 남긴 미해결 결정과 **같은 선택**을 한다 — 낡았다고 조용히 빼면
 * 등급이 요동치고, "값이 없어서 뺀 것"과 "낡아서 뺀 것"이 한 색에 묻힌다.
 * 대신 **그 모순을 화면에 드러낸다**: 낡은 지표는 흐리게·뱃지를 달고, 카드 아래에
 * "이 등급은 그 옛 값을 그대로 세어 나온 결과"라고 적는다.
 * ⚠ 두 화면이 다른 판단을 하면 나란히 놓고 대조할 수 없다. 볼트가 결정을 바꾸면 같이 바꾼다.
 */
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { cx } from "@/lib/format";
import type { IndicatorView } from "../service";
import type { RecessionSummary } from "@/lib/macro/signal";
import { LevelBadge, SignalPill } from "./SignalPill";
import { FreshnessBadge, LayerChip } from "./Freshness";

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
  const staleSignals = signals.filter((s) => s.freshness.stale || s.freshness.stalled).length;

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
            className={cx(
              "rounded-xl border border-border bg-bg px-3 py-2.5",
              (s.freshness.stale || s.freshness.stalled) && "border-amber-500/25",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5">
                <LayerChip layer={s.indicator.layer} />
                <span className="truncate text-[12px] text-gray-400">{s.indicator.name}</span>
              </span>
              <SignalPill status={s.status} />
            </div>
            <p
              className={cx(
                "mt-1 text-[17px] font-bold tabular-nums text-ink",
                (s.freshness.stale || s.freshness.stalled) && "opacity-55",
              )}
            >
              {s.display}
            </p>
            {/*
              ⚠ 시그널마다 기준일을 낸다. 이 다섯 개가 경보 등급을 만드는 입력이라,
                여기가 낡으면 **등급 자체가 옛 상태를 가리킨다**(볼트 §2-3).
            */}
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[10.5px] text-gray-600">
              <span className={cx(s.freshness.stale && "text-amber-300/80")}>
                {s.asOf ? `${s.asOf} 기준` : "수집 전"}
              </span>
              <FreshnessBadge freshness={s.freshness} />
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-gray-600">
              {s.indicator.signal?.rule}
            </p>
          </li>
        ))}
      </ul>

      {staleSignals > 0 && (
        <p className="mt-3 text-[11.5px] leading-relaxed text-amber-200/80">
          ⚠ 이 중 <strong>{staleSignals}개</strong>가 갱신 기한을 넘긴 값입니다.{" "}
          <strong>경보 등급은 그 옛 값을 그대로 세어 나온 결과</strong>입니다 — 낡았다고 조용히
          빼면 등급이 요동치고 왜 바뀌었는지 알 수 없게 되므로, 빼지 않고 이렇게 알립니다.
        </p>
      )}

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

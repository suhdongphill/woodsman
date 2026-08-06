/**
 * 버블 점수 게이지 — 결론을 맨 앞에.
 *
 * ⚠ 색만으로 국면을 전하지 않는다. 구간 이름(확장·주의·경계·위험·붕괴 초기)을 글자로 쓰고,
 *    커버리지 문장을 항상 함께 낸다 — 점수 하나만 크게 띄우면 그 숫자가 사실처럼 굳는다.
 */
import { cx } from "@/lib/format";
import { coverageNotice } from "@/lib/bubble/score";
import type { BubbleScore } from "@/lib/bubble/score";

const TONE: Record<string, string> = {
  "확장 (Risk-On)": "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  주의: "border-emerald-500/30 bg-emerald-500/[0.07] text-emerald-200",
  경계: "border-yellow-500/40 bg-yellow-500/10 text-yellow-300",
  위험: "border-orange-500/40 bg-orange-500/10 text-orange-300",
  "붕괴 초기": "border-red-500/40 bg-red-500/10 text-red-300",
};

export function ScoreGauge({ score }: { score: BubbleScore }) {
  const tone = score.band ? TONE[score.band.regime] ?? "" : "border-border bg-white/5 text-gray-400";

  return (
    <div className={cx("rounded-2xl border p-5 sm:p-6", tone)}>
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-wide opacity-80">버블 점수</p>
          <p className="mt-1 text-4xl font-bold tabular-nums">
            {score.score ?? "—"}
            <span className="ml-1 text-base font-normal opacity-70">/ 100</span>
          </p>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold">{score.band?.regime ?? "판정 전"}</p>
          <p className="text-[12.5px] opacity-90">{score.band?.stance ?? "채점된 지표가 없습니다"}</p>
        </div>
      </div>

      {/* 눈금 — 점수가 어느 구간에 있는지 막대로 */}
      {score.score !== undefined && (
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-black/30">
          <div
            className="h-full rounded-full bg-current opacity-80"
            style={{ width: `${score.score}%` }}
          />
        </div>
      )}

      <p className="mt-3 text-[11.5px] leading-relaxed opacity-80">
        {coverageNotice(score.coverage)}
      </p>

      {score.priorityFired && (
        <p className="mt-3 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-[12.5px] leading-relaxed text-red-200">
          <strong>우선 경보</strong> · {score.priorityText}
        </p>
      )}
    </div>
  );
}

/**
 * 지표 상태 표시.
 *
 * ⚠ **색만으로 뜻을 전하지 않는다.** 색각 이상인 사람에게 초록/빨강은 같은 색이고,
 *    흑백 인쇄나 강한 햇빛 아래서도 색은 사라진다. 그래서 항상
 *    **모양(●▲■) + 글자(정상/주의/경고)**를 함께 붙인다.
 *
 * '미수집'을 따로 둔 이유: 값을 못 읽은 것을 '정상'으로 칠하면 조용한 실패가 된다.
 */
import { cx } from "@/lib/format";
import { SIGNAL_LABEL, type SignalStatus } from "@/lib/macro/signal";
import type { RecessionLevel } from "@/lib/macro/signal";

const STYLE: Record<SignalStatus, { box: string; mark: string }> = {
  normal: { box: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300", mark: "●" },
  watch: { box: "border-yellow-500/30 bg-yellow-500/10 text-yellow-300", mark: "▲" },
  alert: { box: "border-red-500/40 bg-red-500/10 text-red-300", mark: "■" },
  unknown: { box: "border-border bg-white/5 text-gray-400", mark: "○" },
};

export function SignalPill({
  status,
  className,
}: {
  status: SignalStatus;
  className?: string;
}) {
  const s = STYLE[status];
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium leading-5 whitespace-nowrap",
        s.box,
        className,
      )}
    >
      <span aria-hidden="true">{s.mark}</span>
      {SIGNAL_LABEL[status]}
    </span>
  );
}

const LEVEL_STYLE: Record<RecessionLevel, string> = {
  calm: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  watch: "border-yellow-500/30 bg-yellow-500/10 text-yellow-300",
  caution: "border-orange-500/40 bg-orange-500/10 text-orange-300",
  danger: "border-red-500/40 bg-red-500/10 text-red-300",
  unknown: "border-border bg-white/5 text-gray-400",
};

/** 침체 시그널 종합 등급 — 홈과 허브의 맨 앞에 나온다. */
export function LevelBadge({
  level,
  label,
  className,
}: {
  level: RecessionLevel;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-lg border px-3 py-1 text-[13px] font-bold",
        LEVEL_STYLE[level],
        className,
      )}
    >
      {label}
    </span>
  );
}

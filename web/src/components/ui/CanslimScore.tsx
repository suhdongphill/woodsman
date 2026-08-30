import { cx, scoreColor } from "@/lib/format";

/** CANSLIM 종합점수 뱃지 — 점수대별 색상은 기존 scoreColor() 규칙 그대로 */
export function CanslimScore({
  score,
  size = "md",
  showLabel = true,
}: {
  score?: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}) {
  if (score == null) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-gray-600">
        CANSLIM –
      </span>
    );
  }
  const c = scoreColor(score);
  const dims =
    size === "sm"
      ? "text-[11px] px-1.5 py-0.5 gap-1"
      : size === "lg"
        ? "text-lg px-3 py-1.5 gap-1.5 font-bold"
        : "text-xs px-2 py-1 gap-1.5";
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-lg border font-semibold",
        c.text,
        c.border,
        c.soft,
        dims,
      )}
    >
      {showLabel && <span className="opacity-70 font-normal">CANSLIM</span>}
      {score.toFixed(1)}
    </span>
  );
}

/** 원형 게이지 형태 (상세 페이지용) */
export function CanslimDial({ score }: { score: number }) {
  const c = scoreColor(score);
  const pct = Math.max(0, Math.min(10, score)) / 10;
  const r = 34;
  const circ = 2 * Math.PI * r;
  return (
    <div className="relative w-24 h-24 shrink-0">
      <svg viewBox="0 0 80 80" className="w-24 h-24 -rotate-90">
        <circle cx="40" cy="40" r={r} style={{ stroke: "var(--w-border)" }} strokeWidth="7" fill="none" />
        <circle
          cx="40"
          cy="40"
          r={r}
          stroke="currentColor"
          className={c.text}
          strokeWidth="7"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circ * pct} ${circ}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cx("text-2xl font-bold", c.text)}>{score.toFixed(1)}</span>
        <span className="text-[10px] text-gray-500">/ 10</span>
      </div>
    </div>
  );
}

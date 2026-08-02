import { cx } from "@/lib/format";

export type StatSegment = {
  label: string;
  value: number;
  color: string;
};

/** 기능별(성장/인컴/방어) 배분 바 + 범례 */
export function StatBar({
  segments,
  showLegend = true,
  height = "h-2.5",
  className,
}: {
  segments: StatSegment[];
  showLegend?: boolean;
  height?: string;
  className?: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <div className={className}>
      <div className={cx("flex w-full overflow-hidden rounded-full bg-[#12141c]", height)}>
        {segments.map((s) => (
          <div
            key={s.label}
            style={{ width: `${(s.value / total) * 100}%`, backgroundColor: s.color }}
            title={`${s.label} ${((s.value / total) * 100).toFixed(1)}%`}
          />
        ))}
      </div>
      {showLegend && (
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3">
          {segments.map((s) => (
            <div key={s.label} className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: s.color }}
              />
              <span className="text-xs text-muted">{s.label}</span>
              <span className="text-xs font-semibold text-white">
                {((s.value / total) * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** 숫자 요약 타일 */
export function StatTile({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "up" | "down" | "gold";
}) {
  const valueColor =
    tone === "up"
      ? "text-emerald-400"
      : tone === "down"
        ? "text-red-400"
        : tone === "gold"
          ? "text-gold-400"
          : "text-white";
  return (
    <div className="bg-card border border-border rounded-xl px-4 py-3.5">
      <p className="text-[11px] text-muted">{label}</p>
      <p className={cx("text-xl font-bold mt-1 tabular-nums", valueColor)}>{value}</p>
      {sub && <p className="text-[11px] text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

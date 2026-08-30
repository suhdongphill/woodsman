import type { StatSegment } from "./StatBar";

/**
 * 목업용 도넛 — conic-gradient 기반(라이브러리 없이 SSR 안전).
 * Phase 4에서 Recharts 도넛으로 교체된다.
 */
export function Donut({
  segments,
  size = 176,
  centerLabel,
  centerSub,
}: {
  segments: StatSegment[];
  size?: number;
  centerLabel?: string;
  centerSub?: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let acc = 0;
  const stops = segments.map((s) => {
    const from = (acc / total) * 360;
    acc += s.value;
    const to = (acc / total) * 360;
    return `${s.color} ${from.toFixed(2)}deg ${to.toFixed(2)}deg`;
  });

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className="rounded-full"
        style={{
          width: size,
          height: size,
          background: `conic-gradient(${stops.join(",")})`,
        }}
      />
      <div
        className="absolute rounded-full bg-card border border-border flex flex-col items-center justify-center"
        style={{
          inset: size * 0.16,
        }}
      >
        {centerLabel && <span className="text-2xl font-bold text-ink">{centerLabel}</span>}
        {centerSub && <span className="text-[10px] text-gray-500 mt-0.5">{centerSub}</span>}
      </div>
    </div>
  );
}

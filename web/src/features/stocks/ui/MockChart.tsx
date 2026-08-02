import { Badge } from "@/components/ui/Badge";

/**
 * Phase 0 목업 차트 — 인라인 SVG.
 * Phase 7에서 lightweight-charts / TradingView 위젯 + 서버 시세 프록시로 교체된다.
 */
export function MockChart({
  series,
  up,
  height = 260,
}: {
  series: { t: string; v: number }[];
  up: boolean;
  height?: number;
}) {
  const W = 800;
  const H = height;
  const values = series.map((s) => s.v);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = W / (series.length - 1);

  const pt = (v: number, i: number) => {
    const x = i * step;
    const y = H - 24 - ((v - min) / span) * (H - 48);
    return [x, y] as const;
  };

  const line = series.map((s, i) => pt(s.v, i).join(",")).join(" ");
  const area = `0,${H} ${line} ${W},${H}`;
  const stroke = up ? "#56b98a" : "#ef4444";
  const fill = up ? "rgba(54,160,106,.16)" : "rgba(239,68,68,.14)";

  // 20일 이동평균 (결정적)
  const ma = series.map((_, i) => {
    const from = Math.max(0, i - 19);
    const slice = values.slice(from, i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
  const maLine = ma.map((v, i) => pt(v, i).join(",")).join(" ");

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-white">가격 차트</h3>
          <Badge tone="neutral">90일</Badge>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="flex items-center gap-1 text-muted">
            <span className="w-3 h-0.5 rounded" style={{ background: stroke }} />
            종가
          </span>
          <span className="flex items-center gap-1 text-muted">
            <span className="w-3 h-0.5 rounded bg-gold-500" />
            MA20
          </span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height }}
        preserveAspectRatio="none"
        aria-label="가격 차트(목업)"
      >
        {[0.25, 0.5, 0.75].map((r) => (
          <line
            key={r}
            x1="0"
            x2={W}
            y1={H * r}
            y2={H * r}
            stroke="#2a2e3a"
            strokeWidth="1"
            strokeDasharray="4 6"
          />
        ))}
        <polygon points={area} fill={fill} />
        <polyline points={line} fill="none" stroke={stroke} strokeWidth="2" />
        <polyline
          points={maLine}
          fill="none"
          stroke="#c9a657"
          strokeWidth="1.5"
          strokeDasharray="5 4"
        />
      </svg>

      <div className="mt-3 flex justify-between text-[10px] text-gray-600 tabular-nums">
        <span>{series[0]?.t}</span>
        <span>{series[Math.floor(series.length / 2)]?.t}</span>
        <span>{series[series.length - 1]?.t}</span>
      </div>

      <p className="mt-4 pt-3 border-t border-border/70 text-[11px] text-gray-600">
        ※ Phase 0 목업 차트입니다. Phase 7에서 lightweight-charts·TradingView 위젯과 서버
        시세 프록시로 교체됩니다.
      </p>
    </div>
  );
}

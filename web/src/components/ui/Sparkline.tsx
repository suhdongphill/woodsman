/** 종가 배열 → 미니 스파크라인 (SSR 안전: 난수·시간 미사용) */
export function Sparkline({
  data,
  up,
  width = 88,
  height = 28,
}: {
  data: number[];
  up: boolean;
  width?: number;
  height?: number;
}) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const step = width / (data.length - 1);
  const pts = data.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / span) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  // ⚠ 한국식 등락: 상승 적 · 하락 청. 색 단독으로 읽히지 않게 부르는 쪽이 값을 함께 낸다.
  const color = up ? "var(--w-up)" : "var(--w-down)";
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline
        points={pts.join(" ")}
        fill="none"
        style={{ stroke: color }}
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

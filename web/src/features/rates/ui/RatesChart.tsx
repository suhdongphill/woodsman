/**
 * 금리 섹션 차트 — **서버에서 그리는 SVG**. 라이브러리도, 클라이언트 자바스크립트도 없다.
 *
 * 기존 `macro/ui/SeriesChart`와 같은 방식이되 이 섹션이 요구하는 셋을 더했다(명세 §6).
 * - **여러 선**을 겹쳐 그린다(명목·인플레·실질).
 * - ⚠ **결측에서 선을 끊는다.** `lib/rates.ts`의 `linePath`가 그 일을 한다.
 * - **분기 계열은 계단(step)으로** 그려 월간 계열과 구분한다 — 같은 실선으로 그리면
 *   분기값이 매달 관측된 것처럼 보인다.
 * - 목표선·중립금리선은 **점선 + 라벨**.
 *
 * ⚠ 축은 0을 자르지 않는다. 자를 때는 축에 그렇게 적는다.
 * ⚠ SVG의 `fill=`/`stroke=` **속성**은 `var()`를 못 읽는다. 반드시 `style`로 준다.
 */
import { bounds, linePath, type RatesObservation } from "@/lib/rates";

const W = 720;
const H = 200;
const PAD = { top: 14, right: 16, bottom: 24, left: 52 };

const GRID = "var(--w-border)";
const BASE = "var(--w-ink-3)";
const PALETTE = ["var(--w-series-3)", "var(--w-series-1)", "var(--w-series-2)"];

export type ChartLine = {
  label: string;
  observations: RatesObservation[];
  /** 분기 계열은 계단으로 — 월간과 눈으로 구분되게 */
  step?: boolean;
};

export type ChartGuide = { value: number; label: string };

export function RatesChart({
  lines,
  guides = [],
  format,
  ariaLabel,
}: {
  lines: ChartLine[];
  guides?: ChartGuide[];
  format: (value: number) => string;
  ariaLabel: string;
}) {
  const drawable = lines.filter((l) => l.observations.some(([, v]) => v !== null));
  if (drawable.length === 0) {
    return (
      <p className="py-6 text-center text-[12px] text-gray-500">
        아직 그릴 값이 없습니다. <code>pms rates fetch</code> 뒤에 이 자리에 흐름이 그려집니다.
      </p>
    );
  }

  // 가장 긴 계열을 x축의 기준으로 삼는다.
  const spine = drawable.reduce((a, b) => (b.observations.length > a.observations.length ? b : a));
  const allValues = drawable.flatMap((l) => l.observations.map(([, v]) => v));
  const { min, max } = bounds(allValues, guides.map((g) => g.value));

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (plotW * i) / Math.max(1, spine.observations.length - 1);
  const y = (v: number) => PAD.top + plotH - (plotH * (v - min)) / (max - min);

  /** 계단선 — 다음 관측까지 값을 유지한다(분기 계열). */
  const stepPath = (observations: RatesObservation[]) => {
    const parts: string[] = [];
    let prevY: number | null = null;
    observations.forEach(([, value], index) => {
      if (value === null) {
        prevY = null;
        return;
      }
      const px = x(index);
      const py = y(value);
      if (prevY === null) parts.push(`M${px.toFixed(1)},${py.toFixed(1)}`);
      else parts.push(`L${px.toFixed(1)},${prevY.toFixed(1)} L${px.toFixed(1)},${py.toFixed(1)}`);
      prevY = py;
    });
    return parts.join(" ");
  };

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={ariaLabel}>
        <line x1={PAD.left} y1={PAD.top} x2={W - PAD.right} y2={PAD.top} strokeWidth="1" style={{ stroke: GRID }} />
        <line
          x1={PAD.left}
          y1={PAD.top + plotH}
          x2={W - PAD.right}
          y2={PAD.top + plotH}
          strokeWidth="1"
          style={{ stroke: GRID }}
        />

        {/* 목표선·중립금리선 — 점선 + 라벨(명세 §6) */}
        {guides
          .filter((g) => g.value > min && g.value < max)
          .map((guide) => (
            <g key={guide.label}>
              <line
                x1={PAD.left}
                y1={y(guide.value)}
                x2={W - PAD.right}
                y2={y(guide.value)}
                strokeWidth="1"
                strokeDasharray="4 4"
                style={{ stroke: BASE }}
              />
              <text
                x={W - PAD.right}
                y={y(guide.value) - 5}
                textAnchor="end"
                fontSize="10"
                style={{ fill: BASE }}
              >
                {guide.label}
              </text>
            </g>
          ))}

        {/* 축 값 — 최소로 둔다(위·아래 둘) */}
        <text x={PAD.left - 6} y={PAD.top + 4} textAnchor="end" fontSize="10" style={{ fill: BASE }}>
          {format(max)}
        </text>
        <text x={PAD.left - 6} y={PAD.top + plotH} textAnchor="end" fontSize="10" style={{ fill: BASE }}>
          {format(min)}
        </text>

        {drawable.map((line, index) => (
          <path
            key={line.label}
            d={line.step ? stepPath(line.observations) : linePath(line.observations, x, y)}
            fill="none"
            strokeWidth="1.8"
            strokeLinejoin="round"
            style={{ stroke: PALETTE[index % PALETTE.length] }}
          />
        ))}
      </svg>

      <figcaption className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
        {drawable.map((line, index) => (
          <span key={line.label} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-[2px] w-4"
              style={{ background: PALETTE[index % PALETTE.length] }}
            />
            {line.label}
            {line.step && <span className="text-ink-3">(분기 · 계단)</span>}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

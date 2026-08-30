/**
 * 거시 지표 시계열 차트 — **서버에서 그리는 SVG**.
 *
 * ## 왜 클라이언트 컴포넌트가 아닌가
 * 이 화면은 검색으로 들어온 사람이 처음 보는 페이지다. 차트를 자바스크립트로 그리면
 * 크롤러와 느린 기기에서 **빈 상자**가 된다. 서버에서 SVG로 그려 두면 HTML 안에 그림이
 * 들어 있고, 스크립트가 없어도 보인다.
 *
 * ## 초보자를 위해 정한 것
 * - 축 숫자를 최소로 둔다(최고·최저·마지막). 눈금이 많을수록 못 읽는다.
 * - **기준선**(0%, 50 같은 경계값)이 있으면 점선으로 긋고 이름을 붙인다.
 *   "0 아래면 역전"을 말로만 하면 그림에서 어디가 0인지 못 찾는다.
 * - 마지막 점에 원을 찍는다 — "지금 여기"가 어디인지 한눈에 보이게.
 * - 색만으로 뜻을 전하지 않는다. 상태는 카드의 배지가 글자로 말한다.
 * - `role="img"` + `aria-label`로 화면 낭독기에도 요약을 준다.
 */
import { cx } from "@/lib/format";
import type { SeriesPoint } from "@/lib/macro/series";

const W = 720;
const H = 180;
const PAD = { top: 14, right: 14, bottom: 22, left: 46 };

/** ⚠ SVG의 fill=/stroke= **속성**은 var()를 못 읽는다. 반드시 style로 준다. */
const LINE = "var(--w-series-3)";
const AREA = "color-mix(in oklab, var(--w-series-3) 14%, transparent)";
const GRID = "var(--w-border)";
const BASE = "var(--w-ink-3)";

function niceBounds(values: number[], baseline?: number): { min: number; max: number } {
  const all = baseline === undefined ? values : [...values, baseline];
  let min = Math.min(...all);
  let max = Math.max(...all);
  if (min === max) {
    // 평평한 계열도 선이 보이게 위아래로 벌린다.
    const pad = Math.abs(min) * 0.05 || 1;
    min -= pad;
    max += pad;
  }
  const margin = (max - min) * 0.12;
  return { min: min - margin, max: max + margin };
}

export function SeriesChart({
  points,
  label,
  format,
  baseline,
  baselineLabel,
  className,
}: {
  points: SeriesPoint[];
  /** 화면 낭독기용 지표 이름 */
  label: string;
  /** 값 → 문자열 (단위·자릿수는 카탈로그가 정한다) */
  format: (value: number) => string;
  /** 의미가 있는 경계값. 0(증감) · 50(PMI) 처럼 */
  baseline?: number;
  baselineLabel?: string;
  className?: string;
}) {
  if (points.length < 2) {
    return (
      <p className={cx("py-6 text-center text-[12px] text-gray-500", className)}>
        아직 그릴 만큼 값이 쌓이지 않았습니다. 자료를 가져오면 이 자리에 흐름이 그려집니다.
      </p>
    );
  }

  const values = points.map((p) => p.value);
  const { min, max } = niceBounds(values, baseline);
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const x = (i: number) => PAD.left + (plotW * i) / (points.length - 1);
  const y = (v: number) => PAD.top + plotH - (plotH * (v - min)) / (max - min);

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)},${(PAD.top + plotH).toFixed(1)} L${PAD.left},${(PAD.top + plotH).toFixed(1)} Z`;

  const first = points[0];
  const last = points[points.length - 1];
  const hi = points.reduce((a, b) => (b.value > a.value ? b : a));
  const lo = points.reduce((a, b) => (b.value < a.value ? b : a));

  return (
    <figure className={cx("m-0", className)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label={`${label} 추이 그래프. ${first.date}부터 ${last.date}까지, 최고 ${format(hi.value)}, 최저 ${format(lo.value)}, 최근 ${format(last.value)}.`}
      >
        {/* 위·아래 눈금선 */}
        <line x1={PAD.left} y1={PAD.top} x2={W - PAD.right} y2={PAD.top} strokeWidth="1" style={{ stroke: GRID }} />
        <line
          x1={PAD.left}
          y1={PAD.top + plotH}
          x2={W - PAD.right}
          y2={PAD.top + plotH}
          style={{ stroke: GRID }}
          strokeWidth="1"
        />

        {/* 기준선 — 그림 안에서 '경계가 어디인지'를 보여준다 */}
        {baseline !== undefined && baseline > min && baseline < max && (
          <>
            <line
              x1={PAD.left}
              y1={y(baseline)}
              x2={W - PAD.right}
              y2={y(baseline)}
              style={{ stroke: BASE }}
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <text
              x={W - PAD.right}
              y={y(baseline) - 5}
              textAnchor="end"
              className="fill-[var(--w-ink-3)] text-[11px]"
            >
              {baselineLabel ?? format(baseline)}
            </text>
          </>
        )}

        <path d={area} style={{ fill: AREA }} />
        <path d={line} fill="none" strokeWidth="2" style={{ stroke: LINE }} strokeLinejoin="round" strokeLinecap="round" />

        {/* 지금 여기 */}
        <circle cx={x(points.length - 1)} cy={y(last.value)} r="4" style={{ fill: LINE }} />

        {/* 축 — 최고·최저·기간만 */}
        <text x={PAD.left - 8} y={y(hi.value) + 4} textAnchor="end" className="fill-[var(--w-ink-3)] text-[11px] tabular-nums">
          {format(hi.value)}
        </text>
        <text x={PAD.left - 8} y={y(lo.value) + 4} textAnchor="end" className="fill-[var(--w-ink-3)] text-[11px] tabular-nums">
          {format(lo.value)}
        </text>
        <text x={PAD.left} y={H - 6} className="fill-[var(--w-ink-3)] text-[11px] tabular-nums">
          {first.date}
        </text>
        <text x={W - PAD.right} y={H - 6} textAnchor="end" className="fill-[var(--w-ink-3)] text-[11px] tabular-nums">
          {last.date}
        </text>
      </svg>
      <figcaption className="mt-1 text-[11px] text-gray-600">
        {first.date}부터 {points.length.toLocaleString("ko-KR")}개 기록 · 최고 {format(hi.value)}(
        {hi.date}) · 최저 {format(lo.value)}({lo.date})
      </figcaption>
    </figure>
  );
}

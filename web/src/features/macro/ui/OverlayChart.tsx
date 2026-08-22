/**
 * 오버레이 차트 — 여러 계열을 한 시간축에 겹쳐 그리는 **서버 SVG**.
 *
 * `SeriesChart`와 같은 이유로 서버에서 그린다. 다만 여기엔 규칙이 몇 개 더 있다.
 *
 * ## ⚠ 축은 하나뿐이다
 * 이중축을 그리면 눈금 조정만으로 아무 결론이나 만들 수 있다. 그래서 단위가 다른 계열은
 * `lib/macro/overlay.ts`가 **환산한 뒤에만** 여기로 온다. 이 컴포넌트는 축을 늘리지 않는다.
 *
 * ## ⚠ 색만으로 계열을 식별하게 두지 않는다
 * 선마다 **끝점에 이름표**를 달고, 범례에 모양(●▲■◆)을 함께 쓰고, 화면 아래에 **표**를 낸다.
 * 색각 이상인 사람에게 네 색은 두 색으로 보인다.
 *
 * ## ⚠ 날짜가 없는 구간은 선을 잇지 않는다
 * 시작이 늦은 계열의 앞 구간을 0으로 채우면 그림에 **없는 사건**이 생긴다. 비워 둔다.
 */
import { cx } from "@/lib/format";
import type { OverlayLine } from "@/lib/macro/overlay";

const W = 760;
const H = 260;
const PAD = { top: 16, right: 96, bottom: 26, left: 52 };

/** ⚠ 색은 보조 수단이다. 순서는 명도 차이가 나게 골랐다(흑백에서도 갈린다). */
export const OVERLAY_COLORS = ["#7fb2ff", "#f0b429", "#4ade80", "#f87171"];
export const OVERLAY_MARKS = ["●", "▲", "■", "◆"];

const GRID = "#2a2e3a";

export function OverlayChart({
  lines,
  className,
}: {
  lines: OverlayLine[];
  className?: string;
}) {
  if (lines.length === 0) {
    return (
      <p className={cx("py-10 text-center text-[12.5px] text-gray-500", className)}>
        지표를 두 개 이상 고르면 여기에 겹쳐 그립니다.
      </p>
    );
  }

  const dates = [...new Set(lines.flatMap((l) => l.points.map((p) => p.date)))].sort();
  if (dates.length < 2) {
    return (
      <p className={cx("py-10 text-center text-[12.5px] text-gray-500", className)}>
        고른 지표에 아직 그릴 만큼 값이 쌓이지 않았습니다.
      </p>
    );
  }

  const index = new Map(dates.map((d, i) => [d, i]));
  const values = lines.flatMap((l) => l.points.map((p) => p.value));
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    const pad = Math.abs(min) * 0.05 || 1;
    min -= pad;
    max += pad;
  }
  const margin = (max - min) * 0.1;
  min -= margin;
  max += margin;

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (date: string) => PAD.left + (plotW * (index.get(date) ?? 0)) / (dates.length - 1);
  const y = (v: number) => PAD.top + plotH - (plotH * (v - min)) / (max - min);

  const fmt = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2));

  return (
    <figure className={cx("m-0", className)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`${lines.map((l) => l.label).join(", ")} 겹쳐 보기. ${dates[0]}부터 ${dates[dates.length - 1]}까지. 자세한 값은 아래 표에 있습니다.`}
      >
        <line x1={PAD.left} y1={PAD.top} x2={W - PAD.right} y2={PAD.top} stroke={GRID} />
        <line
          x1={PAD.left}
          y1={PAD.top + plotH}
          x2={W - PAD.right}
          y2={PAD.top + plotH}
          stroke={GRID}
        />

        {lines.map((line, i) => {
          const color = OVERLAY_COLORS[i % OVERLAY_COLORS.length];
          // ⚠ 값이 없는 날은 M으로 끊는다 — 이어 그리면 없는 관측을 만들어 낸다.
          let prev: string | null = null;
          const d = line.points
            .map((p) => {
              const cmd = prev === null || (index.get(p.date) ?? 0) - (index.get(prev) ?? 0) > 1 ? "M" : "L";
              prev = p.date;
              return `${cmd}${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`;
            })
            .join(" ");
          const last = line.points[line.points.length - 1];

          return (
            <g key={line.key}>
              <path
                d={d}
                fill="none"
                stroke={color}
                strokeWidth="1.8"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {last && <circle cx={x(last.date)} cy={y(last.value)} r="3.5" fill={color} />}
              {/* ⚠ 끝점 이름표 — 색을 못 봐도 어느 선인지 알 수 있게 */}
              {last && (
                <text
                  x={W - PAD.right + 6}
                  y={y(last.value) + 4}
                  className="text-[11px]"
                  fill={color}
                >
                  {line.label.length > 9 ? `${line.label.slice(0, 9)}…` : line.label}
                </text>
              )}
            </g>
          );
        })}

        <text x={PAD.left - 8} y={PAD.top + 4} textAnchor="end" className="fill-[#8a97ac] text-[11px] tabular-nums">
          {fmt(max)}
        </text>
        <text
          x={PAD.left - 8}
          y={PAD.top + plotH + 4}
          textAnchor="end"
          className="fill-[#8a97ac] text-[11px] tabular-nums"
        >
          {fmt(min)}
        </text>
        <text x={PAD.left} y={H - 7} className="fill-[#6c809e] text-[11px] tabular-nums">
          {dates[0]}
        </text>
        <text
          x={W - PAD.right}
          y={H - 7}
          textAnchor="end"
          className="fill-[#6c809e] text-[11px] tabular-nums"
        >
          {dates[dates.length - 1]}
        </text>
      </svg>
    </figure>
  );
}

"use client";

import { useId, useMemo, useState } from "react";
import { formatCompact, formatNumber, formatPct } from "@/lib/format";
import { returnPctAt, sortByDate } from "@/lib/performance";
import type { AccountSnapshot } from "@/lib/types";

/**
 * 납입원금 대비 평가액 곡선.
 *
 * 형태 선택 이유: 두 값은 같은 단위(원)이므로 축은 **하나만** 쓴다.
 * 원금은 "쌓아 올린 블록"(면적), 평가액은 그 위를 지나는 선으로 그려서
 * 색이 아니라 형태로 구분된다 — 색각 이상에서도 두 계열이 섞이지 않는다.
 * 둘 사이의 간격이 곧 손익이라, 위로 벌어지면 초록 / 아래로 벌어지면 빨강으로 채운다
 * (이 사이트의 기존 손익 색 규칙과 동일: format.ts profitColor).
 *
 * 리밸런싱 마커는 골드 다이아몬드 — 선(평가액)과 모양이 달라 겹쳐도 읽힌다.
 * 팔레트는 dataviz 검증기로 CVD·정상시야·대비를 통과시킨 조합이다.
 */

const VALUE_LINE = "#36a06a"; // 평가액
const MARKER = "#d8bd7a"; // 리밸런싱 이벤트
const SURFACE = "#1a1d27"; // 카드 배경(마커 링)
const PRINCIPAL_FILL = "#252a36";
const PRINCIPAL_EDGE = "#3b4252";
const GRID = "#2a2e3a";

const W = 720;
const H = 260;
const PAD = { top: 18, right: 16, bottom: 28, left: 52 };

export type RebalanceMarker = { date: string; memo: string };

type Point = { s: AccountSnapshot; x: number; yValue: number; yPrincipal: number };

function niceCeil(n: number): number {
  const mag = 10 ** Math.floor(Math.log10(n));
  return Math.ceil(n / mag) * mag;
}

export function CapitalFlowChart({
  snapshots,
  rebalances = [],
  className,
}: {
  snapshots: AccountSnapshot[];
  rebalances?: RebalanceMarker[];
  className?: string;
}) {
  const uid = useId().replace(/[:]/g, "");
  const [hover, setHover] = useState<number | null>(null);

  const rows = useMemo(() => sortByDate(snapshots), [snapshots]);

  const geom = useMemo(() => {
    if (rows.length < 2) return null;

    const max = niceCeil(Math.max(...rows.map((s) => Math.max(s.value, s.principal))) * 1.08);
    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;

    const x = (i: number) => PAD.left + (plotW * i) / (rows.length - 1);
    const y = (v: number) => PAD.top + plotH - (plotH * v) / max;

    const points: Point[] = rows.map((s, i) => ({
      s,
      x: x(i),
      yValue: y(s.value),
      yPrincipal: y(s.principal),
    }));

    const baseline = PAD.top + plotH;
    const line = (key: "yValue" | "yPrincipal") =>
      points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p[key]}`).join(" ");

    return {
      max,
      points,
      baseline,
      valuePath: line("yValue"),
      principalPath: line("yPrincipal"),
      principalArea: `${line("yPrincipal")} L${points.at(-1)!.x} ${baseline} L${points[0].x} ${baseline} Z`,
      /** 원금과 평가액 사이 — 손익 구간. 클립으로 위/아래를 나눠 색을 다르게 준다. */
      gapArea: `${line("yValue")} ${[...points].reverse().map((p) => `L${p.x} ${p.yPrincipal}`).join(" ")} Z`,
      ticks: [0, 0.5, 1].map((f) => ({ v: max * f, y: y(max * f) })),
    };
  }, [rows]);

  if (!geom) {
    return (
      <p className={className}>
        <span className="text-[13px] text-muted">기록이 2개월 이상 쌓이면 곡선이 그려집니다.</span>
      </p>
    );
  }

  const { points, baseline, ticks, valuePath, principalArea, principalPath, gapArea } = geom;
  const rebalanceByDate = new Map(rebalances.map((r) => [r.date.slice(0, 7), r]));
  const active = hover == null ? null : points[hover];

  return (
    <figure className={className}>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto"
          role="img"
          aria-label="납입원금 대비 평가액 추이"
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            {/*
              손익 영역(원금선~평가액선)을 평가액선 기준으로 잘라 색을 나눈다.
              - 수익: 평가액이 원금보다 위 → 손익 영역은 평가액선 '아래'에 놓인다 → underValue
              - 손실: 평가액이 원금보다 아래 → 손익 영역은 평가액선 '위'에 놓인다 → overValue
              (여기를 반대로 쓰면 수익이 빨갛게 칠해진다)
            */}
            <clipPath id={`${uid}-underValue`}>
              <path d={`${valuePath} L${points.at(-1)!.x} ${baseline} L${points[0].x} ${baseline} Z`} />
            </clipPath>
            <clipPath id={`${uid}-overValue`}>
              <path d={`${valuePath} L${points.at(-1)!.x} ${PAD.top} L${points[0].x} ${PAD.top} Z`} />
            </clipPath>
          </defs>

          {/* 격자 — 눈에 띄지 않게 */}
          {ticks.map((t) => (
            <g key={t.v}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={t.y}
                y2={t.y}
                stroke={GRID}
                strokeWidth="1"
              />
              <text x={PAD.left - 8} y={t.y + 4} textAnchor="end" className="fill-gray-500 text-[10px]">
                {formatCompact(t.v)}
              </text>
            </g>
          ))}

          {/* 납입원금 — 쌓아 올린 블록 */}
          <path d={principalArea} fill={PRINCIPAL_FILL} />
          <path d={principalPath} fill="none" stroke={PRINCIPAL_EDGE} strokeWidth="1.5" />

          {/* 손익 구간: 원금 위로 벌어지면 초록(수익), 아래로 벌어지면 빨강(손실) */}
          <g clipPath={`url(#${uid}-underValue)`}>
            <path d={gapArea} fill={VALUE_LINE} fillOpacity="0.22" />
          </g>
          <g clipPath={`url(#${uid}-overValue)`}>
            <path d={gapArea} fill="#dc2626" fillOpacity="0.22" />
          </g>

          {/* 평가액 */}
          <path
            d={valuePath}
            fill="none"
            stroke={VALUE_LINE}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* 리밸런싱 마커 — 선과 모양이 다른 다이아몬드 */}
          {points.map((p) =>
            rebalanceByDate.has(p.s.date.slice(0, 7)) ? (
              <rect
                key={`rb-${p.s.date}`}
                x={p.x - 4.5}
                y={p.yValue - 4.5}
                width="9"
                height="9"
                transform={`rotate(45 ${p.x} ${p.yValue})`}
                fill={MARKER}
                stroke={SURFACE}
                strokeWidth="2"
              />
            ) : null,
          )}

          {/* 호버 레이어 */}
          {active && (
            <line
              x1={active.x}
              x2={active.x}
              y1={PAD.top}
              y2={baseline}
              stroke={MARKER}
              strokeWidth="1"
              strokeDasharray="3 3"
              opacity="0.7"
            />
          )}
          {points.map((p, i) => (
            <rect
              key={`hit-${p.s.date}`}
              x={p.x - (W - PAD.left - PAD.right) / (points.length - 1) / 2}
              y={PAD.top}
              width={(W - PAD.left - PAD.right) / (points.length - 1)}
              height={baseline - PAD.top}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
          ))}
          {active && (
            <circle
              cx={active.x}
              cy={active.yValue}
              r="4.5"
              fill={VALUE_LINE}
              stroke={SURFACE}
              strokeWidth="2"
            />
          )}

          {/* x축 라벨 — 처음·마지막·호버 지점만 */}
          {points.map((p, i) =>
            i === 0 || i === points.length - 1 || hover === i ? (
              <text
                key={`x-${p.s.date}`}
                x={p.x}
                y={H - 8}
                textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
                className="fill-gray-500 text-[10px]"
              >
                {p.s.date.slice(0, 7)}
              </text>
            ) : null,
          )}
        </svg>

        {active && <FlowTooltip point={active} rebalance={rebalanceByDate.get(active.s.date.slice(0, 7))} />}
      </div>

      {/* 범례 — 모양이 서로 다르므로 색만으로 구분하지 않는다 */}
      <figcaption className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-3.5 rounded-[2px]" style={{ background: PRINCIPAL_FILL, border: `1px solid ${PRINCIPAL_EDGE}` }} />
          납입원금 누계
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full" style={{ background: VALUE_LINE }} />
          평가액
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rotate-45" style={{ background: MARKER }} />
          리밸런싱
        </span>
        <span className="text-gray-600">· 그래프의 벌어진 폭이 곧 평가손익입니다.</span>
      </figcaption>

      <DataTable rows={points.map((p) => p.s)} />
    </figure>
  );
}

function FlowTooltip({ point, rebalance }: { point: Point; rebalance?: RebalanceMarker }) {
  const { s } = point;
  const profit = s.value - s.principal;
  const pct = returnPctAt(s);

  return (
    <div
      className="pointer-events-none absolute top-2 z-10 w-60 rounded-xl border border-border bg-bg/95 p-3 shadow-lg backdrop-blur"
      style={{
        left: `${(point.x / W) * 100}%`,
        transform: point.x > W / 2 ? "translateX(-104%)" : "translateX(4%)",
      }}
    >
      <p className="text-[11px] text-gray-500">{s.date}</p>
      <dl className="mt-2 space-y-1 text-[12px]">
        <div className="flex justify-between gap-3">
          <dt className="text-muted">납입원금</dt>
          <dd className="tabular-nums text-gray-300">{formatNumber(s.principal)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">평가액</dt>
          <dd className="tabular-nums font-semibold text-white">{formatNumber(s.value)}</dd>
        </div>
        <div className="flex justify-between gap-3 border-t border-border/70 pt-1">
          <dt className="text-muted">평가손익</dt>
          <dd className={`tabular-nums font-semibold ${profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {profit >= 0 ? "+" : "−"}
            {formatNumber(Math.abs(profit))} ({formatPct(pct)})
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">누적 배당·이자</dt>
          <dd className="tabular-nums text-gold-400">{formatNumber(s.income)}</dd>
        </div>
      </dl>
      {rebalance && (
        <p className="mt-2 border-t border-border/70 pt-2 text-[11px] leading-relaxed text-gold-400">
          ◆ 리밸런싱 — {rebalance.memo}
        </p>
      )}
      {s.memo && !rebalance && (
        <p className="mt-2 border-t border-border/70 pt-2 text-[11px] leading-relaxed text-muted">
          {s.memo}
        </p>
      )}
    </div>
  );
}

/** 색·마우스 없이도 같은 정보를 읽을 수 있는 경로 */
function DataTable({ rows }: { rows: AccountSnapshot[] }) {
  return (
    <details className="mt-4 group">
      <summary className="cursor-pointer text-[11px] text-muted hover:text-gold-400">
        숫자로 보기
      </summary>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[420px] text-[12px]">
          <thead>
            <tr className="border-b border-border text-left text-[11px] text-gray-500">
              <th className="py-2 pr-3 font-medium">기준일</th>
              <th className="py-2 pr-3 text-right font-medium">납입원금</th>
              <th className="py-2 pr-3 text-right font-medium">평가액</th>
              <th className="py-2 text-right font-medium">수익률</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const pct = returnPctAt(s);
              return (
                <tr key={s.date} className="border-b border-border/50 last:border-0">
                  <td className="py-2 pr-3 text-muted">{s.date}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-gray-400">
                    {formatCompact(s.principal)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-white">
                    {formatCompact(s.value)}
                  </td>
                  <td
                    className={`py-2 text-right tabular-nums ${pct >= 0 ? "text-emerald-400" : "text-red-400"}`}
                  >
                    {formatPct(pct)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}

"use client";

/**
 * 유동성 카드 — 「숫자 뜯어보기 · 해석」 팝업(통합 계획 S4 · 운영자 요청 2026-09-14).
 *
 * ## 두 부분
 * 1. **우리 계산** — 계기별 점수 · 가중치 · 결측 이유 · 기준일. 서버가 만든 값을 그대로 받는다(열 때 요청 없음).
 * 2. **그날의 분석** — 관리자가 붙여넣은 분석(저장할 때 정화한 HTML). ⚠ 산식 없는 점수·Confidence %는 저장 전 점검에서 뺐다(운영자 결정).
 *
 * ## ⚠ 지키는 것
 * - 분석 날짜를 머리에 적는다 — 묵은 분석을 오늘 것처럼 보이지 않게. 점수 기준일보다 사흘 넘게 이르면 강조한다.
 * - 클라이언트 JS는 이 팝업 하나(열고 닫기)만 쓴다.
 * - `bodyHtml`은 저장 경로에서 `sanitizeHtml`을 거친 값이다(features/analysis/repository.ts) — 여기서 다른 HTML을 넣지 않는다.
 */
import { useRef } from "react";
import type { LiquidityCardView } from "@/lib/scores/summary";

export type LiquidityAnalysis = { date: string; oneLine: string; bodyHtml: string; sourceLabel: string };

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export function LiquidityDialog({ view, analysis }: { view: LiquidityCardView; analysis?: LiquidityAnalysis | null }) {
  const ref = useRef<HTMLDialogElement>(null);
  const stale = analysis ? daysBetween(analysis.date, view.asOf) > 3 : false;

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className="mt-2 self-start rounded-lg border border-gold-600/40 px-2.5 py-1 text-[12px] text-gold-500 hover:bg-gold-500/10"
      >
        숫자 뜯어보기 · 해석
      </button>

      <dialog
        ref={ref}
        aria-labelledby="liquidity-dialog-title"
        // ⚠ m-auto: 스타일 초기화가 대화상자의 기본 가운데 정렬 여백을 지워 왼쪽 위에 붙었다(2026-09-14 로컬 눈 확인)
        className="m-auto w-[min(40rem,calc(100vw-2rem))] rounded-2xl border border-border bg-card p-0 text-ink backdrop:bg-black/50"
      >
        <div className="max-h-[80vh] overflow-y-auto p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 id="liquidity-dialog-title" className="text-[15px] font-semibold">
              유동성 — 숫자와 해석
            </h2>
            <button type="button" onClick={() => ref.current?.close()} className="text-[12px] text-ink-3 hover:text-ink" aria-label="닫기">
              닫기 ✕
            </button>
          </div>

          <section className="mt-3">
            <h3 className="text-[12px] font-semibold text-ink">1. 우리 계산 · {view.asOf} 기준</h3>
            <p className="mt-1 text-[12.5px] text-muted">{view.oneLine}</p>
            <table className="mt-2 w-full text-[12px]">
              <thead>
                <tr className="text-left text-ink-3">
                  <th className="py-1 font-normal">계기</th>
                  <th className="py-1 font-normal">가중치</th>
                  <th className="py-1 font-normal">점수</th>
                </tr>
              </thead>
              <tbody>
                {view.components.map((c) => (
                  <tr key={c.key} className="border-t border-border/60 align-top">
                    <td className="py-1.5 text-ink">{c.label}</td>
                    <td className="py-1.5 tabular-nums text-muted">{c.weightPct}%</td>
                    <td className="py-1.5">
                      {c.score !== undefined ? (
                        <span className="tabular-nums text-ink">{Math.round(c.score)}</span>
                      ) : (
                        <span className="text-ink-3">빠짐 — {c.missingReason ?? "이유 기록 없음"}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[11px] text-ink-3">
              계기마다 지난 10년에 대어 0~100으로 바꾼 뒤 가중 평균합니다. 50이 평소입니다. 빠진 계기는 0점으로 치지 않고 분모에서 뺍니다.
            </p>
          </section>

          <section className="mt-5 border-t border-border/60 pt-4">
            <h3 className="text-[12px] font-semibold text-ink">2. 그날의 분석</h3>
            {analysis ? (
              <>
                <p className={stale ? "mt-1 text-[12.5px] font-semibold text-gold-500" : "mt-1 text-[12px] text-ink-3"}>
                  {analysis.date} 분석{stale ? " — 점수 기준일보다 오래됐습니다" : ""} · {analysis.sourceLabel}
                </p>
                <p className="mt-1 text-[13px] font-medium text-ink">{analysis.oneLine}</p>
                <div
                  // ⚠ 소제목·목록이 평문 줄로만 보였다(2026-09-14 로컬 눈 확인) — 서식을 붙인다
                  className="mt-3 max-w-none text-[12.5px] leading-relaxed text-muted [&_h1]:mt-3 [&_h1]:text-[14px] [&_h1]:font-semibold [&_h1]:text-ink [&_h2]:mt-3 [&_h2]:text-[13px] [&_h2]:font-semibold [&_h2]:text-ink [&_h3]:mt-2 [&_h3]:text-[12.5px] [&_h3]:font-semibold [&_h3]:text-ink [&_p]:mt-1.5 [&_ul]:mt-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mt-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mt-0.5 [&_table]:mt-2 [&_table]:w-full [&_td]:border-t [&_td]:border-border/60 [&_td]:py-1"
                  // ⚠ 저장 경로에서 sanitizeHtml을 거친 HTML이다(features/analysis/repository.ts)
                  dangerouslySetInnerHTML={{ __html: analysis.bodyHtml }}
                />
              </>
            ) : (
              <p className="mt-1 text-[12.5px] text-muted">아직 저장된 분석이 없습니다 — 운영자가 분석을 올리면 여기에 보입니다.</p>
            )}
          </section>
        </div>
      </dialog>
    </>
  );
}

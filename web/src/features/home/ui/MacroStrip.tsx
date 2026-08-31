"use client";

import { useState } from "react";
import Link from "next/link";
import { cx } from "@/lib/format";
import { Emphasis } from "@/components/ui/Emphasis";
import type { IndicatorView } from "@/features/macro/service";
import type { SignalStatus } from "@/lib/macro/signal";

/**
 * 거시 지표 스트립 — 첫 화면 아래로 **흘러가듯** 지나가는 지표 띠.
 *
 * ## ⚠ 자동으로 흐르지 않는다
 * "흘러가는 구조"를 **자동 스크롤(마퀴)** 로 만들지 않았다.
 * - 움직이는 글자는 **읽기가 어렵다.** 값을 읽으려면 멈추길 기다려야 한다.
 * - `prefers-reduced-motion`을 쓰는 사람에게는 멈춰야 하는데, 멈추면 **뒤쪽 지표를 볼 방법이 없다.**
 * - 그래서 **가로 스크롤 + 클릭 펼침**으로 했다. 흐르는 인상은 남고, 읽는 사람이 속도를 쥔다.
 *
 * ## ⚠ 값과 기준일은 항상 함께
 * 날짜 없는 숫자는 실시간처럼 읽힌다(운영지침 §5). 칩에 기준일을 같이 얹는다.
 *
 * ## ⚠ 상태는 색만으로 말하지 않는다
 * 색맹 사용자와 흑백 인쇄를 위해 **점 + 글자 라벨**을 함께 쓴다.
 */

/** ⚠ 사용자에게 보이는 문자열은 위쪽에 모은다 — 나중에 다국어를 넣을 때 여기만 본다. */
const TEXT = {
  heading: "지금 부는 바람",
  more: "지표 전체 보기",
  empty: "아직 지표를 가져오지 않았습니다.",
  hint: "옆으로 밀어 보세요 · 눌러서 펼치기",
  asOfSuffix: "기준",
  collecting: "수집 전",
};

const STATUS_LABEL: Record<SignalStatus, string> = {
  normal: "정상",
  watch: "주의",
  alert: "경고",
  unknown: "모름",
};

/** ⚠ 계열색이 아니라 상태색이다. 등락색(적/청)과도 섞지 않는다. */
const STATUS_DOT: Record<SignalStatus, string> = {
  normal: "bg-series-1",
  watch: "bg-gold-500",
  alert: "bg-danger",
  unknown: "bg-ink-3",
};

export function MacroStrip({ indicators }: { indicators: IndicatorView[] }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const open = indicators.find((i) => i.indicator.key === openKey) ?? null;

  if (indicators.length === 0) {
    return (
      <section className="mx-auto max-w-6xl px-4 pb-10 sm:px-6">
        {/* ⚠ 빈 칸을 0으로 채우지 않는다 — 없으면 없다고 적는다. */}
        <p className="text-[12.5px] text-ink-3">{TEXT.empty}</p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <h2 className="text-[13px] font-semibold tracking-tight text-ink">{TEXT.heading}</h2>
        <Link href="/macro" className="text-[11px] text-gold-500 hover:text-gold-400">
          {TEXT.more}
        </Link>
      </div>

      {/*
        ⚠ 가로 스크롤은 **이 띠 안에서만** 일어난다. 페이지 본문이 가로로 밀리면 안 된다.
           `overflow-x-auto`를 띠에 걸고 바깥은 그대로 둔다.
      */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1.5">
        {indicators.map((view) => {
          const key = view.indicator.key;
          const isOpen = key === openKey;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setOpenKey(isOpen ? null : key)}
              aria-expanded={isOpen}
              className={cx(
                "shrink-0 rounded-xl border px-3.5 py-2.5 text-left transition-colors",
                isOpen
                  ? "border-gold-600/50 bg-surface-2"
                  : "border-border bg-card hover:border-gold-600/40 hover:bg-cardHover",
              )}
            >
              <span className="flex items-center gap-1.5">
                <span
                  className={cx("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_DOT[view.status])}
                  aria-hidden
                />
                <span className="whitespace-nowrap text-[11px] text-muted">
                  {view.indicator.name}
                </span>
              </span>
              <span className="mt-1 flex items-baseline gap-2">
                <span className="whitespace-nowrap text-[15px] font-semibold tabular-nums text-ink">
                  {view.display}
                </span>
                {/* ⚠ 상태를 색만으로 말하지 않는다 */}
                <span className="whitespace-nowrap text-[10px] text-ink-3">
                  {STATUS_LABEL[view.status]}
                </span>
              </span>
              <span className="mt-0.5 block whitespace-nowrap text-[10px] text-ink-3">
                {view.asOf ? `${view.asOf} ${TEXT.asOfSuffix}` : TEXT.collecting}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-1 text-[10.5px] text-ink-3">{TEXT.hint}</p>

      {/* 펼침 — 한 번에 하나만 연다. 여러 개를 열어 두면 띠가 아니라 목록이 된다. */}
      {open && (
        <div className="mt-3 rounded-2xl border border-border bg-card p-5">
          <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span className="text-[14px] font-semibold text-ink">{open.indicator.name}</span>
            <span className="text-[12px] text-ink-3">
              {open.asOf ? `${open.asOf} ${TEXT.asOfSuffix}` : TEXT.collecting} ·{" "}
              {open.indicator.sourceLabel}
            </span>
          </p>
          {/* ⚠ 카탈로그 설명글은 `**강조**`를 품고 있다. 그대로 그리면 화면에 별표가 보인다 —
              2026-08-31에 실제로 그랬다(홈이 유일하게 `Emphasis`를 안 쓰고 있었다). */}
          <p className="mt-2.5 text-[12.5px] leading-relaxed text-muted">
            <Emphasis text={open.indicator.what} />
          </p>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
            <Emphasis text={open.indicator.read} />
          </p>
          <Link
            href={`/macro/${open.indicator.group}`}
            className="mt-3 inline-block text-[12px] text-gold-500 hover:text-gold-400"
          >
            이 묶음 자세히 보기 →
          </Link>
        </div>
      )}
    </section>
  );
}

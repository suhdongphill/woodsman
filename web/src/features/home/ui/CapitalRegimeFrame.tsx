import Link from "next/link";
import type { RegimeFrame } from "@/lib/scores/regime-summary";
import { MODEL_VERSION } from "@/lib/scores/config";
import type { TideDirection } from "@/lib/scores/tide";

/**
 * 홈 「지금 부는 바람」 타이틀 **바로 아래**의 Global Capital Regime 프레임 (개발요구서 G1).
 *
 * ## 왜 여기인가 (운영자 결정 2026-09-16)
 * 자본의 흐름은 이 사이트가 내는 판정 중 가장 큰 것이라, 화면에서 가장 먼저 읽히는 자리에 둔다.
 * ⚠ 자리가 세 번 바뀌었다 — 「유동성 카드 하단」(오독) → 「금리 정보 하단 · 줄 전체 밑」 →
 *   **「지금 부는 바람」 타이틀 하단**. 개발요구서 v0.4에 경위를 적었다.
 *
 * ## ⚠ 이 조각이 지키는 것
 * - **숫자를 다시 계산하지 않는다.** 조류 카드가 읽은 것과 같은 `ScoreValue` 행을 받아 그린다 —
 *   따로 읽으면 한 화면의 두 자리가 다른 값을 말한다.
 * - **큰 숫자는 조류 카드에만.** 여기 칩은 작다. 같은 점수를 두 곳에 크게 실으면 정보가 아니라 중복이다.
 * - **발행되지 않은 점수는 「준비 중」**이다. 0으로도, 「—」에 숫자를 붙여서도 채우지 않는다.
 * - 방향은 **색만으로 말하지 않는다**(화살표 + 글자). 등락색(적/청)을 쓰지 않는다 — 좋고 나쁨이 아니라 흐름이다.
 */

const TEXT = {
  heading: "GLOBAL CAPITAL REGIME",
  pendingRegime: "판정 준비 중",
  more: "자세히 보기",
  asOfPrefix: "기준",
  soon: "준비 중",
};

const ARROW: Record<TideDirection, string> = { up: "↑", down: "↓", flat: "→", unknown: "·" };
const DIRECTION_WORD: Record<TideDirection, string> = {
  up: "오름",
  down: "내림",
  flat: "보합",
  unknown: "비교 없음",
};

export function CapitalRegimeFrame({ frame }: { frame: RegimeFrame }) {
  // ⚠ 발행 점수가 모자라면 아예 그리지 않는다 — 빈 상자는 「고장」과 구분되지 않는다.
  if (!frame.show) return null;

  return (
    <section
      aria-label="Global Capital Regime"
      className="mb-4 rounded-2xl border border-border/70 bg-surface-2/40 px-4 py-3.5 sm:px-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-[11px] font-semibold tracking-[0.14em] text-ink-2">{TEXT.heading}</h3>
        <p className="text-[10.5px] tabular-nums text-ink-3">
          {frame.asOf ? `${TEXT.asOfPrefix} ${frame.asOf} · ` : ""}
          모델 {MODEL_VERSION}
        </p>
      </div>

      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
        <span className="rounded-md bg-surface-3/70 px-1.5 py-0.5 text-[11px] font-medium text-ink-2">
          {TEXT.pendingRegime}
        </span>
        <span className="text-ink-3">
          발행 점수 {frame.publishedCount} / {frame.totalCount}
        </span>
      </p>

      {/* 한 줄 요약 — 프로그램이 쓴다(LLM 없음). 발행된 점수만 숫자로 말한다. */}
      <p className="mt-2 text-[12.5px] leading-relaxed text-muted">{frame.summary}</p>

      {/*
        ⚠ 미발행이 넷 이상이면 칩 줄을 접는다 — 「—」가 여섯 개 늘어서면
           읽는 사람은 고장으로 읽는다. 대신 발행된 것만 조용히 센다.
      */}
      {!frame.collapsed && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {frame.chips.map((chip) => (
            <li
              key={chip.scoreKey}
              className="rounded-lg border border-border/60 bg-surface-1/60 px-2 py-1 text-[11px]"
            >
              <span className="text-ink-3">{chip.label} </span>
              {chip.value === undefined ? (
                <span className="text-ink-3">— {TEXT.soon}</span>
              ) : (
                <>
                  <span className="font-semibold tabular-nums text-ink">{Math.round(chip.value)}</span>
                  <span className="ml-1 text-ink-3">
                    {ARROW[chip.dir4]} {DIRECTION_WORD[chip.dir4]}
                  </span>
                  {chip.coverage !== undefined && (
                    <span className="ml-1 tabular-nums text-ink-3">{Math.round(chip.coverage)}%</span>
                  )}
                  {/* 🟡는 색이 아니라 글자로도 말한다 */}
                  {chip.lowConfidence && <span className="ml-1 text-gold-500">🟡 낮은 신뢰</span>}
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2.5 text-right">
        {/* ⚠ G8(`/capital-regime`)은 아직 없다. 자본 엔진 카드의 앵커도 아직 없어 묶음 화면으로 보낸다 —
            없는 앵커로 보내면 맨 위로 튕기고, 읽는 사람은 링크가 고장 났다고 읽는다. */}
        <Link href="/macro" className="text-[11px] text-gold-500 hover:text-gold-400">
          {TEXT.more} →
        </Link>
      </div>
    </section>
  );
}

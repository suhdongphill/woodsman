"use client";

/**
 * AI 지표값 추출 패널 — 「출처를 주면 옮겨 적어 준다」.
 *
 * ⚠ 모델이 낸 값을 **바로 저장하지 않는다.** 후보로 띄우고, 인용문을 함께 보여주고,
 *    「이 값으로 저장」을 누르는 것은 사람이다.
 * ⚠ 걸러졌으면 **이유를 그대로 보여준다.** "인용문이 원문에 없습니다"는 그 제공자를
 *    다시 쓸지 판단하는 근거다.
 */
import { useActionState } from "react";
import type { MacroIndicator } from "@/lib/macro/catalog";
import { adoptExtractAction, extractIndicatorAction } from "../extract-actions";
import { emptyExtractState } from "../extract-state";

const TEXT = {
  title: "AI로 값 옮겨 적기",
  hint: "출처 주소를 주면 서버가 그 페이지를 받아 오고, AI는 그 본문 안에서만 값을 찾습니다. 인용문이 원문에 없으면 버립니다.",
  indicator: "지표",
  url: "출처 주소",
  urlPlaceholder: "https://… (값이 적힌 보도자료·통계 페이지)",
  run: "본문에서 찾기",
  running: "받아 와서 읽는 중…",
  adopt: "이 값으로 저장",
  adopting: "저장 중…",
  quote: "본문 인용",
};

const field =
  "w-full rounded-xl border border-border bg-bg px-3 py-2 text-[13px] text-ink placeholder:text-ink-3";

export function ExtractPanel({ indicators }: { indicators: MacroIndicator[] }) {
  const [state, runAction, running] = useActionState(extractIndicatorAction, emptyExtractState);
  const [saved, adoptAction, adopting] = useActionState(adoptExtractAction, emptyExtractState);

  if (indicators.length === 0) {
    return <p className="text-[13px] text-muted">수동으로 남은 지표가 없습니다.</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-[12px] leading-relaxed text-muted">{TEXT.hint}</p>

      <form action={runAction} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <label>
            <span className="mb-1 block text-[11px] text-muted">{TEXT.indicator}</span>
            <select name="indicatorKey" defaultValue={indicators[0].key} className={field}>
              {indicators.map((i) => (
                <option key={i.key} value={i.key}>
                  {i.name}
                </option>
              ))}
            </select>
          </label>
          <label className="sm:col-span-2">
            <span className="mb-1 block text-[11px] text-muted">{TEXT.url}</span>
            <input name="url" placeholder={TEXT.urlPlaceholder} className={field} />
          </label>
        </div>
        <button
          type="submit"
          disabled={running}
          className="rounded-xl border border-border px-3 py-2 text-[12.5px] text-muted transition-colors hover:border-gold-600/40 hover:text-ink disabled:opacity-50"
        >
          {running ? TEXT.running : TEXT.run}
        </button>
      </form>

      {state.error && (
        <p role="alert" className="text-[12.5px] text-red-400">
          {state.error}
        </p>
      )}

      {state.rejected && (
        <div className="rounded-xl border border-border px-3 py-2.5">
          <p className="text-[12.5px] text-gold-500">걸렀습니다 — {state.rejected}</p>
          <p className="mt-1 text-[11px] text-ink-3">
            {state.provider} · {state.model}
          </p>
        </div>
      )}

      {state.value !== undefined && state.date && (
        <form action={adoptAction} className="space-y-2 rounded-xl border border-border px-3 py-3">
          <input type="hidden" name="indicatorKey" value={state.indicatorKey} />
          <input type="hidden" name="value" value={state.value} />
          <input type="hidden" name="date" value={state.date} />

          <p className="text-[13px] text-ink">
            {state.indicatorName} · <strong className="tabular-nums">{state.value}</strong>{" "}
            <span className="text-[11.5px] text-muted">({state.date} 기준)</span>
          </p>
          {state.note && <p className="text-[12px] text-muted">{state.note}</p>}
          <p className="text-[11.5px] leading-relaxed text-ink-3">
            {TEXT.quote}: “{state.quote}”
          </p>
          <p className="text-[11px] text-ink-3">
            {state.provider} · {state.model} · 출처 {state.url}
          </p>

          <button
            type="submit"
            disabled={adopting}
            className="rounded-xl bg-gold-600/90 px-3.5 py-2 text-[12.5px] font-medium text-onAccent transition-colors hover:bg-gold-600 disabled:opacity-50"
          >
            {adopting ? TEXT.adopting : TEXT.adopt}
          </button>
        </form>
      )}

      {saved.saved && <p className="text-[12.5px] text-emerald-400">저장했습니다 — {saved.saved}</p>}
      {saved.error && (
        <p role="alert" className="text-[12.5px] text-red-400">
          {saved.error}
        </p>
      )}
    </div>
  );
}

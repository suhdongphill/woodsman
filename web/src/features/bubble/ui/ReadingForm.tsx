"use client";

/**
 * 지표 채점 폼 — 한 줄에 하나.
 *
 * 서른 개를 한 화면에서 채점하므로 **줄당 입력은 최소로** 둔다(점수·근거·기준일).
 * ⚠ "지우기"는 0점이 아니라 **결측**으로 되돌린다. 둘은 다른 뜻이라 버튼을 따로 뒀다.
 */
import { useActionState } from "react";
import { clearReadingAction, saveReadingAction } from "../actions";
import { emptyBubbleFormState } from "../form-state";
import type { BubbleIndicator, BubbleReading } from "@/lib/bubble/types";

const field =
  "w-full bg-[#12141c] border border-border rounded-lg px-2.5 py-1.5 text-[12.5px] text-white placeholder:text-gray-600";

export function ReadingForm({
  indicator,
  reading,
  today,
}: {
  indicator: BubbleIndicator;
  reading?: BubbleReading;
  today: string;
}) {
  const [state, formAction, pending] = useActionState(saveReadingAction, emptyBubbleFormState);

  return (
    <div className="border-t border-border px-5 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[13px] font-medium text-white">{indicator.label}</p>
        <p className="text-[11px] text-gray-600">
          {indicator.rule}
          {indicator.source && ` · ${indicator.source}`}
        </p>
      </div>

      <form action={formAction} className="mt-2 flex flex-wrap items-center gap-2">
        <input type="hidden" name="indicatorKey" value={indicator.key} />

        <select
          name="points"
          defaultValue={reading ? String(reading.points) : "0"}
          aria-label={`${indicator.label} 점수`}
          className={`${field} w-28 shrink-0`}
        >
          <option value="0">0 · 안정</option>
          <option value="1">1 · 주의</option>
          <option value="2">2 · 과열</option>
        </select>

        <input
          name="value"
          defaultValue={reading?.value}
          placeholder="근거가 된 숫자·문장"
          aria-label={`${indicator.label} 근거`}
          className={`${field} min-w-[200px] flex-1`}
        />

        <input
          type="date"
          name="asOf"
          defaultValue={reading?.asOf ?? today}
          aria-label={`${indicator.label} 기준일`}
          className={`${field} w-36 shrink-0`}
        />

        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-lg bg-gold-600/90 px-3 py-1.5 text-[12px] font-medium text-black transition-colors hover:bg-gold-600 disabled:opacity-50"
        >
          {pending ? "…" : "저장"}
        </button>

        {state.error && (
          <span role="alert" className="text-[11px] text-red-400">
            {state.error}
          </span>
        )}
        {state.savedAt && !state.error && (
          <span className="text-[11px] text-emerald-400">저장됨</span>
        )}
      </form>

      {reading && (
        <form action={clearReadingAction} className="mt-1">
          <input type="hidden" name="indicatorKey" value={indicator.key} />
          <button
            type="submit"
            className="text-[11px] text-gray-600 underline hover:text-red-400"
          >
            채점 지우기(결측으로 되돌림)
          </button>
        </form>
      )}
    </div>
  );
}

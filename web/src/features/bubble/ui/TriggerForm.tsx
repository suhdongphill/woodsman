"use client";

/**
 * 하드 트리거 상태 폼.
 * 점수와 별개로 "이게 일어나면 판이 바뀐다"를 기록한다 — 발생 여부·근접도·지금 상황 한 줄.
 */
import { useActionState } from "react";
import { saveTriggerAction } from "../actions";
import { emptyBubbleFormState } from "../form-state";
import type { BubbleTriggerDef, BubbleTriggerState } from "@/lib/bubble/types";

const field =
  "w-full bg-[#12141c] border border-border rounded-lg px-2.5 py-1.5 text-[12.5px] text-white placeholder:text-gray-600";

export function TriggerForm({
  trigger,
  state: current,
  today,
}: {
  trigger: BubbleTriggerDef;
  state?: BubbleTriggerState;
  today: string;
}) {
  const [state, formAction, pending] = useActionState(saveTriggerAction, emptyBubbleFormState);

  return (
    <form action={formAction} className="border-t border-border px-5 py-3">
      <input type="hidden" name="key" value={trigger.key} />
      <p className="text-[13px] leading-relaxed text-gray-200">{trigger.text}</p>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="flex shrink-0 items-center gap-1.5 text-[12px] text-gray-300">
          <input
            type="checkbox"
            name="fired"
            defaultChecked={current?.fired ?? false}
            className="h-4 w-4 accent-red-500"
          />
          발생
        </label>

        <select
          name="proximity"
          defaultValue={current?.proximity ?? "far"}
          aria-label={`${trigger.key} 근접도`}
          className={`${field} w-24 shrink-0`}
        >
          <option value="far">여유</option>
          <option value="near">근접</option>
        </select>

        <input
          name="now"
          defaultValue={current?.now}
          placeholder="지금 상황 한 줄"
          aria-label={`${trigger.key} 현재 상황`}
          className={`${field} min-w-[220px] flex-1`}
        />

        <input
          type="date"
          name="asOf"
          defaultValue={current?.asOf ?? today}
          aria-label={`${trigger.key} 기준일`}
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
      </div>
    </form>
  );
}

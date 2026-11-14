"use client";

import { useActionState } from "react";
import { setResearchVerifyAction } from "../actions";
import { emptyResearchVerifyState } from "../form-state";
import { VERIFY_LABEL, VERIFY_STATUSES } from "@/lib/research/import";

/** 검증 상태 기록 — ⚠ 근거 메모가 없으면 저장하지 않는다. */
export function ResearchVerifyForm({ id, status }: { id: string; status: string }) {
  const [state, formAction, pending] = useActionState(setResearchVerifyAction, emptyResearchVerifyState);
  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={id} />
      <select
        name="status"
        defaultValue={status}
        className="rounded-lg border border-border bg-bg px-2 py-1.5 text-[12px] text-ink"
      >
        {VERIFY_STATUSES.map((s) => (
          <option key={s} value={s}>
            {VERIFY_LABEL[s]}
          </option>
        ))}
      </select>
      <input
        name="note"
        placeholder="근거 메모 — 무엇을 확인했고 어디에 기록했는지"
        className="min-w-0 flex-1 rounded-lg border border-border bg-bg px-2 py-1.5 text-[12px] text-ink"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-border px-3 py-1.5 text-[12px] text-ink hover:border-gold-500 disabled:opacity-50"
      >
        기록
      </button>
      {state.error && <span className="w-full text-[11.5px] text-red-400">{state.error}</span>}
      {state.savedAt && <span className="w-full text-[11.5px] text-emerald-400">기록했습니다.</span>}
    </form>
  );
}

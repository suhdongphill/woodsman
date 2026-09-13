"use client";

/**
 * 대시보드용 수동 수집 버튼 — `/admin/macro`의 「전체 자료 가져오기」와 **같은 액션**을 부른다(판단을 두 번 구현하지 않는다).
 * ⚠ 결과(성공·실패 수)를 그 자리에서 보여 준다 — 눌렀는데 아무 말이 없으면 두 번 누른다.
 */
import { useActionState } from "react";
import { ingestMacroAction } from "../actions";
import { emptyMacroFormState } from "../form-state";

export function QuickIngestButton() {
  const [state, formAction, pending] = useActionState(ingestMacroAction, emptyMacroFormState);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <form action={formAction}>
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-gold-600/90 px-4 py-2 text-[12.5px] font-medium text-onAccent transition-colors hover:bg-gold-600 disabled:opacity-50"
        >
          {pending ? "가져오는 중… (최대 30초)" : "지금 수동 수집"}
        </button>
      </form>
      {!pending && state.summary && <span className="text-[12px] text-emerald-400">{state.summary}</span>}
      {state.error && (
        <span role="alert" className="text-[12px] text-red-400">
          {state.error}
        </span>
      )}
    </div>
  );
}

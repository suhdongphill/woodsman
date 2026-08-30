"use client";

/**
 * 리밸런싱 기록 폼.
 *
 * 자금흐름 곡선 위에 표시되는 점이 여기서 나온다. 무엇을 어떻게 바꿨는지 한 줄이면 된다 —
 * 길게 써야 하면 투자일지(REBALANCE)에 쓴다.
 */
import { useActionState } from "react";
import { saveRebalanceAction } from "../actions";
import { emptyPortfolioFormState } from "../form-state";

const field =
  "w-full bg-bg border border-border rounded-xl px-3 py-2 text-[13px] text-ink placeholder:text-gray-600";
const label = "block text-[11px] text-muted mb-1";

export function RebalanceForm({ today }: { today: string }) {
  const [state, formAction, pending] = useActionState(saveRebalanceAction, emptyPortfolioFormState);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
        <label>
          <span className={label}>날짜</span>
          <input type="date" name="date" defaultValue={today} className={field} />
        </label>
        <label>
          <span className={label}>무엇을 어떻게 바꿨나</span>
          <input
            name="memo"
            placeholder="예: 엔비디아 목표비중 16% → 14%, 차익 일부를 달러 MMF로"
            className={field}
          />
        </label>
      </div>

      <div className="flex items-center justify-end gap-3">
        {state.error && (
          <span role="alert" className="text-[12px] text-red-400">
            {state.error}
          </span>
        )}
        {state.savedAt && !state.error && (
          <span className="text-[12px] text-emerald-400">저장했습니다</span>
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-gold-600/90 px-4 py-2 text-[13px] font-medium text-onAccent transition-colors hover:bg-gold-600 disabled:opacity-50"
        >
          {pending ? "저장 중…" : "기록 추가"}
        </button>
      </div>
    </form>
  );
}

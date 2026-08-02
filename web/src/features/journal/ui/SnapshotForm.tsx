"use client";

/**
 * 계좌 스냅샷 입력 — 월 1회 기록.
 *
 * 같은 날짜를 다시 넣으면 덮어쓴다(날짜가 곧 키다). 잘못 넣었을 때
 * 지우고 다시 넣을 필요가 없게 하려는 것이다.
 */
import { useActionState } from "react";
import { saveSnapshotAction } from "../actions";
import { emptyJournalFormState } from "../form-state";

const field =
  "w-full bg-[#12141c] border border-border rounded-xl px-3 py-2 text-[13px] text-white text-right tabular-nums placeholder:text-gray-600";
const label = "block text-[11px] text-muted mb-1";

export function SnapshotForm({ today }: { today: string }) {
  const [state, formAction, pending] = useActionState(saveSnapshotAction, emptyJournalFormState);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-5">
        <label>
          <span className={label}>기준일</span>
          <input type="date" name="date" defaultValue={today} className={`${field} text-left`} />
        </label>
        <label>
          <span className={label}>납입원금 누계</span>
          <input name="principal" inputMode="numeric" placeholder="68000000" className={field} />
        </label>
        <label>
          <span className={label}>평가액</span>
          <input name="value" inputMode="numeric" placeholder="76540000" className={field} />
        </label>
        <label>
          <span className={label}>누적 배당·이자</span>
          <input name="income" inputMode="numeric" placeholder="0" defaultValue="0" className={field} />
        </label>
        <label>
          <span className={label}>메모</span>
          <input name="memo" className={`${field} text-left`} />
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
          className="rounded-xl border border-border px-4 py-2 text-[13px] text-gray-300 transition-colors hover:border-gold-600/50 hover:text-white disabled:opacity-50"
        >
          {pending ? "저장 중…" : "스냅샷 저장"}
        </button>
      </div>
      <p className="text-[11px] text-gray-600">
        같은 날짜를 다시 저장하면 덮어씁니다. 원금은 <span className="text-gray-500">그날까지
        넣은 돈의 누계</span>이고, 평가액은 그날의 총액입니다.
      </p>
    </form>
  );
}

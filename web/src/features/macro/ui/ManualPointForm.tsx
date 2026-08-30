"use client";

/**
 * 수동 지표 입력.
 *
 * FRED·Yahoo가 주지 않는 지표(ISM·소비자신뢰·NAHB·달러인덱스·금·한국 기준금리·선행 PER)는
 * 발표 자료를 보고 손으로 넣는다. **값과 기준일을 함께** 받는다 —
 * 언제 것인지 모르는 숫자를 화면에 내지 않는 것이 이 사이트의 규칙이다.
 */
import { useActionState } from "react";
import { saveManualPointAction } from "../actions";
import { emptyMacroFormState } from "../form-state";
import type { MacroIndicator } from "@/lib/macro/catalog";

const field =
  "w-full bg-bg border border-border rounded-xl px-3 py-2 text-[13px] text-ink placeholder:text-gray-600";
const label = "block text-[11px] text-muted mb-1";

export function ManualPointForm({
  indicators,
  today,
}: {
  indicators: MacroIndicator[];
  today: string;
}) {
  const [state, formAction, pending] = useActionState(saveManualPointAction, emptyMacroFormState);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1.6fr_1fr_1fr]">
        <label>
          <span className={label}>지표</span>
          <select name="seriesKey" className={field} defaultValue={indicators[0]?.key}>
            {indicators.map((i) => (
              <option key={i.key} value={i.key}>
                {i.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={label}>기준일 (발표 기준)</span>
          <input type="date" name="date" defaultValue={today} className={field} />
        </label>
        <label>
          <span className={label}>값</span>
          <input name="value" placeholder="예: 48.5" className={field} />
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] text-gray-600">
          기준일은 <strong>발표된 시점</strong>으로 넣습니다(7월 지표면 2026-07-01).
          같은 날짜를 다시 넣으면 값이 갱신됩니다.
        </p>
        <div className="flex items-center gap-3">
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
            {pending ? "저장 중…" : "값 저장"}
          </button>
        </div>
      </div>
    </form>
  );
}

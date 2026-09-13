"use client";

/**
 * 그날의 분석 붙여넣기 폼.
 * ⚠ 점검에 걸린 줄은 **줄 번호와 함께** 보여 준다. 저장하지 않고 돌아오면 입력을 그대로 되살린다(폼이 비워지지 않게).
 */
import { useActionState } from "react";
import { GUARD_KIND_LABEL } from "@/lib/analysis/guard";
import { saveDailyAnalysisAction } from "../actions";
import { ANALYSIS_ONE_LINE_MAX, DEFAULT_ANALYSIS_SOURCE, emptyAnalysisFormState } from "../form-state";

const field = "w-full rounded-xl border border-border bg-bg px-3 py-2 text-[13px] text-ink";

export function AnalysisForm({ today }: { today: string }) {
  const [state, formAction, pending] = useActionState(saveDailyAnalysisAction, emptyAnalysisFormState);
  const d = state.draft;
  // ⚠ 저장하지 않고 돌아왔을 때 입력을 되살리려면 key로 폼을 새로 그린다(defaultValue는 처음 한 번만 읽힌다).
  const formKey = d ? `${d.date}-${d.body.length}-${state.findings?.length ?? 0}-${state.error ?? ""}` : "empty";

  return (
    <form key={formKey} action={formAction} className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <label className="text-[12px] text-muted">
          분석 날짜
          <input type="date" name="date" defaultValue={d?.date ?? today} className={`mt-1 ${field}`} />
        </label>
        <label className="text-[12px] text-muted">
          한 줄 결론(필수 · {ANALYSIS_ONE_LINE_MAX}자 · 홈 팝업 머리에 들어갑니다)
          <input name="oneLine" required maxLength={ANALYSIS_ONE_LINE_MAX} defaultValue={d?.oneLine} className={`mt-1 ${field}`} />
        </label>
      </div>
      <label className="text-[12px] text-muted">
        출처 표기
        <input name="sourceLabel" defaultValue={d?.sourceLabel ?? DEFAULT_ANALYSIS_SOURCE} className={`mt-1 ${field}`} />
      </label>
      <label className="text-[12px] text-muted">
        본문(마크다운 · 산식 없는 점수와 Confidence %는 지우고 붙여넣으세요)
        <textarea name="body" required rows={18} defaultValue={d?.body} className={`mt-1 font-mono ${field}`} />
      </label>

      {state.findings && state.findings.length > 0 && (
        <div className="rounded-xl border border-gold-600/40 bg-gold-500/[0.05] p-3 text-[12px]">
          <p className="font-semibold text-ink">점검에 걸린 줄 {state.findings.length}개</p>
          <ul className="mt-2 space-y-1">
            {state.findings.map((f) => (
              <li key={`${f.line}-${f.kind}`} className="text-muted">
                <span className="tabular-nums text-ink">{f.line}줄</span> · {GUARD_KIND_LABEL[f.kind]} — <span className="text-ink-3">{f.text}</span>
              </li>
            ))}
          </ul>
          <label className="mt-3 flex items-start gap-2 text-ink">
            <input type="checkbox" name="acceptGuard" value="1" className="mt-0.5" />
            <span>표시된 줄을 확인했습니다 — 산식 없는 점수·Confidence는 지웠고, 남은 줄은 출처 있는 사실입니다.</span>
          </label>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-gold-600/90 px-4 py-2 text-[13px] font-medium text-onAccent hover:bg-gold-600 disabled:opacity-50"
        >
          {pending ? "점검·저장 중…" : "점검하고 저장"}
        </button>
        {state.error && (
          <span role="alert" className="text-[12px] text-red-400">
            {state.error}
          </span>
        )}
        {!pending && state.savedAt && <span className="text-[12px] text-emerald-400">저장했습니다 — 홈 유동성 카드의 해석 팝업에 보입니다.</span>}
      </div>
    </form>
  );
}

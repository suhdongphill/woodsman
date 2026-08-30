"use client";

import { useActionState } from "react";
import { saveReleaseAction } from "../actions";
import {
  RELEASE_KINDS,
  RELEASE_METRICS,
  emptyReleaseFormState,
} from "../form-state";

const field =
  "w-full rounded-xl border border-border bg-bg px-3 py-2 text-[13px] text-ink placeholder:text-ink-3";
const label = "block text-[11px] text-muted mb-1";

/**
 * 릴리스 입력.
 *
 * ⚠ **가설 칸이 이 화면의 핵심이다.** 결과를 보고 쓴 가설은 항상 맞는다 — 그건 학습이 아니라
 *    자기기만이라, 배포할 때 미리 적게 한다. 그래서 가설 칸을 결과 화면이 아니라 **입력**에 둔다.
 */
export function ReleaseForm({ today }: { today: string }) {
  const [state, formAction, pending] = useActionState(saveReleaseAction, emptyReleaseFormState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-6">
        <label className="sm:col-span-4">
          <span className={label}>무엇을 바꿨나</span>
          <input
            name="title"
            defaultValue=""
            placeholder="홈 첫 화면을 거시 요약으로 바꿨다"
            className={field}
          />
        </label>
        <label>
          <span className={label}>배포한 날</span>
          <input type="date" name="day" defaultValue={today} className={field} />
        </label>
        <label>
          <span className={label}>종류</span>
          <select name="kind" defaultValue="LAYOUT" className={field}>
            {RELEASE_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className={label}>
          기대한 것 (가설) — ⚠ 결과를 보고 나서 쓰지 않습니다. 지금 적어 두세요
        </span>
        <textarea
          name="hypothesis"
          rows={2}
          placeholder="첫 화면에 블로그 버튼을 올렸으니 티스토리로 넘어간 클릭이 늘 것이다"
          className={field}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-3">
        <label>
          <span className={label}>무엇으로 볼 것인가</span>
          <select name="metric" defaultValue="TISTORY_CLICK" className={field}>
            {RELEASE_METRICS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="sm:col-span-2">
          <span className={label}>커밋 (선택) — 개발사·책 원고와 잇는 고리</span>
          <input name="commit" placeholder="a3825e8" className={field} />
        </label>
      </div>

      <div className="flex items-center justify-end gap-3">
        {state.error && (
          <span role="alert" className="text-[12px] text-danger">
            {state.error}
          </span>
        )}
        {state.savedAt && !state.error && (
          <span className="text-[12px] text-emerald-500">기록했습니다</span>
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-gold-600/90 px-4 py-2 text-[13px] font-medium text-onAccent transition-colors hover:bg-gold-600 disabled:opacity-50"
        >
          {pending ? "기록 중…" : "릴리스 기록"}
        </button>
      </div>
    </form>
  );
}

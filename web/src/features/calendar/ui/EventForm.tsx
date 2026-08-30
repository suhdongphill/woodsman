"use client";

import { useActionState } from "react";
import {
  EVENT_COUNTRIES,
  EVENT_COUNTRY_LABEL,
  EVENT_KINDS,
  EVENT_KIND_LABEL,
  IMPORTANCE_LABEL,
} from "@/lib/macro-calendar";
import { saveEventAction } from "../actions";
import { emptyCalendarFormState } from "../form-state";

/** ⚠ 보이는 문자열은 위쪽에 모은다 — 나중에 다국어를 넣을 때 여기만 본다. */
const TEXT = {
  title: "무슨 일정",
  titlePlaceholder: "8월 CPI 발표 / FOMC 정례회의 / 엔비디아 실적",
  day: "날짜",
  time: "시각 (모르면 비워 두세요)",
  kind: "종류",
  country: "국가",
  importance: "중요도",
  note: "무엇을 볼 것인가 (선택)",
  notePlaceholder: "근원 물가가 3%를 밑도는지. 밑돌면 인하 기대가 살아난다",
  postSlug: "평가 글 주소 (선택 · 나중에 이어도 됩니다)",
  submit: "일정 추가",
  saving: "추가 중…",
  saved: "추가했습니다",
};

const field =
  "w-full rounded-xl border border-border bg-bg px-3 py-2 text-[13px] text-ink placeholder:text-ink-3";
const label = "block text-[11px] text-muted mb-1";

export function EventForm({ today }: { today: string }) {
  const [state, formAction, pending] = useActionState(saveEventAction, emptyCalendarFormState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-6">
        <label className="sm:col-span-4">
          <span className={label}>{TEXT.title}</span>
          <input name="title" placeholder={TEXT.titlePlaceholder} className={field} />
        </label>
        <label>
          <span className={label}>{TEXT.day}</span>
          <input type="date" name="day" defaultValue={today} className={field} />
        </label>
        <label>
          <span className={label}>{TEXT.time}</span>
          <input type="time" name="time" className={field} />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label>
          <span className={label}>{TEXT.kind}</span>
          <select name="kind" defaultValue="INDICATOR" className={field}>
            {EVENT_KINDS.map((k) => (
              <option key={k} value={k}>
                {EVENT_KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={label}>{TEXT.country}</span>
          <select name="country" defaultValue="US" className={field}>
            {EVENT_COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {EVENT_COUNTRY_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={label}>{TEXT.importance}</span>
          <select name="importance" defaultValue="2" className={field}>
            {[3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {IMPORTANCE_LABEL[n]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className={label}>{TEXT.note}</span>
        <input name="note" placeholder={TEXT.notePlaceholder} className={field} />
      </label>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="min-w-[240px] flex-1">
          <span className={label}>{TEXT.postSlug}</span>
          <input name="postSlug" placeholder="cpi-2026-08" className={`${field} font-mono`} />
        </label>

        <div className="flex items-center gap-3 pb-0.5">
          {state.error && (
            <span role="alert" className="text-[12px] text-danger">
              {state.error}
            </span>
          )}
          {state.savedAt && !state.error && (
            <span className="text-[12px] text-emerald-500">{TEXT.saved}</span>
          )}
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-gold-600/90 px-4 py-2 text-[13px] font-medium text-onAccent transition-colors hover:bg-gold-600 disabled:opacity-50"
          >
            {pending ? TEXT.saving : TEXT.submit}
          </button>
        </div>
      </div>
    </form>
  );
}

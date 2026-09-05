"use client";

/**
 * AI 일정 초안 패널 — **후보를 보여 주고, 고르게 한다.**
 *
 * ⚠ 자동으로 저장하지 않는다. 받아 온 것은 전부 후보이고, 채택 버튼을 누르는 것은 사람이다.
 *    날짜는 이 사이트에서 가장 위험한 값이라, 마지막 한 걸음을 사람에게 남긴다.
 * ⚠ **버린 후보도 보여 준다.** 몇 건이 왜 걸러졌는지 보이지 않으면, 이 화면은 곧
 *    "가끔 적게 가져오는 버튼"이 된다.
 */
import { useActionState } from "react";
import { Badge } from "@/components/ui/Badge";
import { EVENT_COUNTRY_LABEL, EVENT_KIND_LABEL, IMPORTANCE_LABEL } from "@/lib/macro-calendar";
import type { EventCountry, EventKind } from "@/lib/macro-calendar";
import { adoptDraftsAction, draftEventsAction } from "../ai-actions";
import { emptyCalendarDraftState } from "../draft-state";

/** ⚠ 보이는 문자열은 위쪽에 모은다 — 다국어를 넣을 때 여기만 본다. */
const TEXT = {
  ask: "AI에게 초안 받기",
  asking: "물어보는 중…",
  hint: "앞으로 8주의 일정을 후보로 받아옵니다. 캘린더에는 고른 것만 들어갑니다.",
  none: "받아온 후보가 없습니다.",
  adopt: "고른 일정 채택",
  adopting: "채택 중…",
  rejected: "걸러낸 후보",
  by: "답한 곳",
  basis: "근거",
};

const button =
  "rounded-xl border border-border px-3 py-2 text-[12.5px] text-muted transition-colors hover:border-gold-600/40 hover:text-ink disabled:opacity-50";

export function AiDraftPanel() {
  const [draft, askAction, asking] = useActionState(draftEventsAction, emptyCalendarDraftState);
  const [adopt, adoptAction, adopting] = useActionState(adoptDraftsAction, emptyCalendarDraftState);

  const items = draft.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <form action={askAction}>
          <button type="submit" className={button} disabled={asking}>
            {asking ? TEXT.asking : TEXT.ask}
          </button>
        </form>
        <p className="text-[12px] text-muted">{TEXT.hint}</p>
      </div>

      {draft.error && <p className="text-[12.5px] text-danger">{draft.error}</p>}

      {draft.attempts && draft.attempts.some((a) => !a.ok) && (
        <ul className="space-y-1">
          {draft.attempts
            .filter((a) => !a.ok)
            .map((a) => (
              <li key={`${a.providerLabel}-${a.modelId}`} className="text-[11.5px] text-ink-3">
                {a.providerLabel} ({a.modelId}) — {a.error}
              </li>
            ))}
        </ul>
      )}

      {draft.provider && (
        <p className="text-[11.5px] text-ink-3">
          {TEXT.by}: {draft.provider} · {draft.model}
        </p>
      )}

      {adopt.adopted !== undefined && (
        <p className="text-[12.5px] text-ink">
          채택 {adopt.adopted}건 · 건너뜀 {adopt.skipped ?? 0}건. 아래 목록에서 확인하세요.
        </p>
      )}
      {adopt.error && <p className="text-[12.5px] text-danger">{adopt.error}</p>}

      {draft.ranAt && items.length === 0 && <p className="text-[13px] text-muted">{TEXT.none}</p>}

      {items.length > 0 && (
        <form action={adoptAction} className="space-y-3">
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.externalId} className="flex gap-2.5">
                <input
                  type="checkbox"
                  name="pick"
                  value={JSON.stringify(item)}
                  defaultChecked
                  className="mt-1 accent-gold-600"
                  aria-label={`${item.day} ${item.title}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span className="font-mono text-[11px] text-ink-3">{item.day}</span>
                    <span className="text-[13px] text-ink">{item.title}</span>
                    <Badge tone="neutral">{EVENT_KIND_LABEL[item.kind as EventKind]}</Badge>
                    <span className="text-[11px] text-ink-3">
                      {EVENT_COUNTRY_LABEL[item.country as EventCountry]} ·{" "}
                      {IMPORTANCE_LABEL[item.importance]}
                    </span>
                  </div>
                  {item.note && (
                    <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{item.note}</p>
                  )}
                  <p className="mt-0.5 text-[11px] text-ink-3">
                    {TEXT.basis}: {item.basis}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <button type="submit" className={button} disabled={adopting}>
            {adopting ? TEXT.adopting : TEXT.adopt}
          </button>
        </form>
      )}

      {draft.rejected && draft.rejected.length > 0 && (
        <details className="text-[11.5px] text-ink-3">
          <summary className="cursor-pointer">
            {TEXT.rejected} ({draft.rejected.length}건)
          </summary>
          <ul className="mt-2 space-y-1">
            {draft.rejected.map((r, i) => (
              <li key={`${r.raw}-${i}`}>
                {r.raw} — {r.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

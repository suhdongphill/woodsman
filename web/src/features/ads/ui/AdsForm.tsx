"use client";

import { useActionState } from "react";
import type { AdsSettings } from "@/lib/ads";
import { saveAdsAction } from "../actions";
import { emptyAdsFormState } from "../form-state";

const field =
  "w-full rounded-xl border border-border bg-bg px-3 py-2 text-[13px] text-ink placeholder:text-ink-3 font-mono";
const label = "block text-[11px] text-muted mb-1";

/**
 * 광고 설정 입력.
 *
 * ⚠ **등록과 노출을 한 폼에 두되 스위치를 따로 뒀다.** ID를 넣는 것과 광고를 켜는 것은
 *    다른 결정이다 — 값만 넣어 두고 나중에 켜는 흐름이 실제 운영 순서다.
 * ⚠ 퍼블리셔 ID 없이는 켤 수 없다(서버가 다시 막는다). 화면에도 그렇게 적는다.
 */
export function AdsForm({ settings }: { settings: AdsSettings }) {
  const [state, formAction, pending] = useActionState(saveAdsAction, emptyAdsFormState);

  return (
    <form action={formAction} className="space-y-4">
      <label className="block">
        <span className={label}>퍼블리셔 ID — 애드센스 계정 홈에 있는 ca-pub- 로 시작하는 값</span>
        <input
          name="clientId"
          defaultValue={settings.clientId ?? ""}
          placeholder="ca-pub-0000000000000000"
          className={field}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-3">
        <label>
          <span className={label}>슬롯 · 글 본문 끝</span>
          <input
            name="articleEnd"
            defaultValue={settings.slots["article-end"] ?? ""}
            placeholder="1234567890"
            className={field}
          />
        </label>
        <label>
          <span className={label}>슬롯 · 목록 끝</span>
          <input
            name="feedEnd"
            defaultValue={settings.slots["feed-end"] ?? ""}
            placeholder="1234567890"
            className={field}
          />
        </label>
        <label>
          <span className={label}>슬롯 · 페이지 하단</span>
          <input
            name="contentBottom"
            defaultValue={settings.slots["content-bottom"] ?? ""}
            placeholder="1234567890"
            className={field}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
        <label className="flex items-start gap-2.5 text-[12.5px] text-ink">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={settings.enabled}
            className="mt-0.5 h-4 w-4 accent-[var(--w-series-1)]"
          />
          <span>
            광고를 실제로 내보낸다
            <span className="mt-0.5 block text-[11px] leading-relaxed text-ink-3">
              ⚠ 꺼 두면 ID를 저장해도 화면에 아무것도 나가지 않습니다. 퍼블리셔 ID 없이는 켤 수
              없습니다.
            </span>
          </span>
        </label>

        <div className="flex items-center gap-3">
          {state.error && (
            <span role="alert" className="text-[12px] text-danger">
              {state.error}
            </span>
          )}
          {state.savedAt && !state.error && (
            <span className="text-[12px] text-emerald-500">
              저장했습니다 · 광고 {state.enabled ? "켜짐" : "꺼짐"}
            </span>
          )}
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-gold-600/90 px-4 py-2 text-[13px] font-medium text-onAccent transition-colors hover:bg-gold-600 disabled:opacity-50"
          >
            {pending ? "저장 중…" : "저장"}
          </button>
        </div>
      </div>
    </form>
  );
}

/**
 * AI 일정 초안의 폼 상태. `"use server"` 파일은 async 함수만 export할 수 있어 여기 둔다
 * (CLAUDE.md 6장 — 어기면 액션 호출이 500으로 죽는다).
 */
import type { DraftEvent, RejectedDraft } from "@/lib/calendar-draft";

export type CalendarDraftState = {
  /** 채택 후보 */
  items?: DraftEvent[];
  /** ⚠ 버린 것도 함께 보여준다. 조용히 사라지면 "못 찾았다"와 "전부 거절됐다"가 같아 보인다. */
  rejected?: RejectedDraft[];
  /** 누가 답했나 — 화면에 그대로 적는다 */
  provider?: string;
  model?: string;
  /** 시도 기록(실패 포함). 조용한 폴백을 만들지 않기 위한 것 */
  attempts?: { providerLabel: string; modelId: string; ok: boolean; error?: string }[];
  error?: string;
  ranAt?: string;
  /** 채택 결과 */
  adopted?: number;
  skipped?: number;
};

export const emptyCalendarDraftState: CalendarDraftState = {};

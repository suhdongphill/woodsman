/** 캘린더 폼 상태. `"use server"` 파일은 async 함수만 export할 수 있어 여기 둔다. */
export type CalendarFormState = {
  error?: string;
  savedAt?: string;
};

export const emptyCalendarFormState: CalendarFormState = {};

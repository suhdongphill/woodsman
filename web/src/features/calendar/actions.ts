"use server";

/**
 * 경제 캘린더 서버 액션.
 *
 * ⚠ `requireAdmin`을 먼저 부른다.
 * ⚠ 이 파일은 async 함수만 export한다(상수·타입은 `form-state.ts`).
 */
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { isEventCountry, isEventKind, isImportance } from "@/lib/macro-calendar";
import { recordAdminLog } from "@/features/admin-log/repository";
import { createEvent, deleteEvent, linkPost } from "./repository";
import { emptyCalendarFormState, type CalendarFormState } from "./form-state";

function text(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

/** 캘린더가 나가는 화면을 전부 갱신한다. */
function revalidateAll() {
  for (const path of ["/", "/macro", "/macro/calendar", "/calendar.ics", "/admin/calendar"]) {
    revalidatePath(path);
  }
}

export async function saveEventAction(
  _prev: CalendarFormState,
  formData: FormData,
): Promise<CalendarFormState> {
  const admin = await requireAdmin("/admin/calendar");

  const title = text(formData, "title");
  if (title.length < 2) return { error: "무슨 일정인지 적어 주세요." };

  const day = text(formData, "day");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { error: "날짜를 고르세요." };

  const kind = text(formData, "kind");
  if (!isEventKind(kind)) return { error: "종류를 고르세요." };

  const country = text(formData, "country");
  if (!isEventCountry(country)) return { error: "국가를 고르세요." };

  const importance = Number(text(formData, "importance"));
  if (!isImportance(importance)) return { error: "중요도는 1·2·3 중 하나입니다." };

  /**
   * ⚠ 시각을 안 적으면 **그 날 정오(UTC)** 로 넣는다.
   *    자정으로 넣으면 KST 화면에서 하루가 밀린다(이 프로젝트가 이미 겪은 사고다).
   */
  const time = text(formData, "time");
  /**
   * ⚠ 시각을 안 적었으면 **모른다고 저장한다**(`timeKnown: false`).
   *    자리는 정오(UTC)로 채우지만 화면은 그 값을 그리지 않는다 —
   *    그대로 그리면 KST 21:00으로 보여서 **모르는 것을 아는 것처럼 단언**하게 된다.
   */
  const timeKnown = /^\d{2}:\d{2}$/.test(time);
  const at = timeKnown
    ? new Date(`${day}T${time}:00+09:00`).toISOString()
    : `${day}T12:00:00.000Z`;

  try {
    await createEvent({
      at,
      title,
      kind,
      country,
      importance,
      note: text(formData, "note") || undefined,
      postSlug: text(formData, "postSlug") || undefined,
      timeKnown,
    });
  } catch (error) {
    console.error("[calendar] 저장 실패", error);
    return { error: "저장하지 못했습니다. 잠시 후 다시 시도하세요." };
  }

  await recordAdminLog({
    actor: admin.email,
    action: "calendar.create",
    target: day,
    summary: title,
  });

  revalidateAll();
  return { ...emptyCalendarFormState, savedAt: new Date().toISOString() };
}

/** 평가 글 잇기 — 지난 일정에 글을 붙인다. 빈 값이면 연결을 끊는다. */
export async function linkPostAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin("/admin/calendar");
  const id = text(formData, "id");
  if (!id) return;

  const slug = text(formData, "postSlug");
  await linkPost(id, slug || null);
  await recordAdminLog({
    actor: admin.email,
    action: "calendar.link",
    target: id,
    summary: slug ? `평가 글 ${slug}` : "연결 해제",
  });
  revalidateAll();
}

export async function deleteEventAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin("/admin/calendar");
  const id = text(formData, "id");
  if (!id) return;

  await deleteEvent(id);
  await recordAdminLog({ actor: admin.email, action: "calendar.delete", target: id });
  revalidateAll();
}

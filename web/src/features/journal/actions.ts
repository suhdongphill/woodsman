"use server";

/**
 * 투자일지 · 계좌 스냅샷 서버 액션.
 *
 * 이 사이트의 주력 콘텐츠를 만드는 경로다. 전에는 화면이 목업 파일을 읽어서
 * **저장 버튼이 아무 일도 하지 않았다.** 이제 D1에 실제로 쓴다.
 *
 * ⚠ 모든 액션이 `requireAdmin`을 먼저 부른다. 미들웨어는 1차 방어선일 뿐이라
 *    액션 자체가 스스로 확인해야 한다(matcher를 고치는 순간 구멍이 난다).
 */
import { revalidatePath } from "next/cache";
import {
  deleteJournalEntry,
  deleteSnapshot,
  saveJournalEntry,
  saveSnapshot,
} from "./repository";
import { firstIssue, journalSchema, snapshotSchema } from "./schema";
import { emptyJournalFormState, type JournalFormState } from "./form-state";
import { requireAdmin } from "@/lib/session";

function text(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

function checked(formData: FormData, key: string): boolean {
  const v = formData.get(key);
  return v === "on" || v === "true";
}

/** 저장 후 공개 화면까지 갱신한다 — 관리자만 바뀌고 사이트는 그대로면 고친 줄 모른다. */
function revalidateAll() {
  revalidatePath("/admin/journal");
  revalidatePath("/journal");
  revalidatePath("/portfolio");
  revalidatePath("/");
}

export async function saveJournalAction(
  _prev: JournalFormState,
  formData: FormData,
): Promise<JournalFormState> {
  await requireAdmin("/admin/journal");

  const parsed = journalSchema.safeParse({
    date: text(formData, "date"),
    action: text(formData, "action"),
    title: text(formData, "title"),
    body: text(formData, "body"),
    ticker: text(formData, "ticker"),
    name: text(formData, "name"),
    shares: text(formData, "shares"),
    price: text(formData, "price"),
    currency: text(formData, "currency") || undefined,
    postSlug: text(formData, "postSlug"),
    published: checked(formData, "published"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const id = text(formData, "id") || undefined;
  try {
    await saveJournalEntry(parsed.data, id);
  } catch (error) {
    console.error("[journal] 저장 실패", error);
    return { error: "저장하지 못했습니다. 잠시 후 다시 시도하세요." };
  }

  revalidateAll();
  return { savedAt: new Date().toISOString(), ...emptyJournalFormState };
}

export async function deleteJournalAction(formData: FormData): Promise<void> {
  await requireAdmin("/admin/journal");
  const id = text(formData, "id");
  if (!id) return;

  await deleteJournalEntry(id);
  revalidateAll();
}

export async function saveSnapshotAction(
  _prev: JournalFormState,
  formData: FormData,
): Promise<JournalFormState> {
  await requireAdmin("/admin/journal");

  const parsed = snapshotSchema.safeParse({
    date: text(formData, "date"),
    principal: text(formData, "principal"),
    value: text(formData, "value"),
    income: text(formData, "income"),
    memo: text(formData, "memo"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  try {
    await saveSnapshot(parsed.data);
  } catch (error) {
    console.error("[journal] 스냅샷 저장 실패", error);
    return { error: "저장하지 못했습니다. 날짜 형식을 확인하세요." };
  }

  revalidateAll();
  return { savedAt: new Date().toISOString() };
}

export async function deleteSnapshotAction(formData: FormData): Promise<void> {
  await requireAdmin("/admin/journal");
  const date = text(formData, "date");
  if (!date) return;

  await deleteSnapshot(date);
  revalidateAll();
}

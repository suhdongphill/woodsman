"use server";

/**
 * 블로그 글 목록 — 관리자 조작(지금 수집 · 숨기기 · 요약 고쳐 쓰기).
 * ⚠ 모든 액션이 `requireAdmin`을 먼저 부른다.
 * ⚠ `"use server"` 파일은 async 함수만 export한다(CLAUDE.md §6).
 */
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { setBlogHidden, setBlogSummaryOverride } from "./repository";
import { syncBlog } from "./sync";

/** 운영자 요약의 최대 길이 — 두 줄이면 충분하다. 본문을 옮겨 적는 칸이 아니다. */
const SUMMARY_MAX = 200;

function text(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

function entryIdOf(formData: FormData): number | null {
  const raw = text(formData, "entryId");
  return /^\d{1,9}$/.test(raw) ? Number(raw) : null;
}

function revalidateAll() {
  revalidatePath("/admin/blog");
  revalidatePath("/blog");
  revalidatePath("/");
}

/** 지금 수집 — 예약 수집과 **같은 함수**다. 결과는 `BlogSync`에 남고 화면이 그 기록을 읽는다. */
export async function syncBlogNowAction(): Promise<void> {
  await requireAdmin("/admin/blog");
  await syncBlog("MANUAL");
  revalidateAll();
}

/** 전부 다시 읽기 — 요약·제목 규칙이 바뀐 뒤 25편을 한 번에 새로 읽는다. 운영자 요약·숨김은 그대로다. */
export async function syncBlogAllAction(): Promise<void> {
  await requireAdmin("/admin/blog");
  await syncBlog("MANUAL", { force: true });
  revalidateAll();
}

export async function setBlogHiddenAction(formData: FormData): Promise<void> {
  await requireAdmin("/admin/blog");
  const id = entryIdOf(formData);
  if (id === null) return;
  await setBlogHidden(id, text(formData, "hidden") === "1");
  revalidateAll();
}

/** 요약 고쳐 쓰기. 비우면 티스토리 자동 요약으로 돌아간다. ⚠ 넘치면 **자르지 않고 저장하지 않는다**(잘린 문장이 공개되지 않게). */
export async function setBlogSummaryAction(formData: FormData): Promise<void> {
  await requireAdmin("/admin/blog");
  const id = entryIdOf(formData);
  if (id === null) return;
  const summary = text(formData, "summary").trim();
  if (summary.length > SUMMARY_MAX) {
    console.error(`[blog] 요약이 ${SUMMARY_MAX}자를 넘어 저장하지 않았다(글 ${id}, ${summary.length}자)`);
    return;
  }
  await setBlogSummaryOverride(id, summary || null);
  revalidateAll();
}

"use server";

/**
 * 파도 기사 — 관리자 입력(유가 · 지정학 · 금리 · 환율 …). 통합 계획 S3b.
 * ⚠ 모든 액션이 `requireAdmin`을 먼저 부른다.
 * ⚠ 본문을 받지 않는다 — 제목 · 원문 링크 · 날짜 · **우리가 쓴 한 줄 요약**(최대 200자)만(저작권).
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/session";
import type { NewsCategory } from "@/lib/news/feeds";
import { MANUAL_NEWS_CATEGORIES, NEWS_SUMMARY_MAX, type NewsFormState } from "./form-state";
import { saveManualNews, setNewsHidden } from "./repository";

function text(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

const schema = z.object({
  category: z
    .string()
    .trim()
    .refine((v) => (MANUAL_NEWS_CATEGORIES as string[]).includes(v), "분류를 고르세요.")
    // 목록 검사를 통과한 뒤에만 분류 타입으로 좁힌다
    .transform((v) => v as NewsCategory),
  title: z.string().trim().min(4, "제목을 적으세요.").max(200, "제목이 너무 깁니다."),
  // ⚠ 원문 링크는 https만 — 출처를 되짚을 수 없는 기사는 올리지 않는다.
  url: z.string().trim().url("원문 링크를 확인하세요.").refine((v) => v.startsWith("https://"), "https 링크만 받습니다."),
  publishedAt: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "기사 날짜를 확인하세요."),
  summary: z
    .string()
    .trim()
    .max(NEWS_SUMMARY_MAX, `요약은 ${NEWS_SUMMARY_MAX}자까지입니다 — 본문을 옮기지 않습니다.`)
    .transform((v) => (v === "" ? undefined : v))
    .optional(),
  speaker: z
    .string()
    .trim()
    .max(60)
    .transform((v) => (v === "" ? undefined : v))
    .optional(),
});

function revalidateAll() {
  revalidatePath("/admin/news");
  revalidatePath("/");
}

export async function saveManualNewsAction(_prev: NewsFormState, formData: FormData): Promise<NewsFormState> {
  await requireAdmin("/admin/news");
  const parsed = schema.safeParse({
    category: text(formData, "category"),
    title: text(formData, "title"),
    url: text(formData, "url"),
    publishedAt: text(formData, "publishedAt"),
    summary: text(formData, "summary"),
    speaker: text(formData, "speaker"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "입력을 확인하세요." };
  try {
    await saveManualNews({
      ...parsed.data,
      // ⚠ 날짜만 있는 값은 정오(UTC)로 — 자정이면 화면에서 하루가 밀린다(CLAUDE.md §6)
      publishedAt: `${parsed.data.publishedAt}T12:00:00.000Z`,
    });
  } catch (error) {
    console.error("[news] 관리자 기사 저장 실패", error);
    return { error: "저장하지 못했습니다. 잠시 뒤 다시 시도하세요." };
  }
  revalidateAll();
  return { savedAt: new Date().toISOString() };
}

export async function setNewsHiddenAction(formData: FormData): Promise<void> {
  await requireAdmin("/admin/news");
  const id = text(formData, "id");
  const hidden = text(formData, "hidden") === "1";
  if (!id) return;
  await setNewsHidden(id, hidden);
  revalidateAll();
}

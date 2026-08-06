"use server";

/**
 * 버블 모니터 서버 액션 — 지표 채점 · 트리거 상태 기록.
 * ⚠ 모든 액션이 `requireAdmin`을 먼저 부른다.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/session";
import { findBubbleIndicator, BUBBLE_TRIGGERS } from "@/lib/bubble/catalog";
import type { BubblePoints } from "@/lib/bubble/types";
import { deleteReading, saveReading, saveTriggerState } from "./repository";
import type { BubbleFormState } from "./form-state";

function text(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

const day = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .refine((v) => v === undefined || /^\d{4}-\d{2}-\d{2}$/.test(v), "기준일 형식을 확인하세요.")
  .optional();

const readingSchema = z.object({
  indicatorKey: z
    .string()
    .trim()
    .refine((k) => !!findBubbleIndicator(k), "없는 지표입니다."),
  points: z
    .string()
    .trim()
    .refine((v) => v === "0" || v === "1" || v === "2", "점수는 0·1·2 중 하나입니다."),
  value: z
    .string()
    .trim()
    .transform((v) => (v === "" ? undefined : v))
    .optional(),
  asOf: day,
  note: z
    .string()
    .trim()
    .transform((v) => (v === "" ? undefined : v))
    .optional(),
});

function revalidateAll() {
  revalidatePath("/admin/bubble");
  revalidatePath("/macro/bubble");
  revalidatePath("/macro");
}

export async function saveReadingAction(
  _prev: BubbleFormState,
  formData: FormData,
): Promise<BubbleFormState> {
  await requireAdmin("/admin/bubble");

  const parsed = readingSchema.safeParse({
    indicatorKey: text(formData, "indicatorKey"),
    points: text(formData, "points"),
    value: text(formData, "value"),
    asOf: text(formData, "asOf"),
    note: text(formData, "note"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "입력값을 확인하세요." };

  try {
    await saveReading({
      ...parsed.data,
      points: Number(parsed.data.points) as BubblePoints,
    });
  } catch (error) {
    console.error("[bubble] 채점 저장 실패", error);
    return { error: "저장하지 못했습니다." };
  }

  revalidateAll();
  return { savedAt: new Date().toISOString() };
}

export async function clearReadingAction(formData: FormData): Promise<void> {
  await requireAdmin("/admin/bubble");
  const key = text(formData, "indicatorKey");
  if (!key) return;

  // ⚠ 지우면 결측이 된다(0점이 아니다). 화면이 그렇게 보여준다.
  await deleteReading(key);
  revalidateAll();
}

const triggerSchema = z.object({
  key: z.string().trim().refine((k) => BUBBLE_TRIGGERS.some((t) => t.key === k), "없는 트리거입니다."),
  proximity: z.enum(["far", "near"]),
  fired: z.boolean(),
  now: z
    .string()
    .trim()
    .transform((v) => (v === "" ? undefined : v))
    .optional(),
  asOf: day,
});

export async function saveTriggerAction(
  _prev: BubbleFormState,
  formData: FormData,
): Promise<BubbleFormState> {
  await requireAdmin("/admin/bubble");

  const parsed = triggerSchema.safeParse({
    key: text(formData, "key"),
    proximity: text(formData, "proximity") || "far",
    fired: formData.get("fired") === "on" || formData.get("fired") === "true",
    now: text(formData, "now"),
    asOf: text(formData, "asOf"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "입력값을 확인하세요." };

  try {
    await saveTriggerState(parsed.data);
  } catch (error) {
    console.error("[bubble] 트리거 저장 실패", error);
    return { error: "저장하지 못했습니다." };
  }

  revalidateAll();
  return { savedAt: new Date().toISOString() };
}

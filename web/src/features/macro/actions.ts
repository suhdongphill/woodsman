"use server";

/**
 * 거시 지표 서버 액션 — 자료 가져오기 · 수동 지표 입력.
 *
 * ⚠ 모든 액션이 `requireAdmin`을 먼저 부른다. 외부에 요청을 날리는 버튼이라
 *    아무나 누를 수 있으면 그대로 남의 서버를 두드리는 도구가 된다.
 */
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { indicatorsByGroup } from "@/lib/macro/catalog";
import type { MacroGroupKey } from "@/lib/macro/groups";
import { ingestMacro } from "./ingest";
import { deletePoint, saveManualPoint } from "./repository";
import { firstIssue, manualPointSchema } from "./schema";
import { emptyMacroFormState, type MacroFormState } from "./form-state";
import { recordAdminLog } from "@/features/admin-log/repository";

function text(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

/** 지표가 바뀌면 공개 화면도 같이 바뀌어야 한다. */
function revalidateAll() {
  revalidatePath("/admin/macro");
  revalidatePath("/macro");
  revalidatePath("/");
}

export async function ingestMacroAction(
  _prev: MacroFormState,
  formData: FormData,
): Promise<MacroFormState> {
  const admin = await requireAdmin("/admin/macro");

  const group = text(formData, "group");
  const keys = group
    ? indicatorsByGroup(group as MacroGroupKey)
        .filter((i) => i.source !== "MANUAL")
        .map((i) => i.key)
    : undefined;

  try {
    const result = await ingestMacro({ trigger: "MANUAL", keys });

    // ⚠ 바깥 서버를 두드리는 버튼이다. 언제 누가 눌렀는지가 남아야 한다.
    await recordAdminLog({
      actor: admin.email,
      action: "macro.ingest",
      target: group || "전체",
      summary: `지표 ${result.okCount}개 갱신 · 실패 ${result.failCount}개`,
    });

    revalidateAll();

    const failures = result.detail
      .filter((d) => !d.ok)
      .map((d) => ({ key: d.key, error: d.error ?? "알 수 없는 오류" }));

    return {
      ...emptyMacroFormState,
      savedAt: new Date().toISOString(),
      summary:
        `지표 ${result.okCount}개 갱신 · 새로 쌓인 값 ${result.addedPoints.toLocaleString("ko-KR")}개` +
        (result.failCount > 0 ? ` · 실패 ${result.failCount}개` : ""),
      failures,
    };
  } catch (error) {
    console.error("[macro] 자료 가져오기 실패", error);
    return { error: "자료를 가져오지 못했습니다. 잠시 후 다시 시도하세요." };
  }
}

export async function saveManualPointAction(
  _prev: MacroFormState,
  formData: FormData,
): Promise<MacroFormState> {
  await requireAdmin("/admin/macro");

  const parsed = manualPointSchema.safeParse({
    seriesKey: text(formData, "seriesKey"),
    date: text(formData, "date"),
    value: text(formData, "value"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  try {
    await saveManualPoint(parsed.data.seriesKey, parsed.data.date, parsed.data.value);
  } catch (error) {
    console.error("[macro] 수동 지표 저장 실패", error);
    return { error: "저장하지 못했습니다. 잠시 후 다시 시도하세요." };
  }

  revalidateAll();
  return { savedAt: new Date().toISOString() };
}

export async function deleteMacroPointAction(formData: FormData): Promise<void> {
  await requireAdmin("/admin/macro");
  const seriesKey = text(formData, "seriesKey");
  const date = text(formData, "date");
  if (!seriesKey || !date) return;

  await deletePoint(seriesKey, date);
  revalidateAll();
}

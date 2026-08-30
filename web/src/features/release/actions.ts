"use server";

/**
 * 릴리스 기록 서버 액션.
 *
 * ⚠ `requireAdmin`을 먼저 부른다.
 * ⚠ 이 파일은 async 함수만 export한다(상수·타입은 `form-state.ts`).
 */
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { recordAdminLog } from "@/features/admin-log/repository";
import { createRelease, deleteRelease } from "./repository";
import { emptyReleaseFormState, type ReleaseFormState } from "./form-state";

function text(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

const KINDS = new Set(["LAYOUT", "COPY", "NAV", "VISUAL", "CONTENT", "FIX"]);
const METRICS = new Set(["TISTORY_CLICK", "VIEWS"]);

export async function saveReleaseAction(
  _prev: ReleaseFormState,
  formData: FormData,
): Promise<ReleaseFormState> {
  const admin = await requireAdmin("/admin/releases");

  const title = text(formData, "title");
  if (title.length < 2) return { error: "무엇을 바꿨는지 한 줄로 적어 주세요." };

  const kind = text(formData, "kind");
  if (!KINDS.has(kind)) return { error: "변경 종류를 고르세요." };

  const metric = text(formData, "metric");
  if (!METRICS.has(metric)) return { error: "무엇으로 볼지 고르세요." };

  const day = text(formData, "day");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { error: "배포한 날짜를 고르세요." };

  try {
    await createRelease({
      // ⚠ 날짜만 있는 값은 **정오(UTC)** 로 저장한다. 자정으로 넣으면 화면에서 하루가 밀린다.
      at: `${day}T12:00:00.000Z`,
      title,
      kind,
      hypothesis: text(formData, "hypothesis") || undefined,
      metric,
      commitHash: text(formData, "commit") || undefined,
    });
  } catch (error) {
    console.error("[release] 저장 실패", error);
    return { error: "저장하지 못했습니다. 잠시 후 다시 시도하세요." };
  }

  await recordAdminLog({
    actor: admin.email,
    action: "release.create",
    target: day,
    summary: title,
  });

  revalidatePath("/admin/releases");
  return { ...emptyReleaseFormState, savedAt: new Date().toISOString() };
}

export async function deleteReleaseAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin("/admin/releases");
  const id = text(formData, "id");
  if (!id) return;

  await deleteRelease(id);
  await recordAdminLog({ actor: admin.email, action: "release.delete", target: id });
  revalidatePath("/admin/releases");
}

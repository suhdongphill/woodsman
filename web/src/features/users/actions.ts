"use server";

/**
 * 사용자 삭제 액션.
 *
 * ⚠ `requireAdmin`을 먼저 부르고, 그다음 **지워도 되는지**를 순수 규칙으로 판단한다
 *    (`lib/user-delete.ts`). 화면의 버튼을 감추는 것만으로는 막을 수 없다 —
 *    폼은 직접 만들어 보낼 수 있다.
 */
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { decideUserDelete } from "@/lib/user-delete";
import { countAdmins, deleteUser, findDeleteTarget } from "./repository";
import type { UserFormState } from "./form-state";

export async function deleteUserAction(
  _prev: UserFormState,
  formData: FormData,
): Promise<UserFormState> {
  const me = await requireAdmin("/admin/users");

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "삭제할 계정을 찾지 못했습니다." };

  const [target, adminCount] = await Promise.all([findDeleteTarget(id), countAdmins()]);
  const decision = decideUserDelete({ target, currentUserId: me.id, adminCount });
  if (!decision.allowed) return { error: decision.reason };

  try {
    await deleteUser(id);
  } catch (error) {
    console.error("[users] 삭제 실패", error);
    return { error: "삭제하지 못했습니다. 잠시 후 다시 시도하세요." };
  }

  // 성공하면 목록에서 그 줄이 사라진다 — 따로 알릴 것이 없다.
  revalidatePath("/admin/users");
  return {};
}

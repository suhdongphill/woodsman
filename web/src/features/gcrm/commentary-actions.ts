"use server";

/**
 * GCRM 조류 해설 — 초안 만들기 · 승인 · 반려(2026-11-14 · v3).
 *
 * (초안 만들기는 `commentary-service.ts` — 06:00 예약 작업도 같은 함수를 부른다.)
 * 흐름: 최신 run의 저장값 → 사실표 → AI 초안 → **서버 숫자 대조**(`verifyCommentary`) → DRAFT(통과) 또는 FAILED(사유와 함께).
 * ⚠ 공개는 운영자가 승인한 것만(운영지침 §4 「GCRM 해설 공개 순서」 · 운영자 「b로」). 이 파일은 공개 화면을 바꾸지 않는다.
 * ⚠ 같은 run·같은 프롬프트 판에 살아 있는 초안이 있으면 다시 만들지 않는다(중복 발행 방지). 실패는 다시 시도할 수 있다.
 * ⚠ 이 파일은 async 함수만 export한다.
 */
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { recordAdminLog } from "@/features/admin-log/repository";
import { decideNarrative } from "./commentary-repo";
import { generateCommentaryDraft } from "./commentary-service";

/** ⚠ 만드는 일은 `commentary-service`가 한다 — 06:00 예약 작업과 같은 함수(2026-11-15). 여기는 권한과 화면 갱신만. */
export async function generateCommentaryAction(): Promise<void> {
  const admin = await requireAdmin("/admin/commentary");
  await generateCommentaryDraft(admin.email ?? "(관리자)");
  revalidatePath("/admin/commentary");
}

export async function decideCommentaryAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin("/admin/commentary");
  const id = String(formData.get("id") ?? "");
  const raw = formData.get("decision");
  /**
   * ⚠ 2026-11-14 사고: 승인·반려를 한 폼의 두 버튼(`name="decision"`)으로 보냈는데 누른 버튼의 값이 오지 않았고,
   *    값이 없으면 REJECTED로 치던 기본값 때문에 **승인을 눌렀는데 반려로 저장됐다.** 이제 폼을 나눠 숨은 값으로 보내고,
   *    값이 둘 중 하나가 아니면 **아무것도 바꾸지 않는다**(결정을 기본값으로 만들지 않는다).
   */
  if (raw !== "APPROVED" && raw !== "REJECTED") {
    console.error("[gcrm-commentary] 결정 값이 없거나 이상하다 — 바꾸지 않는다", raw);
    await recordAdminLog({ actor: admin.email, action: "gcrm.commentary.decide-invalid", target: id, summary: `decision=${String(raw)}` });
    revalidatePath("/admin/commentary");
    return;
  }
  const decision = raw;
  const ok = await decideNarrative(id, decision, admin.email ?? "(알 수 없음)");
  await recordAdminLog({
    actor: admin.email,
    action: `gcrm.commentary.${decision === "APPROVED" ? "approve" : "reject"}`,
    target: id,
    summary: ok ? decision : "초안이 아니라 바꾸지 않았다",
  });
  revalidatePath("/admin/commentary");
}

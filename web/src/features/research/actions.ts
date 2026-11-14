"use server";

/**
 * 연구 라이브러리 — 가져오기 · 검증 상태 기록.
 * ⚠ 관리자 전용. 운영 GCRM 점수·가중치·임계값에 쓰는 경로가 **없다**(연구는 후보다).
 * ⚠ 이 파일은 async 함수만 export한다(상태 타입은 `form-state.ts`).
 */
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { recordAdminLog } from "@/features/admin-log/repository";
import { isVerifyStatus, parseResearchFile, planImport, VERIFY_LABEL } from "@/lib/research/import";
import { applyResearchImport, loadResearch, setResearchVerify } from "./repository";
import type { ResearchImportState, ResearchVerifyState } from "./form-state";

/** 지금 파일은 24KB다. 넉넉히 잡되 끝없이 받지는 않는다. */
const MAX_BYTES = 1024 * 1024;

export async function importResearchAction(_prev: ResearchImportState, formData: FormData): Promise<ResearchImportState> {
  const admin = await requireAdmin("/admin/research");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Research Lab에서 내보낸 JSON 파일을 고르세요." };
  if (file.size > MAX_BYTES) return { error: `파일이 너무 큽니다(${Math.round(file.size / 1024)}KB · 상한 1MB).` };

  const parsed = parseResearchFile(await file.text());
  if (!parsed.ok) return { error: "파일을 넣지 않았습니다 — 아래를 고친 뒤 다시 올려 주세요.", errors: parsed.errors };

  let existing;
  try {
    existing = await loadResearch();
  } catch (error) {
    console.error("[research] 기존 연구를 읽지 못했다 — 중복 판정을 할 수 없어 가져오지 않는다", error);
    return { error: "기존 연구 목록을 읽지 못해 가져오지 않았습니다(중복 판정 불가)." };
  }
  const plan = planImport(parsed.file.papers, existing);

  try {
    await applyResearchImport({ plan, file: parsed.file, fileName: file.name, actor: admin.email ?? "(알 수 없음)" });
  } catch {
    return { error: "저장하지 못했습니다 — 아무것도 들어가지 않았습니다." };
  }

  await recordAdminLog({
    actor: admin.email,
    action: "research.import",
    target: file.name,
    summary: `새로 ${plan.insert.length} · 고침 ${plan.update.length} · 그대로 ${plan.unchanged.length} · 확인 필요 ${plan.conflicts.length}`,
  });
  revalidatePath("/admin/research");
  return {
    done: {
      inserted: plan.insert.length,
      updated: plan.update.length,
      unchanged: plan.unchanged.length,
      conflicts: plan.conflicts,
    },
  };
}

/** 검증 상태를 올리거나 내린다. ⚠ 메모(무엇을 근거로)가 없으면 거절한다 — 기록 없는 상태 변경은 남기지 않는다. */
export async function setResearchVerifyAction(_prev: ResearchVerifyState, formData: FormData): Promise<ResearchVerifyState> {
  const admin = await requireAdmin("/admin/research");
  const id = String(formData.get("id") ?? "");
  const status = formData.get("status");
  const note = String(formData.get("note") ?? "").trim();
  if (!isVerifyStatus(status)) return { error: "검증 상태를 고르세요." };
  if (note.length < 5) return { error: "근거 메모를 적어 주세요(무엇을 확인했는지 · 어디에 기록했는지)." };
  if (note.length > 2000) return { error: "메모가 너무 깁니다(2,000자)." };

  const ok = await setResearchVerify(id, status, note);
  if (!ok) return { error: "그 연구를 찾지 못했습니다." };
  await recordAdminLog({
    actor: admin.email,
    action: "research.verify",
    target: id,
    summary: `${VERIFY_LABEL[status]} · ${note.slice(0, 120)}`,
  });
  revalidatePath("/admin/research");
  return { savedAt: new Date().toISOString() };
}

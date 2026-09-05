"use server";

/**
 * AI 제공자 설정 서버 액션.
 *
 * 키 등록은 **로컬 개발 서버에서만** 받는다(`saveAiKeyAction`).
 * 받은 값은 `.env` 파일에 바로 쓰고, ⚠ **DB에는 절대 저장하지 않는다.**
 * 배포본(Workers)은 파일 시스템이 없어 이 경로가 애초에 동작하지 않는다 —
 * 거기에는 `npm run ai:sync`로 시크릿을 올린다.
 *
 * 그 외 조작할 수 있는 것은 **켜고 끄기와 월 상한**뿐이다.
 */
import { revalidatePath } from "next/cache";
import { setProviderCap, setProviderEnabled } from "./repository";
import { deleteApiKey, isStoredKeyName, saveApiKey } from "./credentials";
import { allApiKeyEnvNames } from "@/lib/ai/catalog";
import { recordAdminLog } from "@/features/admin-log/repository";
import { requireAdmin } from "@/lib/session";
import type { KeyFormState } from "./key-form-state";

/** 카탈로그에 있는 env 이름만 허용 — 폼 값으로 임의 컬럼을 건드리지 못하게. */
function assertKnownEnv(name: string): string {
  if (!allApiKeyEnvNames().includes(name)) {
    throw new Error(`알 수 없는 제공자입니다: ${name}`);
  }
  return name;
}

/** 키 보관함이 다루는 이름인가 — ⚠ AI 제공자보다 넓다(ECOS도 여기 들어온다). */
function assertStoredKeyName(name: string): string {
  if (!isStoredKeyName(name)) throw new Error(`알 수 없는 항목입니다: ${name}`);
  return name;
}

export async function toggleProviderAction(formData: FormData): Promise<void> {
  await requireAdmin("/admin/ai");
  const apiKeyEnv = assertKnownEnv(String(formData.get("apiKeyEnv") ?? ""));
  const enabled = String(formData.get("enabled")) === "true";

  await setProviderEnabled(apiKeyEnv, enabled);
  revalidatePath("/admin/ai");
}

export async function updateCapAction(formData: FormData): Promise<void> {
  await requireAdmin("/admin/ai");
  const apiKeyEnv = assertKnownEnv(String(formData.get("apiKeyEnv") ?? ""));

  const raw = String(formData.get("cap") ?? "").trim();
  // 빈 값 = 무제한. 유료 제공자에서 이걸 고르면 화면이 경고를 띄운다.
  const cap = raw === "" ? null : Number(raw);
  if (cap !== null && (!Number.isFinite(cap) || cap < 0)) {
    throw new Error("월 토큰 상한은 0 이상의 숫자여야 합니다.");
  }

  await setProviderCap(apiKeyEnv, cap);
  revalidatePath("/admin/ai");
}

/**
 * 키를 **암호화해서 저장**한다(2026-09-05).
 *
 * 전에는 로컬 `.env`에만 쓸 수 있었다(Workers에 파일 시스템이 없어서). 그래서 내 PC 앞에
 * 있어야만 등록이 됐고, 실제로는 **키가 하나도 등록되지 않은 채** 기능이 놀고 있었다.
 *
 * ⚠ 평문으로 저장하지 않는다. 마스터 키가 없으면 **저장 자체를 거부**한다.
 * ⚠ 성공/실패 메시지에 키 값을 넣지 않는다 — 폼 상태는 클라이언트로 내려간다.
 * ⚠ 활동 로그에도 **이름만** 남긴다.
 */
export async function saveAiKeyAction(
  _prev: KeyFormState,
  formData: FormData,
): Promise<KeyFormState> {
  const admin = await requireAdmin("/admin/ai");

  const name = String(formData.get("apiKeyEnv") ?? "");
  const value = String(formData.get("apiKey") ?? "");

  const result = await saveApiKey(name, value, admin.email ?? "관리자");
  if (!result.ok) return { error: result.message };

  await recordAdminLog({ actor: admin.email, action: "ai.key.save", target: name });
  revalidatePath("/admin/ai");
  return { savedName: name };
}

/** 저장된 키를 지운다. env에 같은 이름이 있으면 다시 그쪽을 쓰게 된다. */
export async function deleteAiKeyAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin("/admin/ai");
  const name = assertStoredKeyName(String(formData.get("apiKeyEnv") ?? ""));

  await deleteApiKey(name);
  await recordAdminLog({ actor: admin.email, action: "ai.key.delete", target: name });
  revalidatePath("/admin/ai");
}

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
import { saveAiKeyToEnvFile } from "./env-writer";
import { allApiKeyEnvNames } from "@/lib/ai/catalog";
import { requireAdmin } from "@/lib/session";
import type { KeyFormState } from "./key-form-state";

/** 카탈로그에 있는 env 이름만 허용 — 폼 값으로 임의 컬럼을 건드리지 못하게. */
function assertKnownEnv(name: string): string {
  if (!allApiKeyEnvNames().includes(name)) {
    throw new Error(`알 수 없는 제공자입니다: ${name}`);
  }
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
 * 키를 `.env`에 기록한다. **로컬 개발 서버 전용.**
 *
 * ⚠ 성공/실패 메시지에 키 값을 넣지 않는다. 폼 상태는 클라이언트로 내려간다.
 * ⚠ 저장 후 자동으로 서버에 올리지 않는다 — 배포본 반영은 `npm run ai:sync`가
 *    사람이 의도해서 돌리는 별도 단계다(실수로 운영에 올라가는 걸 막는다).
 */
export async function saveAiKeyAction(
  _prev: KeyFormState,
  formData: FormData,
): Promise<KeyFormState> {
  await requireAdmin("/admin/ai");

  const name = String(formData.get("apiKeyEnv") ?? "");
  const value = String(formData.get("apiKey") ?? "");

  const result = await saveAiKeyToEnvFile(name, value);
  if (!result.ok) return { error: result.message };

  revalidatePath("/admin/ai");
  return { savedName: result.name };
}

"use server";

/**
 * AI 제공자 설정 서버 액션.
 *
 * ⚠ 여기서 API 키를 받지 않는다. 키는 `.env` → `npm run ai:sync` 경로로만 들어간다.
 * 화면에서 키를 받으면 (1) 폼 값이 로그·에러 리포트에 섞이고 (2) DB에 남고
 * (3) 관리자 세션 하나로 전체 키가 털린다. 조작할 수 있는 건 **켜고 끄기와 상한**뿐이다.
 */
import { revalidatePath } from "next/cache";
import { setProviderCap, setProviderEnabled } from "./repository";
import { allApiKeyEnvNames } from "@/lib/ai/catalog";
import { requireAdmin } from "@/lib/session";

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

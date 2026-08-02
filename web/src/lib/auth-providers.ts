/**
 * 소셜 로그인 가용성 판정 — 순수 함수.
 *
 * 키 '값'은 절대 반환하지 않는다. 화면에는 "이 버튼을 보여줄지" 여부만 전달한다.
 * env에 키가 없으면 프로바이더 자체를 등록하지 않으므로, 눌러도 실패하는
 * 버튼이 남지 않는다.
 */
import type { EnvSource } from "./env";

export type SocialProviderId = "google" | "kakao";

type ProviderEnvPair = { id: SocialProviderId; label: string; idEnv: string; secretEnv: string };

export const SOCIAL_PROVIDERS: readonly ProviderEnvPair[] = [
  { id: "google", label: "Google로 계속하기", idEnv: "AUTH_GOOGLE_ID", secretEnv: "AUTH_GOOGLE_SECRET" },
  { id: "kakao", label: "카카오로 계속하기", idEnv: "AUTH_KAKAO_ID", secretEnv: "AUTH_KAKAO_SECRET" },
];

function filled(source: EnvSource, name: string): boolean {
  const v = source[name];
  return typeof v === "string" && v.trim().length > 0;
}

/** ID와 SECRET이 '둘 다' 있을 때만 사용 가능으로 본다. */
export function isSocialProviderConfigured(
  id: SocialProviderId,
  source: EnvSource = process.env,
): boolean {
  const pair = SOCIAL_PROVIDERS.find((p) => p.id === id);
  if (!pair) return false;
  return filled(source, pair.idEnv) && filled(source, pair.secretEnv);
}

/** 로그인 화면에 노출할 버튼 목록 (키 값은 포함하지 않음) */
export function enabledSocialProviders(
  source: EnvSource = process.env,
): { id: SocialProviderId; label: string }[] {
  return SOCIAL_PROVIDERS.filter((p) => isSocialProviderConfigured(p.id, source)).map((p) => ({
    id: p.id,
    label: p.label,
  }));
}

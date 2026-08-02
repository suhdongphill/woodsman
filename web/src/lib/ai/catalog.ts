/**
 * AI 제공자 카탈로그 — 순수 데이터.
 *
 * ## 왜 키를 화면에서 입력받지 않나
 * 이 저장소는 **공개**다. 키가 코드·로그·시드에 섞이면 즉시 노출된다.
 * 관리자 세션 하나가 뚫리면 제공자 전체 키가 털리고, Anthropic·OpenAI 키는
 * 사용량이 곧 청구라 유출 즉시 손해가 난다.
 *
 * 그래서 **키 값은 여기 없다.** 어떤 환경변수 이름에 넣어야 하는지만 안다.
 * 등록은 `.env`(로컬)에 한 번 하고 `npm run ai:sync`로 Cloudflare에 올린다 —
 * 매번 다시 입력할 필요가 없다는 요구는 그걸로 충족된다.
 *
 * ## 토큰 효율의 실제 지렛대
 * 키를 어디 두느냐가 아니라 **무료 제공자를 앞에 세우고, 작업별로 모델을 나누고,
 * 같은 질의를 캐시하는 것**이다. 그 판단은 `routing.ts`에 있다.
 */

export type ProviderId = "nvidia" | "groq" | "gemini" | "openrouter" | "anthropic" | "openai";

/** API 형식 — 호출 코드가 갈리는 지점 */
export type ProviderKind = "ANTHROPIC" | "OPENAI_COMPAT";

export type ModelSpec = {
  /** API에 그대로 보내는 모델 ID */
  id: string;
  label: string;
  /** 100만 토큰당 USD. 무료 티어이거나 공개 요금을 확인하지 못했으면 null. */
  price: { inputPerMTok: number; outputPerMTok: number } | null;
  /** 컨텍스트 창(토큰) */
  context: number;
  /** 이 모델이 잘하는 일 — 라우팅 판단의 근거 */
  strength: "deep" | "balanced" | "cheap";
};

export type Provider = {
  id: ProviderId;
  label: string;
  kind: ProviderKind;
  /** OPENAI_COMPAT 엔드포인트 */
  baseUrl?: string;
  /** 키가 담길 환경변수 이름. ⚠ 키 '값'은 이 파일 어디에도 없다. */
  apiKeyEnv: string;
  /** 무료 티어로 쓸 수 있는가 — 폴백 순서의 1차 기준 */
  free: boolean;
  /** 키 발급 페이지 (관리자 화면에서 안내) */
  consoleUrl: string;
  models: ModelSpec[];
  note?: string;
};

/**
 * 무료 제공자를 앞에, 유료를 뒤에 둔다.
 * Claude 모델 ID와 가격은 Anthropic 공식 값(2026-06 기준).
 * 다른 제공자는 요금이 자주 바뀌고 무료 티어 위주라 가격을 적지 않는다 —
 * **모르는 숫자를 지어내면 예산 판단이 통째로 틀어진다.**
 */
export const AI_PROVIDERS: readonly Provider[] = [
  {
    id: "nvidia",
    label: "NVIDIA NIM",
    kind: "OPENAI_COMPAT",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    apiKeyEnv: "NVIDIA_API_KEY",
    free: true,
    consoleUrl: "https://build.nvidia.com/",
    note: "가입 시 무료 크레딧. 차트 요약·정형 출력에 충분하다.",
    models: [
      {
        id: "meta/llama-3.3-70b-instruct",
        label: "Llama 3.3 70B",
        price: null,
        context: 128_000,
        strength: "balanced",
      },
    ],
  },
  {
    id: "groq",
    label: "Groq",
    kind: "OPENAI_COMPAT",
    baseUrl: "https://api.groq.com/openai/v1",
    apiKeyEnv: "GROQ_API_KEY",
    free: true,
    consoleUrl: "https://console.groq.com/keys",
    note: "속도가 가장 빠르다. 짧은 요약·분류에 1순위.",
    models: [
      {
        id: "llama-3.3-70b-versatile",
        label: "Llama 3.3 70B",
        price: null,
        context: 128_000,
        strength: "cheap",
      },
    ],
  },
  {
    id: "gemini",
    label: "Google Gemini",
    kind: "OPENAI_COMPAT",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    apiKeyEnv: "GEMINI_API_KEY",
    free: true,
    consoleUrl: "https://aistudio.google.com/apikey",
    note: "무료 티어의 일일 한도가 넉넉하다.",
    models: [
      {
        id: "gemini-2.0-flash",
        label: "Gemini 2.0 Flash",
        price: null,
        context: 1_000_000,
        strength: "cheap",
      },
    ],
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    kind: "OPENAI_COMPAT",
    baseUrl: "https://openrouter.ai/api/v1",
    apiKeyEnv: "OPENROUTER_API_KEY",
    free: true,
    consoleUrl: "https://openrouter.ai/keys",
    note: "여러 무료 모델을 한 키로 돌려쓸 수 있다. 다른 무료 제공자가 막혔을 때의 보험.",
    models: [
      {
        id: "meta-llama/llama-3.3-70b-instruct:free",
        label: "Llama 3.3 70B (무료)",
        price: null,
        context: 128_000,
        strength: "cheap",
      },
    ],
  },
  {
    id: "anthropic",
    label: "Anthropic Claude",
    kind: "ANTHROPIC",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    free: false,
    consoleUrl: "https://console.anthropic.com/settings/keys",
    note: "기업분석처럼 긴 글·높은 품질이 필요한 작업 전용. 무료 제공자가 다 실패했을 때만 부른다.",
    models: [
      {
        id: "claude-opus-5",
        label: "Claude Opus 5",
        price: { inputPerMTok: 5, outputPerMTok: 25 },
        context: 1_000_000,
        strength: "deep",
      },
      {
        id: "claude-sonnet-5",
        label: "Claude Sonnet 5",
        price: { inputPerMTok: 3, outputPerMTok: 15 },
        context: 1_000_000,
        strength: "balanced",
      },
      {
        id: "claude-haiku-4-5",
        label: "Claude Haiku 4.5",
        price: { inputPerMTok: 1, outputPerMTok: 5 },
        context: 200_000,
        strength: "cheap",
      },
    ],
  },
  {
    id: "openai",
    label: "OpenAI",
    kind: "OPENAI_COMPAT",
    baseUrl: "https://api.openai.com/v1",
    apiKeyEnv: "OPENAI_API_KEY",
    free: false,
    consoleUrl: "https://platform.openai.com/api-keys",
    note: "요금은 계정 등급에 따라 다르다 — 콘솔에서 확인 후 상한을 정하세요.",
    models: [
      { id: "gpt-4.1-mini", label: "GPT-4.1 mini", price: null, context: 128_000, strength: "cheap" },
      { id: "gpt-4.1", label: "GPT-4.1", price: null, context: 128_000, strength: "balanced" },
    ],
  },
] as const;

export function findProvider(id: string): Provider | null {
  return AI_PROVIDERS.find((p) => p.id === id) ?? null;
}

export function findModel(providerId: string, modelId: string): ModelSpec | null {
  return findProvider(providerId)?.models.find((m) => m.id === modelId) ?? null;
}

/** 모든 제공자의 환경변수 이름 — 동기화 스크립트가 쓴다. */
export function allApiKeyEnvNames(): string[] {
  return AI_PROVIDERS.map((p) => p.apiKeyEnv);
}

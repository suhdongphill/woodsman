/**
 * 작업 → 모델 라우팅과 폴백 — 순수 함수.
 *
 * ## 토큰을 아끼는 실제 방법
 * 키를 어디에 두느냐가 아니라 **무엇을 어디로 보내느냐**가 비용을 결정한다.
 *   - 차트 요약처럼 짧고 정형화된 출력은 무료 모델로 충분하다.
 *   - 기업분석처럼 긴 글과 판단이 필요한 작업만 유료 모델로 보낸다.
 *   - 같은 질의는 캐시로 막는다(AiConfig.cacheTtlHours).
 *
 * ## 폴백 순서 규칙
 * 1. 키가 없는 제공자는 후보에서 빠진다 (눌러도 실패할 경로를 만들지 않는다)
 * 2. 작업이 요구하는 급(deep/balanced/cheap)을 만족하는 모델만 후보
 * 3. 무료 → 유료 순. 같은 등급이면 카탈로그 순서
 * 4. ⚠ 유료 제공자는 **월 토큰 상한을 넘으면 후보에서 빠진다.** 상한이 없으면
 *    실수 한 번이 그대로 청구서가 된다.
 */
import { AI_PROVIDERS, type ModelSpec, type Provider } from "./catalog";
import { PERSONAS, type AiTask } from "./persona";
import type { EnvSource } from "../env";

/** 모델 급의 서열 — 요구 급 이상만 후보가 된다. */
const TIER_RANK: Record<ModelSpec["strength"], number> = { cheap: 0, balanced: 1, deep: 2 };

export type RouteCandidate = {
  providerId: Provider["id"];
  providerLabel: string;
  kind: Provider["kind"];
  baseUrl?: string;
  apiKeyEnv: string;
  model: ModelSpec;
  free: boolean;
  /**
   * 이 후보 한 번 호출의 제한 시간(ms).
   * ⚠ 넘으면 끊고 **다음 후보로 넘어간다.** 느린 제공자 하나가 화면을 붙잡고 있으면
   *    사용자는 고장으로 받아들인다 — 기다리는 것보다 다음 것을 부르는 편이 낫다.
   */
  timeoutMs: number;
};

/** 제공자별 사용량 — DB(AiProvider)에서 온다. */
export type ProviderUsage = {
  providerId: string;
  enabled: boolean;
  tokensUsedThisMonth: number;
  monthlyTokenCap: number | null;
};

export type RoutingInput = {
  task: AiTask;
  /** 키 보유 여부 판정에 쓸 환경 (값은 읽지 않고 존재만 본다) */
  env?: EnvSource;
  /** DB의 제공자 상태. 없으면 전부 활성·사용량 0으로 본다. */
  usage?: ProviderUsage[];
};

function hasKey(env: EnvSource, name: string): boolean {
  const v = env[name];
  return typeof v === "string" && v.trim().length > 0;
}

/** 월 상한을 이미 넘었는가. 상한이 없으면 넘지 않은 것으로 본다(무료 제공자용). */
export function isOverCap(u: ProviderUsage | undefined): boolean {
  if (!u || u.monthlyTokenCap == null) return false;
  return u.tokensUsedThisMonth >= u.monthlyTokenCap;
}

/**
 * 이 작업을 처리할 수 있는 후보를 **시도 순서대로** 돌려준다.
 * 비어 있으면 "지금 이 작업을 돌릴 수 있는 제공자가 없다"는 뜻이다.
 */
export function routeCandidates({
  task,
  env = process.env,
  usage = [],
}: RoutingInput): RouteCandidate[] {
  const required = TIER_RANK[PERSONAS[task].requires];
  const usageById = new Map(usage.map((u) => [u.providerId, u]));

  const candidates: RouteCandidate[] = [];

  for (const provider of AI_PROVIDERS) {
    if (!hasKey(env, provider.apiKeyEnv)) continue;

    const u = usageById.get(provider.id);
    if (u && !u.enabled) continue;
    if (isOverCap(u)) continue;

    // 요구 급 이상 중 가장 저렴한(=급이 낮은) 모델을 고른다.
    // 필요 이상으로 비싼 모델을 부르지 않기 위해서다.
    const model = provider.models
      .filter((m) => TIER_RANK[m.strength] >= required)
      .sort((a, b) => TIER_RANK[a.strength] - TIER_RANK[b.strength])[0];
    if (!model) continue;

    candidates.push({
      providerId: provider.id,
      providerLabel: provider.label,
      kind: provider.kind,
      baseUrl: provider.baseUrl,
      apiKeyEnv: provider.apiKeyEnv,
      model,
      free: provider.free,
      timeoutMs: resolveTimeoutMs(provider, model),
    });
  }

  // 무료 먼저. 그 안에서는 카탈로그 순서(=선호 순서)를 유지한다.
  return candidates.sort((a, b) => Number(b.free) - Number(a.free));
}

/**
 * 이 호출을 얼마나 기다릴 것인가.
 * 모델에 지정된 값이 있으면 그게 이긴다(추론 모델은 첫 토큰이 늦다).
 */
export function resolveTimeoutMs(provider: Provider, model: ModelSpec): number {
  return model.timeoutMs ?? provider.timeoutMs;
}

/** 후보 전체를 한 번씩 시도할 때의 최악 대기 시간. 화면이 "얼마나 걸릴 수 있는지" 알린다. */
export function worstCaseWaitMs(candidates: RouteCandidate[]): number {
  return candidates.reduce((sum, c) => sum + c.timeoutMs, 0);
}

/** 1순위 후보. 없으면 null. */
export function primaryRoute(input: RoutingInput): RouteCandidate | null {
  return routeCandidates(input)[0] ?? null;
}

/**
 * 호출 비용 추정(USD). 가격이 공개되지 않은 제공자는 null.
 * ⚠ 모르는 요금을 0으로 치면 "무료인 줄 알았는데 청구됨"이 된다. null로 남긴다.
 */
export function estimateCostUsd(
  model: ModelSpec,
  inputTokens: number,
  outputTokens: number,
): number | null {
  if (!model.price) return null;
  return (
    (inputTokens / 1_000_000) * model.price.inputPerMTok +
    (outputTokens / 1_000_000) * model.price.outputPerMTok
  );
}

/** 관리자 화면용 요약 — 작업마다 지금 어디로 가는지 */
export function routingSummary(env: EnvSource = process.env, usage: ProviderUsage[] = []) {
  return (Object.keys(PERSONAS) as AiTask[]).map((task) => ({
    task,
    persona: PERSONAS[task],
    candidates: routeCandidates({ task, env, usage }),
  }));
}

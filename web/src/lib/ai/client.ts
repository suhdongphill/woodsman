/**
 * 모델을 실제로 부르는 자리 — 라우팅이 정한 순서대로 한 번씩 시도한다.
 *
 * ## 왜 SDK를 쓰지 않나
 * 제공자가 일곱인데 형식은 둘(`ANTHROPIC` · `OPENAI_COMPAT`)뿐이다. 제공자마다 SDK를 넣으면
 * 배포 번들만 커지고 실제로 갈리는 코드는 몇 줄이다. 게다가 배포 대상이 **Cloudflare
 * Workers**라 Node 전용 의존성을 늘리지 않는 편이 안전하다. 그래서 `fetch` 한 겹으로 짠다.
 *
 * ## 규칙
 * - ⚠ **키를 로그·에러 메시지에 싣지 않는다.** 실패 사유는 상태 코드와 제공자 이름까지다.
 * - ⚠ **조용히 폴백하지 않는다.** 어떤 후보가 왜 실패했는지 전부 돌려주고, 호출부가 화면과
 *   로그에 남긴다(CLAUDE.md 3장). "AI가 답을 안 준다"와 "키가 없다"가 같아 보이면 안 된다.
 * - ⚠ **후보가 없으면 그렇게 말한다.** 빈 문자열을 돌려주면 화면이 "모델이 아무 말도 안 했다"로
 *   읽는다. 그건 사실이 아니라 **부를 곳이 없었다**는 뜻이다.
 * - ⚠ 요청마다 **제한 시간**을 건다. 느린 제공자 하나가 화면을 붙잡으면 사용자는 고장으로 본다.
 */
import { buildSystemPrompt, type AiTask } from "./persona";
import {
  diagnoseRouting,
  type GlobalUsage,
  type ProviderUsage,
  type RouteCandidate,
  type RoutingMode,
} from "./routing";
import type { EnvSource } from "../env";

/** Anthropic Messages API 버전 헤더. ⚠ 날짜 문자열이며 임의로 올리지 않는다. */
const ANTHROPIC_VERSION = "2023-06-01";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

/** 기본 출력 상한. 정형 JSON 출력에 넉넉하면서, 사고로 길게 뽑아도 감당되는 크기다. */
export const DEFAULT_MAX_TOKENS = 4_000;

/**
 * Anthropic 전용 하한. ⚠ **생각과 답이 같은 상한을 나눠 쓴다.**
 * 4,000으로는 생각에 다 쓰고 본문이 한 글자도 안 나오는 일이 실제로 있었다(2026-09-07).
 */
export const ANTHROPIC_MIN_MAX_TOKENS = 12_000;

/** 사고 깊이. `low`~`max`. ⚠ 생략하면 `high`이고, 정리 작업에는 그게 과하다. */
export const ANTHROPIC_EFFORT = "medium";

export type AiCall = {
  system: string;
  user: string;
  maxTokens?: number;
};

export type AiUsage = { inputTokens: number; outputTokens: number };

export type AiSuccess = {
  text: string;
  usage: AiUsage;
  providerId: string;
  providerLabel: string;
  apiKeyEnv: string;
  modelId: string;
};

/** 후보 하나의 시도 결과 — 성공이든 실패든 남는다. */
export type AiAttempt = { providerLabel: string; modelId: string; ok: boolean; error?: string };

export type AiRunResult =
  | { ok: true; result: AiSuccess; attempts: AiAttempt[] }
  | { ok: false; reason: string; attempts: AiAttempt[] };

type PreparedRequest = { url: string; init: RequestInit };

/**
 * 제공자별 요청 조립 — **순수 함수**다(테스트가 여기를 본다).
 * ⚠ 키는 헤더에만 넣는다. 본문·URL에 싣지 않는다 — 로그와 리퍼러로 새는 자리다.
 */
export function buildProviderRequest(
  candidate: RouteCandidate,
  apiKey: string,
  call: AiCall,
): PreparedRequest {
  const maxTokens = call.maxTokens ?? DEFAULT_MAX_TOKENS;

  if (candidate.kind === "ANTHROPIC") {
    return {
      url: ANTHROPIC_URL,
      init: {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model: candidate.model.id,
          /**
           * ⚠ **사고가 켜진 모델은 이 상한을 생각과 답이 나눠 쓴다.**
           * 2026-09-07에 일정 초안이 「응답에 텍스트 블록이 없습니다」로 죽었다.
           * 모델이 침묵한 게 아니라 4,000토큰을 생각에 다 쓰고 상한에 걸린 것이었다.
           */
          max_tokens: Math.max(maxTokens, ANTHROPIC_MIN_MAX_TOKENS),
          /**
           * 사고 깊이. ⚠ 이 사이트가 시키는 일은 창작이 아니라 **정리**다 —
           * 아래 `temperature: 0.2`와 같은 판단이다. 품질을 사는 자리는
           * **모드가 고르는 모델**이지 생각의 길이가 아니다.
           */
          output_config: { effort: ANTHROPIC_EFFORT },
          system: call.system,
          messages: [{ role: "user", content: call.user }],
        }),
      },
    };
  }

  const base = (candidate.baseUrl ?? "").replace(/\/+$/, "");
  return {
    url: `${base}/chat/completions`,
    init: {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: candidate.model.id,
        max_tokens: maxTokens,
        // ⚠ 낮게 고정한다. 이 사이트가 모델에게 시키는 일은 창작이 아니라 **정리**다.
        temperature: 0.2,
        messages: [
          { role: "system", content: call.system },
          { role: "user", content: call.user },
        ],
      }),
    },
  };
}

/** 응답에서 본문 텍스트를 꺼낸다. 형식이 다르면 빈 문자열이 아니라 예외다. */
export function readResponseText(kind: RouteCandidate["kind"], json: unknown): string {
  const root = (json ?? {}) as Record<string, unknown>;

  if (kind === "ANTHROPIC") {
    const blocks = Array.isArray(root.content) ? root.content : [];
    const typed = blocks.map((b) => b as { type?: string; text?: string });
    const text = typed
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text as string)
      .join("\n")
      .trim();
    if (text) return text;

    /**
     * ⚠ **왜 본문이 없는지를 말한다.** 「텍스트 블록이 없습니다」는 모델이 침묵한 것처럼
     * 들리지만 실제 원인은 대개 **상한**이거나 **거절**이다. 사람을 엉뚱한 곳으로 보내는
     * 실패가 조용한 실패보다 나쁘다(2026-09-05 「키를 아홉 개 등록했는데」와 같은 종류다).
     */
    const stopReason = typeof root.stop_reason === "string" ? root.stop_reason : "";
    if (stopReason === "max_tokens") {
      throw new Error(
        "출력 상한에 걸려 본문이 나오지 않았습니다 — 모델이 생각에 상한을 다 썼습니다",
      );
    }
    if (stopReason === "refusal") {
      const details = (root.stop_details ?? {}) as { category?: string };
      throw new Error(
        `모델이 요청을 거절했습니다${details.category ? ` (${details.category})` : ""}`,
      );
    }
    if (typed.length > 0 && typed.every((b) => b.type === "thinking")) {
      throw new Error("사고 블록만 왔고 본문이 없습니다 — 출력 상한을 올려 보세요");
    }
    throw new Error(
      stopReason
        ? `응답에 텍스트 블록이 없습니다 (stop_reason: ${stopReason})`
        : "응답에 텍스트 블록이 없습니다",
    );
  }

  const choices = Array.isArray(root.choices) ? root.choices : [];
  const content = (choices[0] as { message?: { content?: unknown } } | undefined)?.message?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("응답에 메시지 본문이 없습니다");
  }
  return content.trim();
}

/**
 * 토큰 사용량.
 * ⚠ 제공자가 사용량을 안 주면 **글자 수로 어림해서라도 센다.** 0으로 두면 월 상한이 영원히
 *   안 걸리고, 상한은 청구서를 막는 장치다. 어림은 부정확하지만 없는 것보다 낫다.
 */
export function readResponseUsage(
  kind: RouteCandidate["kind"],
  json: unknown,
  fallback: { promptChars: number; completionChars: number },
): AiUsage {
  const root = (json ?? {}) as Record<string, unknown>;
  const usage = (root.usage ?? {}) as Record<string, unknown>;

  const pick = (...names: string[]): number => {
    for (const n of names) {
      const v = usage[n];
      if (typeof v === "number" && Number.isFinite(v) && v >= 0) return v;
    }
    return 0;
  };

  const input = kind === "ANTHROPIC" ? pick("input_tokens") : pick("prompt_tokens");
  const output = kind === "ANTHROPIC" ? pick("output_tokens") : pick("completion_tokens");

  return {
    inputTokens: input || estimateTokens(fallback.promptChars),
    outputTokens: output || estimateTokens(fallback.completionChars),
  };
}

/** 글자 수로 토큰을 어림한다(한국어 섞인 글이 대략 3자 ≈ 1토큰). ⚠ 정확한 값이 아니다. */
export function estimateTokens(chars: number): number {
  return Math.max(1, Math.ceil(chars / 3));
}

/** 후보 하나를 부른다. 실패하면 던진다 — 호출부가 다음 후보로 넘어간다. */
export async function callCandidate(
  candidate: RouteCandidate,
  apiKey: string,
  call: AiCall,
): Promise<AiSuccess> {
  const { url, init } = buildProviderRequest(candidate, apiKey, call);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), candidate.timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      /abort/i.test(message) ? "제한 시간을 넘겼습니다" : message.slice(0, 120),
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    // ⚠ 응답 본문을 그대로 싣지 않는다. 제공자가 요청 본문을 되비추는 경우가 있다.
    throw new Error(`응답 ${response.status}`);
  }

  const json = await response.json();
  const text = readResponseText(candidate.kind, json);
  const usage = readResponseUsage(candidate.kind, json, {
    promptChars: call.system.length + call.user.length,
    completionChars: text.length,
  });

  return {
    text,
    usage,
    providerId: candidate.providerId,
    providerLabel: candidate.providerLabel,
    apiKeyEnv: candidate.apiKeyEnv,
    modelId: candidate.model.id,
  };
}

/**
 * 작업 하나를 돌린다 — 후보를 순서대로 시도하고, 처음 성공한 것을 쓴다.
 *
 * ⚠ 페르소나(공통 규범 포함)는 **여기서만** 붙인다. 호출부가 system을 직접 만들면
 *   `WOODSMAN_DOCTRINE`을 빼먹을 수 있고, 그러면 사이트의 고지와 어긋난 출력이 나온다
 *   (CLAUDE.md 6장).
 */
export async function runAiTask(input: {
  task: AiTask;
  user: string;
  env?: EnvSource;
  usage?: ProviderUsage[];
  global?: GlobalUsage;
  maxTokens?: number;
  /** 품질 우선으로 고를 것인가. 기본값은 지금까지와 같은 `cheapest`. */
  mode?: RoutingMode;
}): Promise<AiRunResult> {
  const env = input.env ?? process.env;
  const { candidates, blocked } = diagnoseRouting({
    task: input.task,
    mode: input.mode,
    env,
    usage: input.usage ?? [],
    global: input.global,
  });

  if (candidates.length === 0) {
    // ⚠ 뭉뚱그리지 않는다. 제공자마다 왜 빠졌는지 그대로 말한다 —
    //    "키를 등록했는지 보세요"가 정답이 아닌 경우가 실제로 있었다(2026-09-05).
    const why = blocked.map((b) => `${b.providerLabel}: ${b.reason}`).join(" · ");
    return {
      ok: false,
      reason: why
        ? `지금 이 작업을 돌릴 수 있는 제공자가 없습니다 — ${why}`
        : "지금 이 작업을 돌릴 수 있는 제공자가 없습니다.",
      attempts: [],
    };
  }

  const call: AiCall = {
    system: buildSystemPrompt(input.task),
    user: input.user,
    maxTokens: input.maxTokens,
  };

  const attempts: AiAttempt[] = [];

  for (const candidate of candidates) {
    const apiKey = (env[candidate.apiKeyEnv] ?? "").trim();
    if (!apiKey) continue;

    try {
      const result = await callCandidate(candidate, apiKey, call);
      attempts.push({
        providerLabel: candidate.providerLabel,
        modelId: candidate.model.id,
        ok: true,
      });
      return { ok: true, result, attempts };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // ⚠ 실패를 삼키지 않는다. 다음 후보로 넘어가더라도 기록은 남긴다.
      console.error(`[ai] ${candidate.providerLabel}(${candidate.model.id}) 실패 — ${message}`);
      attempts.push({
        providerLabel: candidate.providerLabel,
        modelId: candidate.model.id,
        ok: false,
        error: message,
      });
    }
  }

  return { ok: false, reason: "모든 제공자가 실패했습니다.", attempts };
}

import { describe, expect, it } from "vitest";
import {
  DEFAULT_MAX_TOKENS,
  buildProviderRequest,
  estimateTokens,
  readResponseText,
  readResponseUsage,
} from "./client";
import { routeCandidates } from "./routing";
import type { RouteCandidate } from "./routing";

function candidate(kind: "ANTHROPIC" | "OPENAI_COMPAT"): RouteCandidate {
  return {
    providerId: kind === "ANTHROPIC" ? "anthropic" : "groq",
    providerLabel: kind === "ANTHROPIC" ? "Anthropic Claude" : "Groq",
    kind,
    baseUrl: kind === "ANTHROPIC" ? undefined : "https://api.groq.com/openai/v1/",
    apiKeyEnv: kind === "ANTHROPIC" ? "ANTHROPIC_API_KEY" : "GROQ_API_KEY",
    model: { id: "test-model", label: "테스트", price: null, context: 1000, strength: "balanced" },
    free: kind !== "ANTHROPIC",
    timeoutMs: 1000,
  };
}

const call = { system: "규범", user: "질문" };
const KEY = "sk-비밀-키-값";

describe("제공자별 요청 조립", () => {
  it("Anthropic은 x-api-key와 버전 헤더로 부른다", () => {
    const { url, init } = buildProviderRequest(candidate("ANTHROPIC"), KEY, call);
    const headers = init.headers as Record<string, string>;

    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(headers["x-api-key"]).toBe(KEY);
    expect(headers["anthropic-version"]).toBe("2023-06-01");

    const body = JSON.parse(String(init.body));
    expect(body.system).toBe("규범");
    expect(body.messages).toEqual([{ role: "user", content: "질문" }]);
    expect(body.max_tokens).toBe(DEFAULT_MAX_TOKENS);
  });

  it("OpenAI 호환은 Bearer 토큰과 /chat/completions로 부른다", () => {
    const { url, init } = buildProviderRequest(candidate("OPENAI_COMPAT"), KEY, call);
    const headers = init.headers as Record<string, string>;

    // ⚠ baseUrl 끝의 슬래시가 겹치면 404가 난다 — 조용히 "모델이 답을 안 준다"로 보인다.
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(headers.authorization).toBe(`Bearer ${KEY}`);

    const body = JSON.parse(String(init.body));
    expect(body.messages[0]).toEqual({ role: "system", content: "규범" });
    expect(body.messages[1]).toEqual({ role: "user", content: "질문" });
  });

  /**
   * ⚠ 키는 헤더에만 있어야 한다. 본문이나 URL에 섞이면 로그·리퍼러·에러 보고로 새고,
   *    이 저장소는 공개다(CLAUDE.md 6장).
   */
  it("⚠ 키가 본문이나 URL에 실리지 않는다", () => {
    for (const kind of ["ANTHROPIC", "OPENAI_COMPAT"] as const) {
      const { url, init } = buildProviderRequest(candidate(kind), KEY, call);
      expect(url).not.toContain(KEY);
      expect(String(init.body)).not.toContain(KEY);
    }
  });
});

describe("응답 읽기", () => {
  it("Anthropic의 텍스트 블록을 잇는다", () => {
    const json = { content: [{ type: "text", text: "답" }, { type: "thinking" }] };
    expect(readResponseText("ANTHROPIC", json)).toBe("답");
  });

  it("OpenAI 호환의 첫 선택지를 읽는다", () => {
    expect(readResponseText("OPENAI_COMPAT", { choices: [{ message: { content: " 답 " } }] })).toBe(
      "답",
    );
  });

  /** ⚠ 빈 문자열을 돌려주면 "모델이 아무 말도 안 했다"가 되고, 진짜 원인이 사라진다. */
  it("⚠ 형식이 다르면 빈 문자열이 아니라 예외다", () => {
    expect(() => readResponseText("ANTHROPIC", { content: [] })).toThrow();
    expect(() => readResponseText("OPENAI_COMPAT", {})).toThrow();
  });

  it("사용량이 오면 그대로 센다", () => {
    const a = readResponseUsage(
      "ANTHROPIC",
      { usage: { input_tokens: 120, output_tokens: 30 } },
      { promptChars: 9, completionChars: 9 },
    );
    expect(a).toEqual({ inputTokens: 120, outputTokens: 30 });

    const o = readResponseUsage(
      "OPENAI_COMPAT",
      { usage: { prompt_tokens: 10, completion_tokens: 5 } },
      { promptChars: 9, completionChars: 9 },
    );
    expect(o).toEqual({ inputTokens: 10, outputTokens: 5 });
  });

  /** ⚠ 0으로 두면 월 상한이 영원히 안 걸린다. 어림이라도 센다. */
  it("⚠ 사용량을 안 주는 제공자는 글자 수로 어림해서라도 센다", () => {
    const u = readResponseUsage("OPENAI_COMPAT", {}, { promptChars: 300, completionChars: 60 });
    expect(u.inputTokens).toBe(100);
    expect(u.outputTokens).toBe(20);
    expect(estimateTokens(0)).toBe(1);
  });
});

describe("부를 곳이 없을 때", () => {
  /**
   * ⚠ 키가 하나도 없으면 후보가 0이다. 이 상태에서 빈 답을 돌려주면 화면이
   *    "AI가 못 찾았다"고 말하게 된다 — 사실은 **부를 곳이 없었다**.
   */
  it("키가 없으면 후보가 비어 있다", () => {
    expect(routeCandidates({ task: "calendar-draft", env: {} })).toEqual([]);
  });

  it("키가 있으면 무료 제공자가 먼저 온다", () => {
    const list = routeCandidates({
      task: "calendar-draft",
      env: { NVIDIA_API_KEY: "x", ANTHROPIC_API_KEY: "y" },
    });
    expect(list.length).toBeGreaterThan(0);
    expect(list[0].free).toBe(true);
  });

  /**
   * ⚠ 일정 초안은 `balanced` 이상을 요구한다(`persona.ts`). 그래서 **가장 싼 무료 모델만
   *    등록해 두면 이 기능은 돌지 않는다** — 화면이 "제공자가 없습니다"라고 말한다.
   *    싼 모델로 날짜를 받는 것보다 안 받는 편이 낫다는 판단이고, 이 테스트가 그 판단을 붙든다.
   */
  it("⚠ cheap 등급만 있는 제공자는 이 작업의 후보가 되지 않는다", () => {
    expect(routeCandidates({ task: "calendar-draft", env: { GROQ_API_KEY: "x" } })).toEqual([]);
    // 같은 키로도 cheap 작업(차트 요약)은 돌아간다 — 급을 나눈 이유다.
    expect(routeCandidates({ task: "chart-read", env: { GROQ_API_KEY: "x" } })).toHaveLength(1);
  });
});

/**
 * AI 모듈 회귀 테스트.
 *
 * 가장 중요한 검사는 두 가지다.
 *  1) **Woodsman 규범이 모든 프롬프트에 살아 있는가** — 매수 권유형 출력이 나오면
 *     /disclaimer에 적은 "투자 권유가 아니다"가 거짓이 된다.
 *  2) **키 없는 제공자로 라우팅되지 않는가** — 눌러도 실패하는 경로를 만들지 않는다.
 */
import { describe, expect, it } from "vitest";
import { AI_PROVIDERS, allApiKeyEnvNames, findModel, findProvider } from "./catalog";
import { renderCompanyAnalysisInput, renderPortfolioContext, type PortfolioContext } from "./context";
import { PERSONAS, WOODSMAN_DOCTRINE, buildSystemPrompt, listPersonas } from "./persona";
import { estimateCostUsd, isOverCap, primaryRoute, routeCandidates } from "./routing";
import { isPlausibleKey, maskKey, quoteEnvValue, upsertEnvLine } from "../env-file";
import { serverEnvSchema } from "../env";
import type { StockSummary } from "../types";

const KEYS = {
  GROQ_API_KEY: "g",
  ANTHROPIC_API_KEY: "a",
};

describe("카탈로그", () => {
  it("키 '값'을 담지 않는다 — 변수명만", () => {
    const json = JSON.stringify(AI_PROVIDERS);
    for (const name of allApiKeyEnvNames()) {
      expect(json).toContain(name);
    }
    // 실제 키 형태가 섞여 들어가지 않았는지
    expect(json).not.toMatch(/sk-ant-api\d/);
    expect(json).not.toMatch(/gsk_[A-Za-z0-9]{10,}/);
    expect(json).not.toMatch(/AIza[0-9A-Za-z_-]{20,}/);
  });

  it("제공자 id와 환경변수명이 겹치지 않는다", () => {
    expect(new Set(AI_PROVIDERS.map((p) => p.id)).size).toBe(AI_PROVIDERS.length);
    expect(new Set(allApiKeyEnvNames()).size).toBe(AI_PROVIDERS.length);
  });

  it("Claude 모델 ID와 가격이 공식 값이다", () => {
    const opus = findModel("anthropic", "claude-opus-5")!;
    expect(opus.price).toEqual({ inputPerMTok: 5, outputPerMTok: 25 });
    const sonnet = findModel("anthropic", "claude-sonnet-5")!;
    expect(sonnet.price).toEqual({ inputPerMTok: 3, outputPerMTok: 15 });
    const haiku = findModel("anthropic", "claude-haiku-4-5")!;
    expect(haiku.price).toEqual({ inputPerMTok: 1, outputPerMTok: 5 });
  });

  it("가격을 모르는 제공자는 null로 둔다(0으로 치지 않는다)", () => {
    // 0으로 두면 '무료인 줄 알았는데 청구'가 된다.
    for (const p of AI_PROVIDERS) {
      for (const m of p.models) {
        expect(m.price === null || m.price.inputPerMTok > 0, `${p.id}/${m.id}`).toBe(true);
      }
    }
  });

  it("없는 제공자·모델은 null", () => {
    expect(findProvider("nope")).toBeNull();
    expect(findModel("anthropic", "nope")).toBeNull();
  });

  it("모든 apiKeyEnv가 env 스키마에 선언돼 있다", () => {
    // 여기 빠지면 .env에 키를 넣어도 ai:sync가 올리지 못하고, 화면은 계속 "미설정"이다.
    const declared = Object.keys(serverEnvSchema.shape);
    for (const name of allApiKeyEnvNames()) {
      expect(declared, name).toContain(name);
    }
  });
});

describe("페르소나", () => {
  it("모든 작업의 시스템 프롬프트에 Woodsman 규범이 들어간다", () => {
    for (const p of listPersonas()) {
      const prompt = buildSystemPrompt(p.task);
      expect(prompt.startsWith(WOODSMAN_DOCTRINE), p.task).toBe(true);
    }
  });

  it("규범이 매수 권유와 목표주가를 금지한다", () => {
    expect(WOODSMAN_DOCTRINE).toContain("권유하지 않는다");
    expect(WOODSMAN_DOCTRINE).toContain("목표주가를 제시하지 않는다");
    expect(WOODSMAN_DOCTRINE).toContain("지어내지 않는다");
  });

  it("규범이 기능별 분류(성장·인컴·방어)를 담는다", () => {
    for (const word of ["성장", "인컴", "방어"]) {
      expect(WOODSMAN_DOCTRINE).toContain(word);
    }
  });

  it("작업마다 역할과 출력 형식이 서로 다르다", () => {
    const roles = listPersonas().map((p) => p.role);
    expect(new Set(roles).size).toBe(roles.length);
    const specs = listPersonas().map((p) => p.outputSpec);
    expect(new Set(specs).size).toBe(specs.length);
  });

  it("차트 분석은 예측을 금지한다", () => {
    const prompt = buildSystemPrompt("chart-read");
    expect(prompt).toContain("예측");
    expect(PERSONAS["chart-read"].requires).toBe("cheap");
  });

  it("기업분석은 가장 좋은 모델을 요구한다", () => {
    expect(PERSONAS["company-analysis"].requires).toBe("deep");
  });
});

describe("라우팅", () => {
  it("키가 없는 제공자로는 절대 라우팅하지 않는다", () => {
    const candidates = routeCandidates({ task: "chart-read", env: KEYS });
    expect(candidates.length).toBeGreaterThan(0);
    for (const c of candidates) {
      expect(Object.keys(KEYS)).toContain(c.apiKeyEnv);
    }
  });

  it("키가 하나도 없으면 후보가 비어 있다", () => {
    expect(routeCandidates({ task: "chart-read", env: {} })).toEqual([]);
    expect(primaryRoute({ task: "company-analysis", env: {} })).toBeNull();
  });

  it("무료 제공자를 먼저 시도한다", () => {
    const candidates = routeCandidates({ task: "chart-read", env: KEYS });
    expect(candidates[0].free).toBe(true);
    expect(candidates.at(-1)!.free).toBe(false);
  });

  it("깊은 작업은 무료 저가 모델로 내려가지 않는다", () => {
    // Groq의 모델은 cheap 급이라 company-analysis(deep) 후보가 될 수 없다.
    const candidates = routeCandidates({ task: "company-analysis", env: KEYS });
    expect(candidates.map((c) => c.providerId)).not.toContain("groq");
    expect(candidates[0].model.strength).toBe("deep");
  });

  it("요구 급을 넘는 비싼 모델을 굳이 고르지 않는다", () => {
    // canslim-score는 balanced면 충분 → Claude에서 Opus가 아니라 Sonnet이 선택돼야 한다.
    const c = routeCandidates({ task: "canslim-score", env: { ANTHROPIC_API_KEY: "a" } })[0];
    expect(c.model.id).toBe("claude-sonnet-5");
  });

  it("비활성 제공자는 후보에서 빠진다", () => {
    const candidates = routeCandidates({
      task: "chart-read",
      env: KEYS,
      usage: [{ providerId: "groq", enabled: false, tokensUsedThisMonth: 0, monthlyTokenCap: null }],
    });
    expect(candidates.map((c) => c.providerId)).not.toContain("groq");
  });

  it("월 상한을 넘긴 제공자는 후보에서 빠진다", () => {
    const usage = [
      { providerId: "anthropic", enabled: true, tokensUsedThisMonth: 200_000, monthlyTokenCap: 200_000 },
    ];
    expect(isOverCap(usage[0])).toBe(true);
    const candidates = routeCandidates({ task: "company-analysis", env: KEYS, usage });
    expect(candidates.map((c) => c.providerId)).not.toContain("anthropic");
  });

  it("상한이 없으면 넘긴 것으로 보지 않는다", () => {
    expect(isOverCap(undefined)).toBe(false);
    expect(
      isOverCap({ providerId: "groq", enabled: true, tokensUsedThisMonth: 9e9, monthlyTokenCap: null }),
    ).toBe(false);
  });
});

describe("비용 추정", () => {
  it("공개 가격이 있으면 계산한다", () => {
    const opus = findModel("anthropic", "claude-opus-5")!;
    // 100만 입력 + 100만 출력 = 5 + 25
    expect(estimateCostUsd(opus, 1_000_000, 1_000_000)).toBeCloseTo(30);
  });

  it("가격을 모르면 null — 0으로 속이지 않는다", () => {
    const groq = findModel("groq", "llama-3.3-70b-versatile")!;
    expect(estimateCostUsd(groq, 1_000_000, 1_000_000)).toBeNull();
  });
});

describe(".env 기록", () => {
  it("없던 키를 끝에 붙인다", () => {
    const out = upsertEnvLine('AUTH_SECRET="x"\n', "GROQ_API_KEY", "dummy-key-abc123");
    expect(out).toBe('AUTH_SECRET="x"\nGROQ_API_KEY="dummy-key-abc123"\n');
  });

  it("이미 있는 키는 그 줄만 바꾼다(주변 주석·순서 보존)", () => {
    const before = ['# AI 키', 'GROQ_API_KEY="old"', '# 아래는 인증', 'AUTH_SECRET="x"'].join("\n");
    const out = upsertEnvLine(before, "GROQ_API_KEY", "new_value_1234567");

    expect(out).toContain("# AI 키");
    expect(out).toContain("# 아래는 인증");
    expect(out).not.toContain("old");
    expect(out.split("\n")[1]).toBe('GROQ_API_KEY="new_value_1234567"');
    expect(out.match(/GROQ_API_KEY/g)).toHaveLength(1);
  });

  it("이름이 접두사로 겹쳐도 다른 키를 건드리지 않는다", () => {
    // OPENAI_API_KEY 와 OPENROUTER_API_KEY 처럼 헷갈리는 조합
    const before = 'OPENAI_API_KEY="a"\nOPENROUTER_API_KEY="b"\n';
    const out = upsertEnvLine(before, "OPENAI_API_KEY", "changed_value_123");
    expect(out).toContain('OPENROUTER_API_KEY="b"');
    expect(out).toContain('OPENAI_API_KEY="changed_value_123"');
  });

  it("줄바꿈이 없는 파일 끝에도 안전하게 붙인다", () => {
    expect(upsertEnvLine('AUTH_SECRET="x"', "GROQ_API_KEY", "dummy-key-abcdefghij")).toBe(
      'AUTH_SECRET="x"\nGROQ_API_KEY="dummy-key-abcdefghij"\n',
    );
    expect(upsertEnvLine("", "GROQ_API_KEY", "dummy-key-abcdefghij")).toBe(
      'GROQ_API_KEY="dummy-key-abcdefghij"\n',
    );
  });

  it("따옴표·역슬래시가 든 값을 깨뜨리지 않는다", () => {
    expect(quoteEnvValue('a"b\\c')).toBe('"a\\"b\\\\c"');
  });

  it("앞뒤 공백은 떼고 저장한다(붙여넣기 사고의 대부분)", () => {
    expect(upsertEnvLine("", "GROQ_API_KEY", "  dummy-key-abcdefghij  \n")).toBe(
      'GROQ_API_KEY="dummy-key-abcdefghij"\n',
    );
  });

  it("공백이 섞였거나 너무 짧은 값은 거른다", () => {
    expect(isPlausibleKey("dummy-key-1234567890")).toBe(true);
    expect(isPlausibleKey("short")).toBe(false);
    expect(isPlausibleKey("dummy key 1234567890")).toBe(false);
    expect(isPlausibleKey("")).toBe(false);
  });

  it("마스킹이 키 전체를 드러내지 않는다", () => {
    const key = "dummy-key-abcdefghijklmnop";
    const masked = maskKey(key);
    expect(masked).not.toContain("efghijklmn");
    // 어느 계정 키인지 알아볼 만큼만 남긴다 — 앞 4자.
    expect(masked.startsWith(key.slice(0, 4))).toBe(true);
    expect(maskKey("short")).toBe("••••••••");
  });
});

describe("컨텍스트 주입", () => {
  const portfolio: PortfolioContext = {
    allocation: { GROWTH: 32, INCOME: 38, DEFENSE: 30 } as const,
    holdings: [
      {
        name: "TSMC",
        ticker: "TSM",
        functionType: "GROWTH" as const,
        targetWeight: 18,
        thesis: "선단 공정 독점",
      },
    ],
    recentJournal: [
      { date: "2026-07-28", action: "REBALANCE", title: "비중 축소", body: "규칙대로 되돌린다." },
    ],
  };

  const stock: StockSummary = {
    ticker: "TSM",
    name: "TSMC",
    market: "NYSE",
    industry: "반도체",
    price: 191.2,
    changePct: 1.24,
    currency: "USD",
    canslim: 8.4,
    spark: [168, 175, 182, 191.2],
  };

  it("계좌 맥락에 배분·논리·최근 판단이 모두 들어간다", () => {
    const text = renderPortfolioContext(portfolio);
    expect(text).toContain("성장 32%");
    expect(text).toContain("선단 공정 독점");
    expect(text).toContain("2026-07-28");
  });

  it("이미 편입된 종목은 기존 논리를 반복하지 말라고 지시한다", () => {
    const text = renderCompanyAnalysisInput({
      stock,
      holding: portfolio.holdings[0],
      portfolio,
    });
    expect(text).toContain("여전히 유효한지");
    expect(text).toContain("선단 공정 독점");
  });

  it("미편입 종목은 어느 기능을 맡을지부터 묻는다", () => {
    const text = renderCompanyAnalysisInput({ stock, portfolio });
    expect(text).toContain("아직 편입돼 있지 않습니다");
  });

  it("빈 값을 빈칸으로 두지 않는다(모델이 지어내지 않게)", () => {
    const text = renderCompanyAnalysisInput({
      stock: { ...stock, canslim: undefined },
      portfolio: { ...portfolio, recentJournal: [] },
    });
    expect(text).toContain("자료 없음");
    expect(text).toContain("자료에 없는 수치는 쓰지 마세요");
  });
});

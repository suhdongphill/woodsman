/**
 * AI 크롤러 정책 — 순수 값. **누구에게 무엇을 열어 줄지 한 곳에서 정한다.**
 *
 * ## 왜 명시하나
 * `User-Agent: *`로 이미 전부 허용이라 굳이 적지 않아도 동작은 같다. 그런데도 이름을 적는 이유는
 * 두 가지다.
 * 1. **결정을 기록으로 남긴다.** 나중에 누가 "AI는 막아야 하지 않나" 물었을 때, 왜 열었는지가
 *    코드에 적혀 있어야 한다.
 * 2. **실수로 막히는 것을 막는다.** 나중에 `*`를 조이면 AI 크롤러까지 함께 잠긴다.
 *    개별로 적어 두면 그때 눈에 띈다.
 *
 * ## ⚠ 되돌리지 말 것: 학습 크롤러(Google-Extended)를 연다
 * 2026-08-06 결정. 이 사이트의 강점은 **최신 수치와 기준일**이라 모델에 흡수되는 것보다
 * **인용되는 것**이 이득이다. 막으면 AI 개요·답변에서 아예 사라진다.
 * 1순위 목적이 티스토리 유입인데, 사람들이 검색창 대신 AI에게 묻기 시작했기 때문이다
 * (CLAUDE.md 5장의 목적 판단을 그대로 따른 결론).
 *
 * ⚠ 열어 주는 것은 **공개 화면뿐**이다. `/admin`·`/api`·로그인은 사람과 똑같이 막는다.
 */

export type CrawlerPurpose =
  /** 답변에 인용하며 링크를 준다 — 우리가 가장 원하는 것 */
  | "answer"
  /** 사용자가 그 순간 요청한 페이지를 대신 열어 본다 */
  | "browse"
  /** 모델 학습에 쓴다 */
  | "training";

export type AiCrawler = {
  /** robots.txt에 적는 User-Agent 이름 */
  userAgent: string;
  /** 누가 보내는가 */
  operator: string;
  purpose: CrawlerPurpose;
  /** 왜 이 결정인가 — 문서 대신 여기 적는다 */
  note: string;
};

/**
 * 이름을 적어 두는 AI 크롤러.
 * 전부 **허용**이다. 막을 크롤러가 생기면 여기서 빼는 게 아니라 `blocked` 목록을 따로 만든다
 * (허용/차단이 한 배열에 섞이면 읽는 사람이 헷갈린다).
 */
export const AI_CRAWLERS: AiCrawler[] = [
  {
    userAgent: "GPTBot",
    operator: "OpenAI",
    purpose: "training",
    note: "ChatGPT 학습. 인용 노출의 전제라 연다.",
  },
  {
    userAgent: "OAI-SearchBot",
    operator: "OpenAI",
    purpose: "answer",
    note: "ChatGPT 검색 결과에 링크와 함께 노출된다. 가장 원하는 경로.",
  },
  {
    userAgent: "ChatGPT-User",
    operator: "OpenAI",
    purpose: "browse",
    note: "사용자가 요청한 순간에만 방문한다.",
  },
  {
    userAgent: "ClaudeBot",
    operator: "Anthropic",
    purpose: "training",
    note: "Claude 학습.",
  },
  {
    userAgent: "Claude-SearchBot",
    operator: "Anthropic",
    purpose: "answer",
    note: "Claude가 답변에 인용할 자료를 찾는다.",
  },
  {
    userAgent: "Claude-User",
    operator: "Anthropic",
    purpose: "browse",
    note: "사용자 요청 시 방문.",
  },
  {
    userAgent: "PerplexityBot",
    operator: "Perplexity",
    purpose: "answer",
    note: "출처를 항상 같이 보여주는 서비스라 유입으로 이어지기 쉽다.",
  },
  {
    userAgent: "Perplexity-User",
    operator: "Perplexity",
    purpose: "browse",
    note: "사용자 요청 시 방문.",
  },
  {
    userAgent: "Google-Extended",
    operator: "Google",
    purpose: "training",
    // ⚠ 2026-08-06 결정. 차단하면 AI 개요에서 사라진다.
    note: "제미나이·AI 개요. 학습 흡수보다 인용 노출이 이득이라고 판단해 연다.",
  },
  {
    userAgent: "Applebot-Extended",
    operator: "Apple",
    purpose: "training",
    note: "Apple Intelligence. 같은 판단.",
  },
];

/** 사람에게도 안 여는 곳은 크롤러에게도 안 연다. */
export const CRAWLER_DISALLOW = ["/admin", "/admin/", "/login", "/register", "/api/"];

/** robots.txt 규칙으로. `*` 규칙과 같은 차단 목록을 쓴다 — 어긋나면 정책이 두 개가 된다. */
export function aiCrawlerRules(): { userAgent: string; allow: string; disallow: string[] }[] {
  return AI_CRAWLERS.map((c) => ({
    userAgent: c.userAgent,
    allow: "/",
    disallow: CRAWLER_DISALLOW,
  }));
}

/**
 * Phase 0 목업 데이터.
 * Phase 1에서 Prisma seed / DB 조회로 대체된다. (필드명은 Prisma 스키마와 동일)
 * 주의: 날짜·난수는 모두 고정값 — SSR/CSR hydration 불일치를 막는다.
 */
import type {
  AccountSnapshot,
  AiConfig,
  AiProvider,
  Comment,
  Feed,
  JournalEntry,
  SiteConfig,
  StockSummary,
} from "./types";

/* ─────────────── 사이트 설정 ─────────────── */
export const siteConfig: SiteConfig = {
  // 운영자 1인 콘텐츠 사이트 — 가입·커뮤니티는 닫혀 있다(src/lib/site-policy.ts).
  signupEnabled: false,
  communityEnabled: false,
  commentsGloballyEnabled: true,
  requireLoginToComment: true,
  moderationOn: false,
  bannedWords: "욕설,비방,광고",
  heroTitle: "원칙대로 심고, 기다리고, 불린다",
  heroSubtitle:
    "성장·인컴·방어로 나눈 계좌를 그대로 공개합니다. 매달 얼마를 넣었고 지금 얼마가 되었는지, 그 사이에 무엇을 사고팔았는지까지 기록으로 남깁니다.",
};

/* ─────────────── 계좌 스냅샷 (원금 대비 평가액) ─────────────── */
/**
 * 운용자의 계좌를 그대로 공개하는 콘텐츠의 원천 데이터.
 * 2026-03처럼 평가액이 원금을 밑돈 달도 그대로 둔다 — 좋은 달만 남기면 기록이 아니다.
 */
export const accountSnapshots: AccountSnapshot[] = [
  { date: "2026-01-31", principal: 52_000_000, value: 51_240_000, income: 0 },
  { date: "2026-02-28", principal: 56_000_000, value: 56_880_000, income: 180_000 },
  {
    date: "2026-03-31",
    principal: 58_000_000,
    value: 57_110_000,
    income: 180_000,
    memo: "기능별 재편 직후 조정 구간. 평가액이 원금을 1.5% 밑돌았다.",
  },
  { date: "2026-04-30", principal: 61_000_000, value: 63_420_000, income: 420_000 },
  { date: "2026-05-31", principal: 63_000_000, value: 66_980_000, income: 640_000 },
  { date: "2026-06-30", principal: 66_000_000, value: 69_310_000, income: 1_050_000 },
  {
    date: "2026-07-31",
    principal: 68_000_000,
    value: 76_540_000,
    income: 1_410_000,
    memo: "성장 버킷 차익 일부를 현금으로 옮겨 다음 리밸런싱 탄약을 확보.",
  },
];

/* ─────────────── 투자일지 ─────────────── */
export const journalEntries: JournalEntry[] = [
  {
    id: "jn_06",
    date: "2026-07-28",
    action: "REBALANCE",
    title: "엔비디아 비중 축소, 현금 10%로 복원",
    body: "성장 버킷이 목표 36%를 넘어 41%가 됐다. 실적이 좋아서 오른 것이지 내 판단이 좋아서 오른 게 아니므로, 규칙대로 되돌린다. 차익 일부는 달러 MMF로 옮겨 다음 리밸런싱 탄약으로 둔다.",
    ticker: "NVDA",
    name: "엔비디아",
    shares: 12,
    price: 151.4,
    currency: "USD",
    postSlug: "rebalancing-rules",
    published: true,
  },
  {
    id: "jn_05",
    date: "2026-06-30",
    action: "BUY",
    title: "맥쿼리인프라 신규 편입 — 원화 인컴의 기본값",
    body: "달러 인컴만으로는 생활비 통화와 어긋난다. 통행료·요금 기반 현금흐름은 물가에 연동되고 반기 배당이 나온다. 인컴 버킷의 원화 파트를 여기서 채운다.",
    ticker: "088980",
    name: "맥쿼리인프라",
    shares: 900,
    price: 11_800,
    currency: "KRW",
    published: true,
  },
  {
    id: "jn_04",
    date: "2026-05-19",
    action: "BUY",
    title: "화이자 추가 매수 — 배당 커버리지 재확인 후",
    body: "주가가 빠져서 산 게 아니라, 잉여현금흐름 대비 배당 지급률이 여전히 60% 아래인 걸 확인하고 샀다. 특허 절벽은 이미 가격에 있다. 인컴 버킷 배당수익률이 5.4%에서 6.1%로 올라왔다.",
    ticker: "PFE",
    name: "화이자",
    shares: 60,
    price: 27.1,
    currency: "USD",
    postSlug: "pfizer-dividend-safety",
    published: true,
  },
  {
    id: "jn_03",
    date: "2026-04-14",
    action: "NOTE",
    title: "3월에 원금 아래로 내려갔던 구간을 복기한다",
    body: "재편 직후 한 달간 평가액이 납입원금을 1.5% 밑돌았다. 그때 팔고 싶었지만 thesis가 깨진 종목은 하나도 없었기에 아무것도 하지 않았다. 결과적으로 옳았지만, 옳았다는 사실보다 '규칙대로 아무것도 하지 않았다'가 기록할 값이다.",
    published: true,
  },
  {
    id: "jn_02",
    date: "2026-03-11",
    action: "REBALANCE",
    title: "기능별 재편 — 성장 36 / 인컴 40 / 방어 24",
    body: "종목을 고르기 전에 통을 먼저 정했다. 성장 비중은 '얼마나 오를까'가 아니라 '30% 빠져도 버틸 수 있나'로 정했다. 이 기준선이 이후 모든 매매의 근거가 된다.",
    postSlug: "three-bucket-portfolio",
    published: true,
  },
  {
    id: "jn_01",
    date: "2026-02-05",
    action: "BUY",
    title: "TSMC 편입 — 선단 공정 독점을 산다",
    body: "AI 수요 자체를 맞히려는 게 아니라, 누가 만들든 거쳐 가는 길목을 산다. 고객사 선지급 구조가 가동률 하방을 방어한다. 캐펙스 사이클 정점 신호가 나오면 재검토한다.",
    ticker: "TSM",
    name: "TSMC",
    shares: 40,
    price: 142.5,
    currency: "USD",
    postSlug: "tsmc-2nm-cycle",
    published: true,
  },
];

/* 콘텐츠(Post) 목업은 삭제했다(2026-08-06).
   화면이 이 파일을 읽는 한 관리자 화면에서 아무리 써도 사이트에 나오지 않는다 —
   투자일지·대표 포트폴리오에서 두 번 겪은 사고와 같다.
   지금은 `features/posts/repository.ts`가 D1을 읽고, 시드는 `lib/seed-data.ts`에 있다.
   ⚠ 목업을 되살리지 말 것. */

/* ─────────────── 댓글 ─────────────── */
export const comments: Comment[] = [
  {
    id: "c_1",
    postId: "p_1",
    postTitle: "성장·인컴·방어: 포트폴리오를 세 개의 통으로 나누는 이유",
    authorName: "산책자",
    body: "기능별로 나누는 관점이 신선하네요. 성장 비중을 '버틸 수 있는 만큼'으로 정한다는 말이 인상 깊습니다.",
    status: "VISIBLE",
    reported: false,
    createdAt: "2026-07-26T14:12:00+09:00",
  },
  {
    id: "c_2",
    postId: "p_1",
    postTitle: "성장·인컴·방어: 포트폴리오를 세 개의 통으로 나누는 이유",
    authorName: "장기투자",
    body: "방어 버킷 20%는 지금 시장에서 좀 높지 않나요? 현금 비중 기준이 궁금합니다.",
    status: "VISIBLE",
    reported: false,
    createdAt: "2026-07-27T09:31:00+09:00",
  },
  {
    id: "c_3",
    postId: "p_2",
    postTitle: "TSMC 2nm 양산, 이번 사이클은 무엇이 다른가",
    authorName: "반도체러버",
    body: "고객 집중도 리스크 부분 더 자세히 다뤄주시면 좋겠습니다!",
    status: "VISIBLE",
    reported: false,
    createdAt: "2026-07-23T08:05:00+09:00",
  },
  {
    id: "c_4",
    postId: "p_5",
    postTitle: "엔비디아 실적 전 체크리스트 5가지",
    authorName: "익명",
    body: "○○종목 지금 사면 3배 갑니다 문의주세요",
    status: "PENDING",
    reported: true,
    createdAt: "2026-07-29T22:47:00+09:00",
  },
  {
    id: "c_5",
    postId: "p_5",
    postTitle: "엔비디아 실적 전 체크리스트 5가지",
    authorName: "데이터센터",
    body: "총마진 방향성 체크 포인트 좋네요. 다음 분기에 적용해보겠습니다.",
    status: "VISIBLE",
    reported: false,
    createdAt: "2026-07-09T10:22:00+09:00",
  },
  {
    id: "c_6",
    postId: "p_8",
    postTitle: "리밸런싱은 달력으로, 매도는 논리로",
    authorName: "청개구리",
    body: "(숨김 처리된 댓글)",
    status: "HIDDEN",
    reported: true,
    createdAt: "2026-06-01T19:03:00+09:00",
  },
];

export function getCommentsByPostId(postId: string) {
  return comments.filter((c) => c.postId === postId && c.status === "VISIBLE");
}

/* ─────────────── 종목 ─────────────── */
export const stocks: StockSummary[] = [
  {
    ticker: "TSM",
    name: "TSMC",
    market: "NYSE",
    industry: "반도체·IT부품",
    price: 191.2,
    changePct: 1.24,
    currency: "USD",
    canslim: 8.4,
    spark: [168, 171, 169, 175, 178, 176, 182, 185, 183, 188, 190, 191.2],
  },
  {
    ticker: "NVDA",
    name: "엔비디아",
    market: "NASDAQ",
    industry: "반도체·IT부품",
    price: 148.7,
    changePct: -0.86,
    currency: "USD",
    canslim: 7.9,
    spark: [155, 152, 158, 161, 157, 154, 150, 153, 151, 149, 150.2, 148.7],
  },
  {
    ticker: "005930",
    name: "삼성전자",
    market: "KOSPI",
    industry: "반도체·IT부품",
    price: 84300,
    changePct: 0.72,
    currency: "KRW",
    canslim: 6.8,
    spark: [76000, 77500, 79000, 78200, 80100, 81300, 80500, 82400, 83100, 82800, 83900, 84300],
  },
  {
    ticker: "PFE",
    name: "화이자",
    market: "NYSE",
    industry: "바이오·헬스케어",
    price: 26.4,
    changePct: 0.45,
    currency: "USD",
    canslim: 5.2,
    spark: [28.9, 28.4, 27.9, 27.5, 27.8, 27.1, 26.8, 26.2, 26.5, 26.1, 26.3, 26.4],
  },
  {
    ticker: "069500",
    name: "KODEX 200",
    market: "KOSPI",
    industry: "기타",
    price: 36980,
    changePct: -0.41,
    currency: "KRW",
    canslim: 6.1,
    spark: [34200, 34800, 35400, 35100, 35900, 36400, 36100, 36800, 37200, 37050, 37120, 36980],
  },
  {
    ticker: "088980",
    name: "맥쿼리인프라",
    market: "KOSPI",
    industry: "금융·핀테크",
    price: 12450,
    changePct: 0.32,
    currency: "KRW",
    canslim: 4.6,
    spark: [11800, 11750, 11900, 12050, 11980, 12100, 12300, 12200, 12380, 12400, 12410, 12450],
  },
  {
    ticker: "AAPL",
    name: "애플",
    market: "NASDAQ",
    industry: "소프트웨어·플랫폼",
    price: 232.6,
    changePct: 0.58,
    currency: "USD",
    canslim: 7.1,
    spark: [214, 218, 221, 219, 224, 227, 225, 229, 231, 230, 233, 232.6],
  },
  {
    ticker: "MSFT",
    name: "마이크로소프트",
    market: "NASDAQ",
    industry: "소프트웨어·플랫폼",
    price: 471.3,
    changePct: 1.02,
    currency: "USD",
    canslim: 8.0,
    spark: [432, 439, 444, 441, 450, 455, 452, 461, 466, 464, 469, 471.3],
  },
];

export function getStock(ticker: string) {
  return stocks.find((s) => s.ticker.toLowerCase() === ticker.toLowerCase());
}

/** 홈 '주목 종목' 4개 */
export const featuredStocks = stocks.slice(0, 4);

/** 종목 상세 목업: 90일 캔들 대체용 종가 시리즈 (고정 생성) */
export function mockSeries(base: number, len = 90) {
  const out: { t: string; v: number }[] = [];
  let v = base * 0.86;
  for (let i = 0; i < len; i++) {
    // 결정적(deterministic) 파형 — 난수 미사용
    const wave = Math.sin(i / 6) * 0.012 + Math.sin(i / 17) * 0.02 + 0.0016;
    v = v * (1 + wave);
    const d = new Date(Date.UTC(2026, 4, 4) + i * 86400000);
    out.push({ t: d.toISOString().slice(0, 10), v: Number(v.toFixed(2)) });
  }
  return out;
}

/* ─────────────── AI 제공자 ─────────────── */
export const aiProviders: AiProvider[] = [
  {
    id: "ai_nvidia",
    name: "NVIDIA NIM",
    kind: "OPENAI_COMPAT",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    model: "meta/llama-3.3-70b-instruct",
    apiKeyEnv: "NVIDIA_API_KEY",
    free: true,
    enabled: true,
    priority: 0,
    monthlyTokenCap: 500000,
    tokensUsedThisMonth: 128400,
    connected: true,
  },
  {
    id: "ai_groq",
    name: "Groq",
    kind: "OPENAI_COMPAT",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "llama-3.3-70b-versatile",
    apiKeyEnv: "GROQ_API_KEY",
    free: true,
    enabled: true,
    priority: 1,
    monthlyTokenCap: 300000,
    tokensUsedThisMonth: 41200,
    connected: true,
  },
  {
    id: "ai_gemini",
    name: "Google Gemini (무료티어)",
    kind: "OPENAI_COMPAT",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-2.0-flash",
    apiKeyEnv: "GEMINI_API_KEY",
    free: true,
    enabled: false,
    priority: 2,
    monthlyTokenCap: 300000,
    tokensUsedThisMonth: 0,
    connected: false,
  },
  {
    id: "ai_openrouter",
    name: "OpenRouter (무료 모델)",
    kind: "OPENAI_COMPAT",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "meta-llama/llama-3.3-70b-instruct:free",
    apiKeyEnv: "OPENROUTER_API_KEY",
    free: true,
    enabled: false,
    priority: 3,
    tokensUsedThisMonth: 0,
    connected: false,
  },
  {
    id: "ai_anthropic",
    name: "Anthropic Claude",
    kind: "ANTHROPIC",
    model: "claude-sonnet-5",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    free: false,
    enabled: true,
    priority: 9,
    monthlyTokenCap: 200000,
    tokensUsedThisMonth: 36700,
    connected: true,
  },
];

export const aiConfig: AiConfig = {
  allowedRole: "ADMIN",
  cacheTtlHours: 24,
  globalMonthlyTokenCap: 1000000,
  tokensUsedThisMonth: 206300,
};

/* ─────────────── RSS 피드 ─────────────── */
export const feeds: Feed[] = [
  {
    id: "f_1",
    name: "Woodsman 티스토리",
    url: "https://suhdp.tistory.com/rss",
    active: true,
    lastFetchedAt: "2026-07-31T06:00:00+09:00",
    itemCount: 42,
  },
  {
    id: "f_2",
    name: "인컴 노트(티스토리)",
    url: "https://incomenote.tistory.com/rss",
    active: false,
    lastFetchedAt: "2026-07-02T06:00:00+09:00",
    itemCount: 17,
  },
];

/** /admin/feeds 미리보기용 가져오기 대기 항목 */
export const feedItems = [
  {
    id: "fi_1",
    feedName: "Woodsman 티스토리",
    title: "배당 캘린더로 현금흐름 설계하기",
    link: "https://suhdp.tistory.com/entry/dividend-calendar",
    publishedAt: "2026-07-15T20:10:00+09:00",
    imported: true,
  },
  {
    id: "fi_2",
    feedName: "Woodsman 티스토리",
    title: "브라질 국채, 달러표시로만 사는 이유",
    link: "https://suhdp.tistory.com/entry/brazil-bond-usd",
    publishedAt: "2026-06-14T08:40:00+09:00",
    imported: true,
  },
  {
    id: "fi_3",
    feedName: "Woodsman 티스토리",
    title: "ETF 분배금 재투자, 언제가 유리한가",
    link: "https://suhdp.tistory.com/entry/etf-drip",
    publishedAt: "2026-07-30T21:00:00+09:00",
    imported: false,
  },
];

/* 사용자 목업은 삭제했다(2026-08-06).
   화면이 이 파일을 읽는 한 삭제 버튼이 아무 일도 하지 않는다 —
   지금은 `features/users/repository.ts`가 D1을 읽는다. ⚠ 되살리지 말 것. */

/* ─────────────── 관리자 대시보드 요약 ─────────────── */
export const adminStats = {
  visitorsToday: 1284,
  visitorsDelta: 12.4,
  newComments: 6,
  pendingComments: comments.filter((c) => c.status === "PENDING").length,
  reportedComments: comments.filter((c) => c.reported).length,
  publishedPosts: 0,
  draftPosts: 0,
  aiTokensUsed: aiConfig.tokensUsedThisMonth,
  aiTokenCap: aiConfig.globalMonthlyTokenCap,
  /** 최근 7일 방문자 (막대그래프용) */
  weeklyVisitors: [742, 810, 905, 866, 1120, 1043, 1284],
};

/* 대표 포트폴리오·리밸런싱 목업은 삭제했다(2026-08-06).
   화면이 이 파일을 읽는 한 관리자 화면에서 아무리 고쳐도 바뀌지 않는다 —
   투자일지에서 겪은 사고와 같다. 지금은 `features/portfolio/repository.ts`가 D1을 읽고,
   시드 데이터는 `lib/seed-data.ts`에 있다. 목업을 되살리지 말 것. */

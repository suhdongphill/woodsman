/**
 * 시드 데이터(순수 값·빌더).
 * DB 접근 없이 테스트할 수 있도록 prisma/seed.ts와 분리한다.
 */
import { AI_PROVIDERS } from "./ai/catalog";
import { TISTORY_RSS_URL } from "./site-links";

export type SeedModelHolding = {
  key: string;
  name: string;
  ticker?: string;
  market?: string;
  functionType: "GROWTH" | "INCOME" | "DEFENSE";
  targetWeight: number;
  avgCost?: number;
  shares?: number;
  currency: "KRW" | "USD";
  canslim?: number;
  thesis: string;
  order: number;
};

export const seedModelHoldings: SeedModelHolding[] = [
  {
    key: "TSM",
    name: "TSMC",
    ticker: "TSM",
    market: "NYSE",
    functionType: "GROWTH",
    targetWeight: 20,
    avgCost: 142.5,
    shares: 40,
    currency: "USD",
    canslim: 8.4,
    order: 1,
    thesis:
      "AI 가속기 수요가 선단 공정 독점 구조로 수렴한다. 파운드리 점유율 60%대, 고객사 선주문 구조로 가동률 하방이 방어된다. 설비투자 사이클 정점 이전까지 보유.",
  },
  {
    key: "NVDA",
    name: "엔비디아",
    ticker: "NVDA",
    market: "NASDAQ",
    functionType: "GROWTH",
    targetWeight: 16,
    avgCost: 98.3,
    shares: 60,
    currency: "USD",
    canslim: 7.9,
    order: 2,
    thesis:
      "CUDA 생태계 락인 + 데이터센터 매출 비중 80%. 밸류에이션이 실적 서프라이즈에 의존하므로 목표비중을 TSMC보다 낮게 유지하고 분기 실적 전후 리밸런싱 구간을 둔다.",
  },
  {
    key: "BRLB33",
    name: "브라질 국채 2033 (달러표시)",
    ticker: "BRLB33",
    market: "BOND",
    functionType: "INCOME",
    targetWeight: 16,
    avgCost: 96.4,
    shares: 120,
    currency: "USD",
    order: 3,
    thesis:
      "표면금리 10%대, 만기 보유 시 현금흐름이 확정적. 헤알 변동 리스크를 피하려 달러표시로만 담는다. 인컴 버킷의 기준 수익률(hurdle)을 제공하는 자리.",
  },
  {
    key: "PFE",
    name: "화이자",
    ticker: "PFE",
    market: "NYSE",
    functionType: "INCOME",
    targetWeight: 12,
    avgCost: 27.8,
    shares: 180,
    currency: "USD",
    canslim: 5.2,
    order: 4,
    thesis:
      "배당수익률 6%대, 특허 절벽은 이미 가격에 반영. 파이프라인 재평가가 오면 덤이고 오지 않아도 배당으로 버틴다. 인컴 버킷의 주식 파트.",
  },
  {
    key: "088980",
    name: "맥쿼리인프라",
    ticker: "088980",
    market: "KOSPI",
    functionType: "INCOME",
    targetWeight: 12,
    avgCost: 11800,
    shares: 900,
    currency: "KRW",
    order: 5,
    thesis:
      "통행료·요금 기반 인프라 현금흐름은 물가에 연동된다. 금리 하락 국면에서 가격 회복 + 반기 배당의 이중 수익. 원화 인컴의 기본값.",
  },
  {
    key: "069500",
    name: "KODEX 200",
    ticker: "069500",
    market: "KOSPI",
    functionType: "DEFENSE",
    targetWeight: 24,
    avgCost: 34200,
    shares: 320,
    currency: "KRW",
    canslim: 6.1,
    order: 6,
    thesis:
      "개별 종목 판단이 틀렸을 때 포트폴리오 전체가 시장을 밑돌지 않게 하는 앵커. 현금 대기자금의 임시 주차 공간 역할도 겸한다.",
  },
];

export const seedRebalances = [
  {
    date: "2026-06-30",
    memo: "맥쿼리인프라 신규 편입(12%). 원화 인컴 비중 확보 목적.",
  },
  {
    date: "2026-05-19",
    memo: "화이자 추가 매수로 인컴 버킷 배당수익률 5.4% → 6.1%로 상향.",
  },
  {
    date: "2026-03-11",
    memo: "포트폴리오 기능별 재편(성장 36 / 인컴 40 / 방어 24) 기준 확정.",
  },
];

/**
 * 계좌 스냅샷 — 월 1회 기록.
 * `principal`은 그때까지 넣은 납입원금 누계, `value`는 그날의 총 평가액이다.
 * 두 값을 같은 축에 올리면 "원칙대로 한 투자가 실제로 성과를 냈는지"가 그림으로 보인다.
 * 2026-03처럼 평가액이 원금을 밑도는 달도 그대로 남긴다 — 좋은 달만 보이면 기록이 아니다.
 */
export const seedAccountSnapshots = [
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

export type SeedJournalEntry = {
  date: string;
  /** BUY | SELL | REBALANCE | NOTE */
  action: string;
  title: string;
  body: string;
  ticker?: string;
  name?: string;
  shares?: number;
  price?: number;
  currency?: "KRW" | "USD";
  postSlug?: string;
};

/**
 * 투자일지 — 판단을 남기는 기록.
 * 성과(AccountSnapshot)와 같은 시간축에 놓여야 "그때 왜 그렇게 했는지"가 읽힌다.
 * 성공한 판단만 적지 않는다.
 */
export const seedJournalEntries: SeedJournalEntry[] = [
  {
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
  },
  {
    date: "2026-06-30",
    action: "BUY",
    title: "맥쿼리인프라 신규 편입 — 원화 인컴의 기본값",
    body: "달러 인컴만으로는 생활비 통화와 어긋난다. 통행료·요금 기반 현금흐름은 물가에 연동되고 반기 배당이 나온다. 인컴 버킷의 원화 파트를 여기서 채운다.",
    ticker: "088980",
    name: "맥쿼리인프라",
    shares: 900,
    price: 11_800,
    currency: "KRW",
  },
  {
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
  },
  {
    date: "2026-04-14",
    action: "NOTE",
    title: "3월에 원금 아래로 내려갔던 구간을 복기한다",
    body: "재편 직후 한 달간 평가액이 납입원금을 1.5% 밑돌았다. 그때 팔고 싶었지만 thesis가 깨진 종목은 하나도 없었기에 아무것도 하지 않았다. 결과적으로 옳았지만, 옳았다는 사실보다 '규칙대로 아무것도 하지 않았다'가 기록할 값이다.",
  },
  {
    date: "2026-03-11",
    action: "REBALANCE",
    title: "기능별 재편 — 성장 36 / 인컴 40 / 방어 24",
    body: "종목을 고르기 전에 통을 먼저 정했다. 성장 비중은 '얼마나 오를까'가 아니라 '30% 빠져도 버틸 수 있나'로 정했다. 이 기준선이 이후 모든 매매의 근거가 된다.",
    postSlug: "three-bucket-portfolio",
  },
  {
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
  },
];

export type SeedPost = {
  slug: string;
  type: "INSIGHT" | "ANALYSIS" | "NOTICE";
  category: string;
  title: string;
  excerpt: string;
  bodyHtml: string;
  source: "SELF" | "TISTORY";
  externalUrl?: string;
  ticker?: string;
  tags?: string;
  commentsEnabled: boolean;
  published: boolean;
  publishedAt: string;
  viewCount: number;
};

/** 샘플 Post 4종 — 직접작성 인사이트 / 종목분석 / 티스토리 큐레이션 / 댓글잠금 공지 */
export const seedPosts: SeedPost[] = [
  {
    slug: "three-bucket-portfolio",
    type: "INSIGHT",
    category: "포트폴리오 전략",
    title: "성장·인컴·방어: 포트폴리오를 세 개의 통으로 나누는 이유",
    excerpt:
      "종목을 잘 고르는 것보다 중요한 건 '이 종목이 내 포트폴리오에서 무슨 일을 하는가'입니다.",
    source: "SELF",
    tags: "자산배분,원칙,리밸런싱",
    commentsEnabled: true,
    published: true,
    publishedAt: "2026-07-26T10:00:00+09:00",
    viewCount: 2841,
    bodyHtml: `<p>포트폴리오가 흔들릴 때 대부분의 사람은 <strong>종목을 바꿉니다</strong>. 하지만 문제는 종목이 아니라 배분인 경우가 훨씬 많습니다.</p>
<h2>기능으로 나눈다</h2>
<ul>
<li><strong>성장(GROWTH)</strong> — 이익 성장률로 수익을 만든다.</li>
<li><strong>인컴(INCOME)</strong> — 배당·이자로 현금흐름을 만든다.</li>
<li><strong>방어(DEFENSE)</strong> — 지수·현금으로 최악을 막는다.</li>
</ul>
<blockquote>편입 논리를 적을 수 없는 종목은 사지 않는다.</blockquote>`,
  },
  {
    slug: "tsmc-2nm-cycle",
    type: "ANALYSIS",
    category: "종목분석",
    title: "TSMC 2nm 양산, 이번 사이클은 무엇이 다른가",
    excerpt: "선단 공정 독점이 가격 결정력으로 이어지는 구간. CANSLIM 근거와 리스크 3가지.",
    source: "SELF",
    ticker: "TSM",
    tags: "반도체,파운드리,TSMC",
    commentsEnabled: true,
    published: true,
    publishedAt: "2026-07-22T09:30:00+09:00",
    viewCount: 1932,
    bodyHtml: `<p>TSMC의 2nm 양산은 단순한 노드 전환이 아니라 <strong>가격 결정력의 전환점</strong>입니다.</p>
<h2>리스크 3가지</h2>
<ul>
<li>지정학 — 대만 해협 이벤트는 가격에 선반영되지 않는다</li>
<li>설비투자 사이클 — 캐펙스 정점 이후 감가상각 부담</li>
<li>고객 집중도 — 상위 2개 고객 매출 비중</li>
</ul>`,
  },
  {
    slug: "tistory-dividend-calendar",
    type: "INSIGHT",
    category: "인컴 투자",
    title: "[티스토리] 배당 캘린더로 현금흐름 설계하기",
    excerpt: "월별 배당 입금일을 달력에 깔면 인컴 포트폴리오의 빈 달이 보입니다.",
    source: "TISTORY",
    externalUrl: "https://suhdp.tistory.com/entry/dividend-calendar",
    tags: "배당,현금흐름",
    commentsEnabled: true,
    published: true,
    publishedAt: "2026-07-15T20:10:00+09:00",
    viewCount: 1204,
    bodyHtml: `<p>인컴 포트폴리오를 만들면 대부분 배당이 몰리는 달과 비는 달이 생깁니다.</p>
<p>종목을 늘리는 게 아니라 <em>일정</em>을 배치하는 문제입니다. 전체 표는 원문에서 확인하세요.</p>`,
  },
  {
    slug: "notice-comment-policy",
    type: "NOTICE",
    category: "공지",
    title: "댓글 운영 정책 안내 (승인제·신고 처리 기준)",
    excerpt: "커뮤니티 댓글 정책과 잠금(🔒) 표시의 의미를 안내드립니다.",
    source: "SELF",
    commentsEnabled: false,
    published: true,
    publishedAt: "2026-07-10T09:00:00+09:00",
    viewCount: 663,
    bodyHtml: `<h2>댓글 정책</h2>
<ul>
<li>로그인한 회원만 댓글을 작성할 수 있습니다.</li>
<li>관리자가 잠근 글은 목록과 상세에 🔒로 표시됩니다.</li>
<li>비속어·광고는 자동 필터 및 신고로 숨김 처리됩니다.</li>
</ul>
<p>이 글은 댓글이 잠겨 있습니다.</p>`,
  },
];

export const seedComments = [
  {
    postSlug: "three-bucket-portfolio",
    authorName: "산책자",
    body: "기능별로 나누는 관점이 신선하네요. 성장 비중을 '버틸 수 있는 만큼'으로 정한다는 말이 인상 깊습니다.",
    status: "VISIBLE" as const,
    reported: false,
  },
  {
    postSlug: "tsmc-2nm-cycle",
    authorName: "반도체러버",
    body: "고객 집중도 리스크 부분 더 자세히 다뤄주시면 좋겠습니다!",
    status: "VISIBLE" as const,
    reported: false,
  },
  {
    postSlug: "tsmc-2nm-cycle",
    authorName: "익명",
    body: "승인제 동작 확인용 댓글입니다.",
    status: "PENDING" as const,
    reported: false,
  },
];

export const seedFeeds = [
  { name: "Woodsman 티스토리", url: TISTORY_RSS_URL, active: true },
];

export const seedSiteConfig = {
  // 운영자 1인 콘텐츠 사이트 — 공개 가입과 커뮤니티는 닫아 둔 채로 시작한다.
  // 관리자가 /admin/comments에서 켜면 준비된 기능이 그대로 열린다.
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

export const seedAiConfig = {
  allowedRole: "ADMIN",
  cacheTtlHours: 24,
  globalMonthlyTokenCap: 1_000_000,
};

/**
 * 기본 AI 제공자 목록. 키 '값'은 저장하지 않고 env 변수명만 기록한다.
 *
 * ⚠ 목록을 여기에 다시 적지 않는다. **출처는 `src/lib/ai/catalog.ts` 하나**다.
 * 예전에는 두 곳에 따로 적혀 있어서 카탈로그에 제공자를 추가해도 시드에는 안 들어갔다.
 * (priority = 카탈로그 순서. 카탈로그가 무료를 앞에 두므로 폴백 순서가 그대로 따라온다.)
 */
export const aiProviderCatalog = AI_PROVIDERS.map((p, index) => ({
  name: p.label,
  kind: p.kind,
  baseUrl: p.baseUrl,
  /** 기본 모델 = 카탈로그의 첫 모델. 실제 호출 모델은 작업별로 routing.ts가 고른다. */
  model: p.models[0].id,
  apiKeyEnv: p.apiKeyEnv,
  free: p.free,
  priority: index,
  /** ⚠ 유료 제공자는 상한을 반드시 둔다. 없으면 실수 한 번이 그대로 청구서가 된다. */
  monthlyTokenCap: p.free ? 300_000 : 200_000,
}));

/**
 * env에 키가 존재하는 제공자만 enabled=true로 만든다(무료가 우선순위 앞).
 * 키 값 자체는 결과에 담기지 않는다.
 */
export function buildAiProviderSeeds(hasKey: (envName: string) => boolean) {
  return aiProviderCatalog.map((p) => ({
    ...p,
    enabled: hasKey(p.apiKeyEnv),
  }));
}

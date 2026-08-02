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
  ModelHolding,
  Post,
  Rebalance,
  SiteConfig,
  StockSummary,
  UserRow,
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

/* ─────────────── 대표(모델) 포트폴리오 ─────────────── */
export const modelHoldings: ModelHolding[] = [
  {
    id: "mh_tsm",
    name: "TSMC",
    ticker: "TSM",
    market: "NYSE",
    functionType: "GROWTH",
    targetWeight: 18,
    avgCost: 142.5,
    shares: 40,
    currency: "USD",
    price: 191.2,
    changePct: 1.24,
    canslim: 8.4,
    order: 1,
    published: true,
    updatedAt: "2026-07-28T09:00:00+09:00",
    thesis:
      "AI 가속기 수요가 3nm·2nm 선단 공정 독점 구조로 수렴한다. 파운드리 점유율 60%대, 고객사 선주문(prepayment) 구조로 가동률 하방이 방어된다. 설비투자 사이클 정점 이전까지 보유.",
  },
  {
    id: "mh_nvda",
    name: "엔비디아",
    ticker: "NVDA",
    market: "NASDAQ",
    functionType: "GROWTH",
    targetWeight: 14,
    avgCost: 98.3,
    shares: 60,
    currency: "USD",
    price: 148.7,
    changePct: -0.86,
    canslim: 7.9,
    order: 2,
    published: true,
    updatedAt: "2026-07-28T09:00:00+09:00",
    thesis:
      "CUDA 생태계 락인 + 데이터센터 매출 비중 80%. 다만 밸류에이션이 실적 서프라이즈에 의존하므로 목표비중을 TSMC보다 낮게 유지하고, 분기 실적 전후 리밸런싱 구간을 둔다.",
  },
  {
    id: "mh_brl",
    name: "브라질 국채 2033 (달러표시)",
    ticker: "BRLB33",
    market: "BOND",
    functionType: "INCOME",
    targetWeight: 16,
    avgCost: 96.4,
    shares: 120,
    currency: "USD",
    price: 99.1,
    changePct: 0.12,
    order: 3,
    published: true,
    updatedAt: "2026-07-20T09:00:00+09:00",
    thesis:
      "표면금리 10%대, 만기 보유 시 현금흐름이 확정적. 헤알 변동 리스크를 피하려 달러표시로만 담는다. 인컴 버킷의 기준 수익률(hurdle)을 제공하는 자리.",
  },
  {
    id: "mh_pfe",
    name: "화이자",
    ticker: "PFE",
    market: "NYSE",
    functionType: "INCOME",
    targetWeight: 10,
    avgCost: 27.8,
    shares: 180,
    currency: "USD",
    price: 26.4,
    changePct: 0.45,
    canslim: 5.2,
    order: 4,
    published: true,
    updatedAt: "2026-07-12T09:00:00+09:00",
    thesis:
      "배당수익률 6%대, 특허 절벽은 이미 가격에 반영. 파이프라인 재평가가 오면 덤이고 오지 않아도 배당으로 버틴다. 인컴 버킷의 주식 파트.",
  },
  {
    id: "mh_reit",
    name: "맥쿼리인프라",
    ticker: "088980",
    market: "KOSPI",
    functionType: "INCOME",
    targetWeight: 12,
    avgCost: 11800,
    shares: 900,
    currency: "KRW",
    price: 12450,
    changePct: 0.32,
    order: 5,
    published: true,
    updatedAt: "2026-06-30T09:00:00+09:00",
    thesis:
      "통행료·요금 기반 인프라 현금흐름은 물가에 연동된다. 금리 하락 국면에서 가격 회복 + 반기 배당의 이중 수익. 원화 인컴의 기본값.",
  },
  {
    id: "mh_kodex",
    name: "KODEX 200",
    ticker: "069500",
    market: "KOSPI",
    functionType: "DEFENSE",
    targetWeight: 20,
    avgCost: 34200,
    shares: 320,
    currency: "KRW",
    price: 36980,
    changePct: -0.41,
    order: 6,
    published: true,
    updatedAt: "2026-07-28T09:00:00+09:00",
    thesis:
      "개별 종목 판단이 틀렸을 때 포트폴리오 전체가 시장을 밑돌지 않게 하는 앵커. 현금 대기자금의 임시 주차 공간 역할도 겸한다.",
  },
  {
    id: "mh_cash",
    name: "달러 MMF·현금",
    market: "CASH",
    functionType: "DEFENSE",
    targetWeight: 10,
    currency: "USD",
    order: 7,
    published: true,
    updatedAt: "2026-07-28T09:00:00+09:00",
    thesis: "리밸런싱 탄약. 목표비중 10% 아래로 내려가면 신규 편입을 멈춘다.",
  },
];

export const rebalances: Rebalance[] = [
  {
    id: "rb_4",
    date: "2026-07-28T00:00:00+09:00",
    memo: "엔비디아 목표비중 16% → 14% 축소, 차익 일부를 달러 MMF로 이동(현금 8% → 10%).",
  },
  {
    id: "rb_3",
    date: "2026-06-30T00:00:00+09:00",
    memo: "맥쿼리인프라 신규 편입(12%). 원화 인컴 비중 확보 목적.",
  },
  {
    id: "rb_2",
    date: "2026-05-19T00:00:00+09:00",
    memo: "화이자 추가 매수로 인컴 버킷 배당수익률 5.4% → 6.1%로 상향.",
  },
  {
    id: "rb_1",
    date: "2026-03-11T00:00:00+09:00",
    memo: "포트폴리오 기능별 재편(성장 32 / 인컴 38 / 방어 30) 기준 확정.",
  },
];

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

/* ─────────────── 콘텐츠(인사이트/분석/공지) ─────────────── */
export const posts: Post[] = [
  {
    id: "p_1",
    slug: "three-bucket-portfolio",
    type: "INSIGHT",
    category: "포트폴리오 전략",
    title: "성장·인컴·방어: 포트폴리오를 세 개의 통으로 나누는 이유",
    excerpt:
      "종목을 잘 고르는 것보다 중요한 건 '이 종목이 내 포트폴리오에서 무슨 일을 하는가'입니다. 기능별 배분이 흔들림을 줄이는 방식.",
    source: "SELF",
    tags: "자산배분,원칙,리밸런싱",
    commentsEnabled: true,
    published: true,
    viewCount: 2841,
    publishedAt: "2026-07-26T10:00:00+09:00",
    commentCount: 12,
    bodyHtml: `<p>포트폴리오가 흔들릴 때 대부분의 사람은 <strong>종목을 바꿉니다</strong>. 하지만 문제는 종목이 아니라 <em>배분</em>인 경우가 훨씬 많습니다.</p>
<h2>1. 기능으로 나눈다</h2>
<p>Woodsman 대표 포트폴리오는 모든 자산을 세 가지 기능 중 하나로 분류합니다.</p>
<ul>
<li><strong>성장(GROWTH)</strong> — 이익 성장률로 수익을 만든다. 변동성을 감수하는 자리.</li>
<li><strong>인컴(INCOME)</strong> — 배당·이자로 현금흐름을 만든다. 하락장에서 심리를 지탱한다.</li>
<li><strong>방어(DEFENSE)</strong> — 지수·현금으로 최악을 막는다. 리밸런싱 탄약을 보관한다.</li>
</ul>
<h2>2. 비중은 시장이 아니라 나에게 맞춘다</h2>
<p>성장 비중은 "얼마나 오를까"가 아니라 "얼마나 버틸 수 있나"로 정합니다. 30% 하락을 감내할 수 없다면 성장 버킷은 30%를 넘지 않아야 합니다.</p>
<blockquote>편입 논리(thesis)를 적을 수 없는 종목은 사지 않는다. 팔 이유를 미리 적어두지 않은 종목은 제때 팔지 못한다.</blockquote>
<h2>3. 분기마다 기능 비중만 되돌린다</h2>
<p>개별 종목 교체는 논리가 깨졌을 때만. 정기 리밸런싱은 <strong>버킷 비중</strong>만 원위치시킵니다. 이 단순한 규칙이 대부분의 과매매를 막아줍니다.</p>`,
  },
  {
    id: "p_2",
    slug: "tsmc-2nm-cycle",
    type: "ANALYSIS",
    category: "종목분석",
    title: "TSMC 2nm 양산, 이번 사이클은 무엇이 다른가",
    excerpt:
      "선단 공정 독점이 가격 결정력으로 이어지는 구간. CANSLIM 8.4점의 근거와 리스크 3가지를 정리했습니다.",
    source: "SELF",
    ticker: "TSM",
    tags: "반도체,파운드리,TSMC",
    commentsEnabled: true,
    published: true,
    viewCount: 1932,
    publishedAt: "2026-07-22T09:30:00+09:00",
    commentCount: 8,
    bodyHtml: `<p>TSMC의 2nm(N2) 양산은 단순한 노드 전환이 아니라 <strong>가격 결정력의 전환점</strong>입니다.</p>
<h2>왜 지금인가</h2>
<p>선단 공정에서 유효 경쟁자가 사실상 사라지면서, 고객사는 물량 확보를 위해 선지급(prepayment)을 감수하고 있습니다. 이는 가동률의 하방을 구조적으로 방어합니다.</p>
<h2>CANSLIM 요약</h2>
<ul>
<li><strong>C(최근 분기 이익)</strong> 9 — 전년 대비 두 자릿수 증가 지속</li>
<li><strong>A(연간 이익)</strong> 8 — 3년 연속 우상향</li>
<li><strong>N(신제품·신고가)</strong> 9 — N2 양산 + 신고가 근접</li>
<li><strong>I(기관 수급)</strong> 8 — 기관 보유 비중 증가</li>
</ul>
<h2>리스크 3가지</h2>
<ul>
<li>지정학 — 대만 해협 이벤트는 가격에 선반영되지 않는다</li>
<li>설비투자 사이클 — 캐펙스 정점 이후 감가상각 부담</li>
<li>고객 집중도 — 상위 2개 고객 매출 비중</li>
</ul>`,
  },
  {
    id: "p_3",
    slug: "tistory-dividend-calendar",
    type: "INSIGHT",
    category: "인컴 투자",
    title: "[티스토리] 배당 캘린더로 현금흐름 설계하기",
    excerpt:
      "월별 배당 입금일을 달력에 깔면 인컴 포트폴리오의 빈 달이 보입니다. 원문은 블로그에서 이어집니다.",
    source: "TISTORY",
    externalUrl: "https://suhdp.tistory.com/entry/dividend-calendar",
    tags: "배당,현금흐름",
    commentsEnabled: true,
    published: true,
    viewCount: 1204,
    publishedAt: "2026-07-15T20:10:00+09:00",
    commentCount: 5,
    bodyHtml: `<p>인컴 포트폴리오를 만들면 대부분 <strong>배당이 몰리는 달</strong>과 <strong>비는 달</strong>이 생깁니다.</p>
<p>월별 입금 일정을 캘린더에 배치하면, 생활비를 충당하기 위해 자산을 팔아야 하는 달이 사라집니다. 종목을 늘리는 게 아니라 <em>일정</em>을 배치하는 문제입니다.</p>
<p>전체 표와 스프레드시트 양식은 원문에서 확인하세요.</p>`,
  },
  {
    id: "p_4",
    slug: "notice-comment-policy",
    type: "NOTICE",
    category: "공지",
    title: "댓글 운영 정책 안내 (승인제·신고 처리 기준)",
    excerpt: "커뮤니티 댓글 정책과 잠금(🔒) 표시의 의미를 안내드립니다.",
    source: "SELF",
    commentsEnabled: false,
    published: true,
    viewCount: 663,
    publishedAt: "2026-07-10T09:00:00+09:00",
    commentCount: 0,
    bodyHtml: `<h2>댓글 정책</h2>
<ul>
<li>로그인한 회원만 댓글을 작성할 수 있습니다.</li>
<li>특정 글은 관리자가 댓글을 잠글 수 있으며, 목록과 상세에 🔒로 표시됩니다.</li>
<li>비속어·광고·특정 종목 매수 권유는 사전 필터 및 신고로 숨김 처리됩니다.</li>
</ul>
<p>이 글은 댓글이 잠겨 있습니다.</p>`,
  },
  {
    id: "p_5",
    slug: "nvidia-earnings-checklist",
    type: "ANALYSIS",
    category: "종목분석",
    title: "엔비디아 실적 전 체크리스트 5가지",
    excerpt: "데이터센터 매출 QoQ, 재고회전, 가이던스 톤 — 실적 전에 미리 정해둘 시나리오.",
    source: "SELF",
    ticker: "NVDA",
    tags: "엔비디아,실적,AI",
    commentsEnabled: true,
    published: true,
    viewCount: 1571,
    publishedAt: "2026-07-08T18:00:00+09:00",
    commentCount: 9,
    bodyHtml: `<p>실적 발표 <strong>전</strong>에 시나리오를 적어두지 않으면, 발표 <strong>후</strong>에는 주가가 시나리오를 만들어 줍니다.</p>
<h2>체크리스트</h2>
<ul>
<li>데이터센터 매출 QoQ 증가율이 두 자릿수를 유지하는가</li>
<li>재고·선주문 잔고 흐름</li>
<li>가이던스의 표현 강도(“강한 수요” vs “견조한 수요”)</li>
<li>총마진 방향성</li>
<li>내 목표비중 대비 현재 비중 — 초과라면 실적과 무관하게 축소</li>
</ul>`,
  },
  {
    id: "p_6",
    slug: "kodex200-as-anchor",
    type: "INSIGHT",
    category: "포트폴리오 전략",
    title: "지수 ETF는 '못 고른 대가'가 아니라 앵커다",
    excerpt: "방어 버킷에 KODEX 200을 두는 이유. 현금과 주식 사이의 완충 지대.",
    source: "SELF",
    ticker: "069500",
    tags: "ETF,방어,자산배분",
    commentsEnabled: true,
    published: true,
    viewCount: 987,
    publishedAt: "2026-06-28T11:20:00+09:00",
    commentCount: 4,
    bodyHtml: `<p>지수 ETF는 개별 종목 선택이 전부 틀렸을 때도 <strong>시장 수익률</strong>을 보장하는 장치입니다.</p>
<p>방어 버킷을 현금 100%로 두면 인플레이션에 녹고, 주식 100%로 두면 방어가 아닙니다. 그 사이에 지수를 둡니다.</p>`,
  },
  {
    id: "p_7",
    slug: "tistory-brazil-bond",
    type: "INSIGHT",
    category: "인컴 투자",
    title: "[티스토리] 브라질 국채, 달러표시로만 사는 이유",
    excerpt: "헤알 변동성을 빼고 표면금리만 취하는 방법. 세금과 만기 구조까지.",
    source: "TISTORY",
    externalUrl: "https://suhdp.tistory.com/entry/brazil-bond-usd",
    tags: "채권,인컴,브라질",
    commentsEnabled: true,
    published: true,
    viewCount: 1420,
    publishedAt: "2026-06-14T08:40:00+09:00",
    commentCount: 7,
    bodyHtml: `<p>브라질 국채의 매력은 표면금리인데, 헤알화 표시로 사면 <strong>환율이 수익률을 통째로 삼킬</strong> 수 있습니다.</p>
<p>달러표시 채권으로 접근하면 통화 변동성을 제거하고 금리만 취할 수 있습니다. 자세한 세금·만기 구조는 원문 참고.</p>`,
  },
  {
    id: "p_8",
    slug: "rebalancing-rules",
    type: "INSIGHT",
    category: "포트폴리오 전략",
    title: "리밸런싱은 달력으로, 매도는 논리로",
    excerpt: "정기 리밸런싱과 논리 훼손 매도를 분리하면 과매매가 사라집니다.",
    source: "SELF",
    tags: "리밸런싱,매도원칙",
    commentsEnabled: true,
    published: true,
    viewCount: 1105,
    publishedAt: "2026-05-30T13:00:00+09:00",
    commentCount: 6,
    bodyHtml: `<p>두 가지 매도를 섞으면 감정이 개입합니다.</p>
<ul>
<li><strong>정기 리밸런싱</strong> — 분기 1회, 버킷 비중만 되돌린다.</li>
<li><strong>논리 훼손 매도</strong> — thesis가 깨졌을 때, 날짜와 무관하게 즉시.</li>
</ul>`,
  },
  {
    id: "p_9",
    slug: "pfizer-dividend-safety",
    type: "ANALYSIS",
    category: "종목분석",
    title: "화이자 배당은 안전한가 — 커버리지 점검",
    excerpt: "잉여현금흐름 대비 배당 지급률과 특허 만료 스케줄을 함께 봅니다.",
    source: "SELF",
    ticker: "PFE",
    tags: "화이자,배당,헬스케어",
    commentsEnabled: true,
    published: true,
    viewCount: 842,
    publishedAt: "2026-05-18T15:40:00+09:00",
    commentCount: 3,
    bodyHtml: `<p>배당 안전성은 배당수익률이 아니라 <strong>잉여현금흐름 커버리지</strong>로 판단합니다.</p>
<p>특허 만료 스케줄과 파이프라인 승인 일정이 겹치는 구간을 미리 표시해두면, 감액 리스크를 사후가 아니라 사전에 볼 수 있습니다.</p>`,
  },
  {
    id: "p_10",
    slug: "notice-service-open",
    type: "NOTICE",
    category: "공지",
    title: "Woodsman 인사이트 오픈 안내",
    excerpt: "대표 포트폴리오 공개와 커뮤니티 오픈 소식입니다.",
    source: "SELF",
    commentsEnabled: true,
    published: true,
    viewCount: 1310,
    publishedAt: "2026-05-02T09:00:00+09:00",
    commentCount: 2,
    bodyHtml: `<p>대표 포트폴리오와 편입 논리를 공개합니다. 회원가입하시면 개인 포트폴리오 관리 기능을 이용할 수 있습니다.</p>`,
  },
];

/* 작성 중(미발행) 글 — 관리자 화면에서만 노출 */
export const draftPosts: Post[] = [
  {
    id: "p_draft_1",
    slug: "semiconductor-cycle-2027",
    type: "ANALYSIS",
    category: "종목분석",
    title: "(작성중) 2027 반도체 사이클 시나리오",
    excerpt: "",
    source: "SELF",
    commentsEnabled: true,
    published: false,
    viewCount: 0,
    commentCount: 0,
  },
];

export const allPosts = [...posts, ...draftPosts];

export function getPostBySlug(slug: string) {
  return posts.find((p) => p.slug === slug);
}
export function getPostById(id: string) {
  return posts.find((p) => p.id === id);
}

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

/* ─────────────── 사용자 ─────────────── */
export const users: UserRow[] = [
  {
    id: "u_admin",
    email: "admin@woodsman.kr",
    name: "관리자",
    role: "ADMIN",
    createdAt: "2026-05-01T09:00:00+09:00",
    commentCount: 0,
  },
  {
    id: "u_1",
    email: "walker@example.com",
    name: "산책자",
    role: "USER",
    createdAt: "2026-05-12T11:20:00+09:00",
    commentCount: 4,
  },
  {
    id: "u_2",
    email: "longterm@example.com",
    name: "장기투자",
    role: "USER",
    createdAt: "2026-06-03T16:45:00+09:00",
    commentCount: 3,
  },
  {
    id: "u_3",
    email: "semi@example.com",
    name: "반도체러버",
    role: "USER",
    createdAt: "2026-07-01T08:10:00+09:00",
    commentCount: 2,
  },
];

/* ─────────────── 관리자 대시보드 요약 ─────────────── */
export const adminStats = {
  visitorsToday: 1284,
  visitorsDelta: 12.4,
  newComments: 6,
  pendingComments: comments.filter((c) => c.status === "PENDING").length,
  reportedComments: comments.filter((c) => c.reported).length,
  publishedPosts: posts.length,
  draftPosts: draftPosts.length,
  members: users.filter((u) => u.role === "USER").length,
  aiTokensUsed: aiConfig.tokensUsedThisMonth,
  aiTokenCap: aiConfig.globalMonthlyTokenCap,
  /** 최근 7일 방문자 (막대그래프용) */
  weeklyVisitors: [742, 810, 905, 866, 1120, 1043, 1284],
};

/* ─────────────── 파생 계산 ─────────────── */
export function holdingValue(h: ModelHolding) {
  if (h.price != null && h.shares != null) return h.price * h.shares;
  return 0;
}

/** 기능별 목표비중 합계 */
export function functionAllocation() {
  const acc: Record<string, number> = { GROWTH: 0, INCOME: 0, DEFENSE: 0 };
  for (const h of modelHoldings) {
    if (!h.published) continue;
    acc[h.functionType] += h.targetWeight ?? 0;
  }
  return acc;
}

/**
 * Phase 0 목업 데이터.
 * Phase 1에서 Prisma seed / DB 조회로 대체된다. (필드명은 Prisma 스키마와 동일)
 * 주의: 날짜·난수는 모두 고정값 — SSR/CSR hydration 불일치를 막는다.
 */
import type { AccountSnapshot, JournalEntry } from "./types";

/* 사이트 설정 목업은 삭제했다(2026-08-07).
   화면이 이걸 읽는 동안 `/admin/comments`의 토글 다섯 개가 **켜도 저장되지 않았다** —
   관리자가 "커뮤니티를 열었다"고 잘못 믿는 것이 이 버그의 실제 값이었다.
   지금은 `lib/site-settings.ts`의 `getSiteFlags()`가 D1을 읽는다. ⚠ 되살리지 말 것. */

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

/* 댓글 목업은 삭제했다(2026-08-07).
   화면이 이걸 읽는 동안 /admin/comments의 승인·숨김·삭제 버튼이 아무 데도
   연결돼 있지 않았다 — 숨겼다고 믿은 댓글이 계속 노출됐다.
   지금은 `features/comments/repository.ts`가 D1을 읽는다. ⚠ 되살리지 말 것. */

/* 종목 목업은 삭제했다(2026-08-15).
   `stocks`·`getStock`·`featuredStocks`·`mockSeries` 네 개가 공개 화면 다섯 곳
   (홈 '주목 종목' · /stocks · /stocks/[ticker] · /insights/[slug] · sitemap)에서
   **지어낸 시세**(AAPL 232.6 · TSM 191.2 같은)와 결정적 파형으로 만든 가짜 차트를
   실제 데이터처럼 보여주고 있었다. 숫자를 공개해 신뢰를 얻는 사이트에서 가장 크게
   깨지는 지점이다(운영지침 §5).

   지금 종목 데이터는 `features/reports/repository`의 **발행된 보고서**에서 온다.
   보고서가 없으면 화면은 비어 있다 — 그게 사실이다.
   ⚠ 되살리지 말 것. `mock.test.ts`가 막는다. */

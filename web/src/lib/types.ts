/**
 * Phase 0(화면설계) 목업용 도메인 타입.
 * Prisma 스키마(개발요구서 5장)와 동일한 필드명을 사용해 Phase 1에서 그대로 대체 가능하게 한다.
 */

export type Role = "ADMIN" | "USER";

/** 대표 포트폴리오 기능 분류 */
export type FunctionType = "GROWTH" | "INCOME" | "DEFENSE";

export type PostType = "INSIGHT" | "ANALYSIS" | "NOTICE";
export type PostSource = "SELF" | "TISTORY";
export type CommentStatus = "VISIBLE" | "PENDING" | "HIDDEN";

export interface ModelHolding {
  id: string;
  name: string;
  ticker?: string;
  market?: string;
  functionType: FunctionType;
  targetWeight?: number;
  avgCost?: number;
  shares?: number;
  currency?: "KRW" | "USD";
  /** 목업 전용: 현재가·등락률 (Phase 7에서 서버 시세 프록시로 대체) */
  price?: number;
  changePct?: number;
  thesis?: string;
  canslim?: number;
  blogUrl?: string;
  order: number;
  published: boolean;
  updatedAt: string;
}

export interface Rebalance {
  id: string;
  date: string;
  memo: string;
}

export interface Post {
  id: string;
  slug: string;
  type: PostType;
  category?: string;
  title: string;
  excerpt?: string;
  bodyHtml?: string;
  thumbnailUrl?: string;
  source: PostSource;
  externalUrl?: string;
  ticker?: string;
  tags?: string;
  commentsEnabled: boolean;
  published: boolean;
  viewCount: number;
  publishedAt?: string;
  /** 목업 전용 파생값 */
  commentCount: number;
}

export interface Comment {
  id: string;
  postId: string;
  postTitle?: string;
  userId?: string;
  authorName?: string;
  body: string;
  status: CommentStatus;
  reported: boolean;
  createdAt: string;
}

export interface SiteConfig {
  /** 공개 회원가입 허용 — 지금은 false (src/lib/site-policy.ts) */
  signupEnabled: boolean;
  /** 게시판·커뮤니티 노출 — 지금은 false */
  communityEnabled: boolean;
  commentsGloballyEnabled: boolean;
  requireLoginToComment: boolean;
  moderationOn: boolean;
  bannedWords?: string;
  heroTitle?: string;
  heroSubtitle?: string;
}

/** 투자일지 기록 유형 */
export type JournalAction = "BUY" | "SELL" | "REBALANCE" | "NOTE";

export interface JournalEntry {
  id: string;
  date: string;
  action: JournalAction;
  title: string;
  body: string;
  ticker?: string;
  name?: string;
  shares?: number;
  price?: number;
  currency?: "KRW" | "USD";
  /** 연결 인사이트 글 slug */
  postSlug?: string;
  published: boolean;
}

/** 계좌 스냅샷 — 원금 대비 평가액 곡선의 한 점 */
export interface AccountSnapshot {
  date: string;
  /** 납입원금 누계 */
  principal: number;
  /** 총 평가액 */
  value: number;
  /** 누적 배당·이자 */
  income: number;
  memo?: string;
}

export interface AiProvider {
  id: string;
  name: string;
  kind: "ANTHROPIC" | "OPENAI_COMPAT";
  baseUrl?: string;
  model: string;
  apiKeyEnv: string;
  free: boolean;
  enabled: boolean;
  priority: number;
  monthlyTokenCap?: number;
  tokensUsedThisMonth: number;
  /** 목업 전용: env 키 감지 결과 */
  connected: boolean;
}

export interface AiConfig {
  allowedRole: Role;
  cacheTtlHours: number;
  globalMonthlyTokenCap: number;
  tokensUsedThisMonth: number;
}

export interface Feed {
  id: string;
  name: string;
  url: string;
  active: boolean;
  lastFetchedAt?: string;
  itemCount: number;
}

export interface UserRow {
  id: string;
  email: string;
  name?: string;
  role: Role;
  createdAt: string;
  commentCount: number;
}

export interface StockSummary {
  ticker: string;
  name: string;
  market: string;
  industry: string;
  price: number;
  changePct: number;
  currency: "KRW" | "USD";
  canslim?: number;
  /** 미니 스파크라인용 종가 배열 */
  spark: number[];
}

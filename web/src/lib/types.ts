/**
 * Phase 0(화면설계) 목업용 도메인 타입.
 * Prisma 스키마(개발요구서 5장)와 동일한 필드명을 사용해 Phase 1에서 그대로 대체 가능하게 한다.
 */

export type Role = "ADMIN" | "USER";

/**
 * ⚠ **기본** 버킷 키. 관리자가 분류를 추가할 수 있으므로 이것이 전부가 아니다.
 *    보유 종목·보고서의 분류 값은 `string`이고, 목록은 `PortfolioBucket`이 갖는다
 *    (`lib/bucket-target.ts`). 이 유니온은 **기본 셋을 가리킬 때만** 쓴다 —
 *    AI 프롬프트 용어(`lib/ai/labels.ts`)와 시드가 그렇다.
 */
export type FunctionType = "GROWTH" | "INCOME" | "DEFENSE";

export type PostType = "INSIGHT" | "ANALYSIS" | "NOTICE";
export type PostSource = "SELF" | "TISTORY";

/**
 * 글이 쌓이는 화면 묶음.
 * 발행할 때마다 그 섹션 프레임에 한 편씩 더해진다(홈·거시·포트폴리오·투자일지·인사이트).
 */
export type PostSection = "HOME" | "MACRO" | "PORTFOLIO" | "JOURNAL" | "INSIGHT";

/** 본문을 쓴 형식. 편집기는 이 값에 따라 다른 모드로 연다. */
export type PostFormat = "MARKDOWN" | "HTML";
export type CommentStatus = "VISIBLE" | "PENDING" | "HIDDEN";

export interface ModelHolding {
  id: string;
  name: string;
  ticker?: string;
  market?: string;
  /**
   * 버킷 키(`PortfolioBucket.key`).
   * ⚠ **고정 유니온이 아니다.** 2026-08-17부터 관리자가 분류를 추가·삭제한다.
   *    `FunctionType`으로 좁히면 커스텀 분류가 타입 거짓말이 되고, 화면이
   *    `Record<FunctionType, …>`으로 색·이름을 찾다가 `undefined`를 그린다.
   */
  functionType: string;
  targetWeight?: number;
  avgCost?: number;
  shares?: number;
  currency?: "KRW" | "USD";
  /**
   * 현재가 — ⚠ **관리자가 손으로 넣는 값**이다(실시세 연동은 P6/P7).
   * 화면에 낼 때는 `priceAsOf`를 반드시 같이 보여준다(`lib/manual-price.ts`).
   */
  price?: number;
  /** 위 `price`를 적은 기준일 (YYYY-MM-DD) */
  priceAsOf?: string;
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
  /** 작성 원본(마크다운 또는 HTML) — 편집기가 여는 값 */
  body?: string;
  format: PostFormat;
  /** 화면에 나가는 HTML. ⚠ `body`에서 변환·정화한 결과 캐시다 */
  bodyHtml?: string;
  section: PostSection;
  thumbnailUrl?: string;
  source: PostSource;
  externalUrl?: string;
  ticker?: string;
  tags?: string;
  commentsEnabled: boolean;
  published: boolean;
  viewCount: number;
  publishedAt?: string;
  updatedAt?: string;
  /** 파생값 */
  commentCount: number;
}

export interface Comment {
  id: string;
  postId: string;
  postTitle?: string;
  /** 관리자 목록에서 원문으로 건너뛰기 위한 값 */
  postSlug?: string;
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

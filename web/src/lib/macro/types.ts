/**
 * 거시 지표의 타입 — 정의만 둔다(값은 `sectors/*.ts`).
 *
 * 타입을 따로 뺀 이유: 섹터 파일과 레지스트리가 서로를 import하면 순환이 생긴다.
 * 볼트의 인수인계 사양서(`05_Methodology/섹터 분석 파이프라인`)의 데이터 계약을 옮겨 온
 * 것이고, 이름도 되도록 그쪽을 따랐다(같은 걸 다르게 부르면 대조가 안 된다).
 */

export type MacroGroupKey =
  | "rates"
  | "fx"
  | "commodity"
  | "inflation"
  | "jobs"
  | "consumer"
  | "production"
  | "housing"
  | "semi";

export type MacroGroup = {
  key: MacroGroupKey;
  /** 화면 제목 */
  name: string;
  emoji: string;
  /** 이 묶음이 답하는 질문 — 카드 제목 밑에 그대로 쓴다 */
  question: string;
  /** 초보자용 한 문단. 검색 결과에 노출되는 설명이기도 하다(SEO). */
  intro: string;
  order: number;
};

/** FRED·Yahoo는 서버가 직접 가져온다. MANUAL은 공식 API가 없어 관리자가 손으로 넣는다. */
export type MacroSource = "FRED" | "YAHOO" | "MANUAL";

/**
 * 원본 시계열을 화면 값으로 바꾸는 방법.
 * - `level`    원값 그대로
 * - `yoy`      전년 동월 대비 %
 * - `mom`      전월 대비 %
 * - `momdiff`  전월 대비 증감(원단위) — 고용자 수처럼 "몇 명 늘었나"
 * - `levelK`   원값을 1,000으로 나눠 천 단위로
 */
export type MacroTransform = "level" | "yoy" | "mom" | "momdiff" | "levelK";

/** 침체 시그널 판정 규칙. `op`는 "위험한 방향". */
export type MacroSignalRule = {
  op: "lt" | "gt";
  /** 주의 임계값 */
  warn: number;
  /** 경고 임계값 */
  alert: number;
  /** 사람이 읽는 규칙 문장 */
  rule: string;
};

export type MacroIndicator = {
  /** ⚠ DB 키. 이름이 바뀌어도 이 값은 바꾸지 않는다(시계열이 통째로 끊긴다). */
  key: string;
  name: string;
  group: MacroGroupKey;
  source: MacroSource;
  /** FRED 시리즈 ID 또는 Yahoo 심볼. MANUAL이면 없다. */
  sourceId?: string;
  transform: MacroTransform;
  /** 값 뒤에 붙는 단위 */
  unit: string;
  decimals: number;
  /** 원 출처 링크 — 숫자를 직접 확인할 수 있게 항상 건다 */
  url: string;
  /** 출처 표기 문구 */
  sourceLabel: string;
  /** 이게 뭔가 */
  what: string;
  /** 왜 보나 */
  why: string;
  /** 어떻게 읽나 — ⚠ 읽는 법까지만. 매매 판단으로 넘어가지 않는다. */
  read: string;
  /** 침체 시그널이면 판정 규칙 */
  signal?: MacroSignalRule;
  /** 홈 요약에 올리는 대표 지표 */
  headline?: boolean;
  order: number;
};

/**
 * 섹터 = 묶음 정의 + 그 안의 지표.
 *
 * ⚠ **섹터 하나는 파일 하나다.** 지표를 늘릴 때 여러 파일을 헤집지 않게 한다
 *    (볼트 사양서 1-1의 규칙을 그대로 따른다 — 흩어져 있으면 하나 추가에 세 곳을 고치게 된다).
 */
export type MacroSector = {
  group: MacroGroup;
  indicators: MacroIndicator[];
};

export const FRED_URL = (id: string) => `https://fred.stlouisfed.org/series/${id}`;

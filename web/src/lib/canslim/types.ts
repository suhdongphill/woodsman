/**
 * CANSLIM 채점의 타입 — 정의만 둔다(값은 `catalog.ts`, 채점 결과는 DB).
 *
 * ⚠ CANSLIM은 **보고서 전체가 아니라 그 안의 한 축**이다.
 *    보고서 구조는 `docs/종목분석_보고서_설계서_v1.md`가 원본이고, 여기서는
 *    그 설계서 §3의 "③ 기업 분석(A축 검산)"·"⑤ 수급(I축 환산)"이 쓰는 눈금만 정의한다.
 */

export type CanslimKey = "C" | "A" | "N" | "S" | "L" | "I" | "M";

export type CanslimItemDef = {
  key: CanslimKey;
  name: string;
  /** 종합 100점에서 차지하는 비중. ⚠ 합이 100이어야 한다. */
  weight: number;
  /** 이 항목이 답하는 질문 — 화면에 그대로 쓴다 */
  question: string;
  /** 사람이 읽는 채점 구간 */
  rubric: string;
  /** ⚠ 이 항목에서 가장 자주 틀리는 지점(사이클 예외 등) */
  caveat: string;
  order: number;
};

/**
 * 데이터 태그 — 정직성 원칙의 시각화(`references/report-format.md`).
 * ⚠ `na`는 **0점이 아니라 분모에서 빠진다.**
 */
export type DataTagKey = "confirmed" | "needsCheck" | "na";

export type DataTagDef = {
  key: DataTagKey;
  label: string;
  note: string;
  tone: "green" | "amber" | "muted";
};

/** 등급 밴드 — `composite10` 기준. ⚠ `action`은 국면 설명이지 매매 지시가 아니다. */
export type CanslimBand = {
  /** 이 값 이상이면 이 등급 */
  min: number;
  grade: string;
  action: string;
};

/** 관리자가 기록한 한 축의 채점. */
export type CanslimReading = {
  key: CanslimKey;
  /** 0~10. ⚠ undefined = N/A(데이터 부재). 0점과 다르다. */
  points?: number;
  tag: DataTagKey;
  /** 근거 한 줄 — 숫자가 들어가야 한다 */
  evidence?: string;
  /** 출처 표기(예: "DART 2026.03.22 감사보고서") */
  source?: string;
  sourceUrl?: string;
  /** 기준일 */
  asOf?: string;
};

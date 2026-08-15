/**
 * 종목분석 보고서의 타입 — 정의만 둔다(값은 `catalog.ts`, 내용은 D1).
 *
 * 원본은 `docs/종목분석_보고서_설계서_v1.md`다. 그 문서가 바뀌면 여기도 바뀐다.
 */
import type { DataTagKey } from "../canslim/types";

/**
 * 섹션 키. ⚠ **DB의 `sectionKey`로 그대로 쓰인다** — 한 번 발행한 뒤에는 이름을 바꾸지 않는다
 * (바꾸면 저장된 보고서의 섹션이 통째로 사라진다).
 */
export type ReportSectionKey =
  | "header"
  | "summary"
  | "marketPosition"
  | "industry"
  | "company"
  | "moat"
  | "competition"
  | "valuation"
  | "flow"
  | "scenario"
  | "sizing"
  | "checklist"
  | "footer";

/** 정직성 규율 7가지(설계서 §4). */
export type HonestyRuleKey = "R1" | "R2" | "R3" | "R4" | "R5" | "R6" | "R7";

export type HonestyRuleDef = {
  key: HonestyRuleKey;
  title: string;
  /** 왜 이 규율이 있나 — 화면에 그대로 쓴다 */
  why: string;
  /** 어디가 강제하나 */
  enforcedBy: string;
};

export type ReportSectionDef = {
  key: ReportSectionKey;
  /** 설계서의 번호(`00`…`12`). 문서와 화면의 순서를 맞추는 용도다. */
  no: string;
  name: string;
  /** ⚠ 필수 섹션이 비면 발행할 수 없다. */
  required: boolean;
  /** 이 섹션이 답하는 질문 */
  question: string;
  /** 이 섹션이 담아야 하는 장치(원본 3건에서 뽑은 것) */
  devices: string[];
  /**
   * 수치를 싣는 섹션인가.
   * ⚠ `true`면 데이터 태그가 **필수**다(R5) — 확정과 추정을 문장에서 구분해야 한다.
   */
  numeric: boolean;
  /** 이 섹션에 직접 걸리는 규율 */
  rules: HonestyRuleKey[];
  order: number;
};

/** 한 섹션의 내용. */
export type ReportBlock = {
  sectionKey: ReportSectionKey;
  /** 마크다운 원본. ⚠ `bodyHtml`에 직접 쓰지 않는다(변환·정화는 단일 경로). */
  body: string;
  /** ⚠ 수치 섹션은 필수(R5). 태그 없는 수치는 저장하지 않는다. */
  tag?: DataTagKey;
  source?: string;
  sourceUrl?: string;
  /** 기준일 (YYYY-MM-DD) */
  asOf?: string;
  /** ⚠ 비어 있는 칸에 붙이는 **조회처**(R2). 추정치로 채우는 대신 어디서 구하는지 적는다. */
  lookupHint?: string;
};

/** §11 미확정 체크리스트 한 줄 — 그대로 다음 갱신의 작업 목록이 된다. */
export type ChecklistItem = {
  item: string;
  source: string;
  impact: string;
};

/**
 * ⚠ 제3자(증권사) 목표주가. **우리가 산출한 값이 아니다**(설계서 §8-①).
 * 출처·집계처·기준일이 없으면 우리 의견처럼 읽히므로 필수다(R4).
 */
export type ConsensusTarget = {
  value: number;
  currency: string;
  /** 집계처 (예: "18개사 컨센서스 · Investing.com 집계") */
  source: string;
  asOf: string;
  sourceUrl?: string;
};

export type ReportStatus = "DRAFT" | "PUBLISHED";

/** 시장. ⚠ 한 코드로 두 시장을 처리하지 않는다(설계서 §5-2). */
export type StockMarket = "US" | "KR";

export type ReportDraft = {
  /** ⚠ **문자열로만** 다룬다. 숫자로 파싱하면 `005930` → `5930`이 된다. */
  ticker: string;
  name: string;
  market: StockMarket;
  industry?: string;
  status: ReportStatus;
  /** 한 줄 논지 — 헤더와 목록에 쓰인다 */
  headline: string;
  /** 구조 판정(중장기). ⚠ 철회 조건과 짝이다(R3). */
  verdictStructural?: string;
  /** 단기 판정. ⚠ 시계를 분리해 적는다 — 두 판정이 모순돼 보이지 않게 */
  verdictShort?: string;
  /** ⚠ 판정의 공식 철회 조건(R3). 반증 조건 없는 판정은 판정이 아니라 소감이다. */
  revokeIf?: string;
  /** ⚠ 다음 판단 시점(R7). YYYY-MM-DD */
  nextCheckAt?: string;
  /** ⚠ 밸류에이션 방법론의 한계(R6). 신뢰는 결론이 아니라 한계 고백에서 나온다. */
  valuationLimitation?: string;
  consensusTarget?: ConsensusTarget;
  blocks: ReportBlock[];
  checklist: ChecklistItem[];
};

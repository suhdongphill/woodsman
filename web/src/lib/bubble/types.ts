/**
 * 버블 모니터의 타입 — 정의만. (값은 `catalog.ts`, 실제 채점 결과는 DB)
 */

/** 0·1·2 세 칸. ⚠ 소수점을 두지 않는다 — 정성 지표에 없는 정밀도가 생긴다. */
export type BubblePoints = 0 | 1 | 2;

/** 숫자 지표를 자동 채점할 때 쓰는 눈금. `op`는 "위험한 방향". */
export type BubbleScale = {
  op: "lt" | "gt";
  /** 1점 경계 */
  t1: number;
  /** 2점 경계 */
  t2: number;
};

export type BubbleIndicator = {
  key: string;
  label: string;
  /** 사람이 읽는 채점 규칙 ("<20% · 20~40% · >40%") */
  rule: string;
  scale?: BubbleScale;
  /** 어디서 얻는 값인지 */
  source?: string;
};

export type BubbleLayer = {
  id: string;
  name: string;
  /** 총점에서의 비중 */
  weight: number;
  /** 이 레이어가 무엇을 잡는지 */
  note: string;
  indicators: BubbleIndicator[];
};

export type ScoreBand = {
  /** 이 값 이하면 이 국면 */
  max: number;
  regime: string;
  /** ⚠ 국면 설명이지 매매 지시가 아니다 */
  stance: string;
};

export type BubbleTriggerDef = {
  key: string;
  text: string;
};

/** 관리자가 기록한 한 지표의 판정. */
export type BubbleReading = {
  indicatorKey: string;
  points: BubblePoints;
  /** 근거가 된 숫자·문장 (예: "5사 합산 TTM +82% YoY") */
  value?: string;
  /** 기준일 */
  asOf?: string;
  note?: string;
};

/** 하드 트리거의 현재 상태. */
export type BubbleTriggerState = {
  key: string;
  fired: boolean;
  /** far | near — 얼마나 가까운가 */
  proximity: "far" | "near";
  /** 지금 상황 한 줄 */
  now?: string;
  asOf?: string;
};

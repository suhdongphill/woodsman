/**
 * GCRM v2 — 채널 (명세 §2-10 · B-9).
 *
 * ## 이 파일이 막는 것
 * 위험회피 국면에서 SOX · VIX · HY OAS · 실질금리는 상관계수 0.7~0.9로 **함께 움직인다.**
 * 이 넷을 「4개 시장의 확인」으로 세면 하나의 요인을 네 번 센 것이고,
 * **확신만 커지고 정보는 늘지 않는다.** 이런 대시보드의 전형적인 실패 모드다.
 *
 * 그래서 확인(confirmation)은 **서로 다른 채널** 기준으로 센다.
 * ⚠ 같은 채널 안에서 지표가 몇 개 움직이든 **1표**다.
 * ⚠ VIX는 `PRICE`다. 주식과 주식 변동성은 별개 채널이 아니다.
 */
import type { ChannelCode } from "./indicators";

export type GcrmChannel = {
  code: ChannelCode;
  nameKo: string;
  /** 이 채널이 답하는 질문 — 화면 배지의 설명으로 그대로 쓴다. */
  question: string;
};

export const GCRM_CHANNELS: GcrmChannel[] = [
  { code: "PRICE", nameKo: "주식·변동성", question: "위험자산 가격이 무엇을 말하는가" },
  { code: "CREDIT", nameKo: "신용", question: "빌려주는 쪽이 값을 올려 받고 있는가" },
  { code: "FUNDING", nameKo: "자금시장", question: "하루짜리 돈이 제값에 도는가" },
  { code: "RATES", nameKo: "국채·실질금리", question: "무위험 금리와 기간 프리미엄이 어디에 있는가" },
  { code: "FX", nameKo: "통화", question: "달러가 어느 쪽으로 당기고 있는가" },
  { code: "COMMODITY", nameKo: "원자재", question: "실물 쪽에서 오는 충격이 있는가" },
];

export const CHANNEL_CODES = GCRM_CHANNELS.map((c) => c.code);

/**
 * 확인 규칙 (§2-10 · §2-11).
 *
 * `PRICE + CREDIT + FUNDING` 조합에 가중을 주는 이유: v1 §9이 정성적 권고로만 두었던 것을
 * 계수로 고정했다. 가격만 빠지는 것과 **가격·신용·자금이 함께** 빠지는 것은 다른 사건이다.
 */
export const CONFIRMATION = {
  /** 승격에 필요한 서로 다른 채널 수. */
  minChannels: 3,
  /** 이 조합이 모두 확인되면 확인 수에 곱한다. */
  weightedCombo: ["PRICE", "CREDIT", "FUNDING"] as ChannelCode[],
  comboMultiplier: 1.25,
} as const;

/**
 * 채널 폭 — 신뢰도(§2-7)의 `channel_breadth`가 쓴다.
 * ⚠ 분모가 6이 아니라 4인 것은 명세 그대로다. 채널 넷이면 이미 「넓다」로 본다.
 */
export const CHANNEL_BREADTH_DENOMINATOR = 4;

/** 서로 다른 채널 수를 센다. ⚠ 같은 채널의 중복은 저절로 사라진다(Set). */
export function countChannels(channels: ChannelCode[]): number {
  return new Set(channels).size;
}

/** 가중을 반영한 확인 수. 조합이 모두 있으면 1.25배. */
export function weightedConfirmation(channels: ChannelCode[]): number {
  const set = new Set(channels);
  const n = set.size;
  const hasCombo = CONFIRMATION.weightedCombo.every((c) => set.has(c));
  return hasCombo ? n * CONFIRMATION.comboMultiplier : n;
}

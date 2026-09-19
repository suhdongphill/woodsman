/**
 * GCRM v2 — 신호 승격과 급성 경보 (명세 §2-11 · §2-12).
 *
 * ## 이 파일이 지키는 원칙
 * ⚠ **파도는 레짐을 바꾸지 않는다.** 파도가 먼저 움직이고, 바람이 3주 따라오고,
 * 구조 지표가 확인해 줄 때에만 조류가 옮겨 간다. 파도만 보고 바꾸면 매주 바뀌고,
 * 매주 바뀌는 판정은 판정이 아니다.
 *
 * 이것은 문장이 아니라 **함수 서명**으로 강제된다 —
 * `evaluate_regime_transition(tide, wind, signals, prev, cfg)`에 `wave`가 없다(§2-11 · P6).
 *
 * ## 승격은 인과가 아니라 시간 창 전파다 (§A-2)
 * 파도가 바람을 「일으킨」 것이 아니다. 같은 HY OAS를 5일 창으로 보면 파도, 13주 창으로 보면
 * 바람이다. 승격이란 **짧은 창의 부호가 긴 창에서도 같아졌다**는 관찰이고, 그래서 계산 가능하다.
 */
import type { ChannelCode } from "./indicators";

/** 성숙도 5단계 (§2-11). */
export const STAGES = [
  { stage: 0, code: "NOISE", nameKo: "잡음" },
  { stage: 1, code: "WAVE_ALERT", nameKo: "파도 경보" },
  { stage: 2, code: "WIND_CONFIRMATION", nameKo: "바람 확인" },
  { stage: 3, code: "TIDE_MIGRATION", nameKo: "조류 이동" },
  { stage: 4, code: "REGIME_CONFIRMED", nameKo: "레짐 확정" },
] as const;

export type StageCode = (typeof STAGES)[number]["code"];

/** 파도 경보 → 바람 확인. */
export const WAVE_TO_WIND = {
  /** 5영업일 중 3일 이상 같은 방향 */
  windowDays: 5,
  minDays: 3,
  minChannels: 3,
} as const;

/** 바람 확인 → 조류 이동. */
export const WIND_TO_TIDE = {
  minWeeks: 3,
  minChannels: 3,
  /**
   * ⚠ 구조·실물 지표 **1개 이상**이 같은 방향이어야 한다.
   * 금융 가격만으로는 조류가 옮겨 갔다고 말하지 않는다 — 가격은 되돌아온다.
   */
  minStructuralConfirmations: 1,
  structuralIndicators: [
    "prod_yoy",
    "corp_profits_yoy",
    "output_per_worker_yoy",
    "pnfi_yoy",
    "delinquency_ci",
  ],
} as const;

/**
 * 급성 경보 (§2-12).
 *
 * ⚠ **백분위가 아니라 원시값 임계**로 판정한다. 백분위는 상한·하한이 0과 100이라
 * 한 지표가 기둥을 지배하는 일이 구조적으로 불가능한 대신, **극단의 강도를 잃는다.**
 * VIX 41과 VIX 78은 백분위로는 둘 다 99번째다. 그 차이를 잡는 자리가 여기다.
 *
 * ⚠ 급성 경보가 켜져도 `REGIME_CHANGE`는 **항상 False**다. 배너만 띄우고 레짐 코드는 건드리지 않는다.
 * 승격 경로와는 독립이라 **둘 다 동시에 켜질 수 있다.**
 */
export const ACUTE = {
  minChannels: 3,
  /** 24시간 뒤 자동 해제. 조건이 유지되면 갱신된다. */
  autoClearHours: 24,
  /** ⚠ 무슨 일이 있어도 레짐을 바꾸지 않는다. */
  neverChangesRegime: true,
  thresholds: [
    {
      indicator: "vix",
      op: "gte" as const,
      value: 35,
      unit: "지수",
      channel: "PRICE" as ChannelCode,
      note: "원시값이다. 백분위로는 2018년과 2020년이 같아 보인다",
    },
    {
      indicator: "hy_spread",
      op: "gte" as const,
      value: 1.0,
      unit: "%p (5일 변화)",
      channel: "CREDIT" as ChannelCode,
      changeDays: 5,
      note: "5영업일 동안 +100bp. ⚠ 수준이 아니라 변화다",
    },
    {
      indicator: "sofr_iorb",
      op: "gte" as const,
      value: 0.15,
      unit: "%p",
      channel: "FUNDING" as ChannelCode,
      note: "+15bp. 하루짜리 돈이 제값을 넘어섰다는 뜻이다",
    },
    {
      indicator: "spx_etf",
      op: "lte" as const,
      value: -4.0,
      unit: "% (1일 변화)",
      channel: "PRICE" as ChannelCode,
      changeDays: 1,
      note: "⚠ PRICE 채널이다 — VIX와 함께 켜져도 채널 수는 1이다",
    },
    {
      indicator: "ust10y_rvol",
      op: "gte" as const,
      value: 12,
      unit: "bp",
      channel: "RATES" as ChannelCode,
      note: "MOVE 대용. 국채 변동성이 이만큼이면 담보 가치가 흔들린다",
    },
  ],
} as const;

/**
 * ⚠ RTE(레짐 전이 증거)에서 파도를 뺀 뒤 재정규화하는 비율 (§2-14).
 * v1의 `0.20 × Wave` 항을 대체한다. 원칙(§8·§26)과 산식이 이제 일치한다.
 */
export const RTS_SLOW = {
  tide: 0.2 / 0.65,
  wind: 0.45 / 0.65,
} as const;

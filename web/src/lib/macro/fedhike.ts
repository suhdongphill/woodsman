/**
 * 연준 정책금리 방향 확률 — 순수 계산.
 *
 * 볼트의 `_scripts/fed-hike-prob.py`를 그대로 옮긴 것이다(같은 상수·같은 순서).
 * **한 사건에 두 숫자가 나오면 안 되기 때문에** 식을 다시 짜지 않고 포팅했다 —
 * 볼트 대시보드와 이 사이트가 다른 확률을 말하면 둘 다 못 믿게 된다.
 *
 * ## 어디서 온 식인가
 * 1. **Taylor(1993) 준칙** — 처방금리 `i* = r* + π + 0.5(π−π*) + 0.5·산출갭`.
 *    산출갭은 오쿤 법칙으로 실업률갭에서 근사한다(`gap ≈ −2(u − u*)`).
 * 2. **Clarida–Galí–Gertler(2000, QJE)** — 연준은 급히 움직이지 않고(smoothing)
 *    실현 물가가 아니라 **기대 물가**에 반응한다. 그래서 기대인플레(BEI)·비용압력
 *    (PPI·유가)을 매파 쪽으로, 성장·심리 약화를 비둘기 쪽으로 보정한다.
 * 3. **이산선택 매핑** — 조정된 압력지수를 로지스틱으로 인상/동결/인하 확률로 편다.
 *
 * ## ⚠ 이 모델이 아닌 것
 * - **시장 내재확률이 아니다.** CME FedWatch·연방기금 선물 역산과는 다른 숫자다.
 *   볼트 스크립트는 선물(ZQ)까지 같이 뽑지만, 여기서는 **받아 오는 자료가 없으므로
 *   내지 않는다**(없는 값을 지어내지 않는다는 규칙).
 * - **회귀로 적합한 모델이 아니다.** 계수는 문헌 표준값으로 **보정(calibrated)**한 것이다.
 *   방향·상대비교용이고, 확률의 절대 수준을 그대로 믿을 것이 아니다.
 * - **매매 신호가 아니다.** 화면 문구도 그 선을 지킨다(`lib/macro/signal.ts`와 같은 규범).
 */

/** 중립 실질금리 r* — 현행 추정 약 0.5% */
const R_STAR = 0.5;
/** 연준 물가 목표 */
const PI_TARGET = 2.0;
/** 자연실업률 근사 */
const U_STAR = 4.2;
/**
 * 로지스틱 보정 계수.
 * `P(압력지수 0) ≈ 10%`, `P(압력지수 +1%p) ≈ 35%`가 되도록 잡은 값이다.
 */
const A0 = -2.197;
const B = 1.578;

/** 편향을 '중립'이 아니라고 부르는 경계(%p) */
const BIAS_THRESHOLD = 0.3;

export type FedHikeInput = {
  /** Core PCE 전년비(%) — 연준이 보는 물가. ⚠ 없으면 계산하지 않는다 */
  corePce?: number;
  /** 미국 기준금리(%) */
  fedFunds?: number;
  /** 실업률(%) */
  unrate?: number;
  /** ISM 제조업 PMI — 성장 보정(선택) */
  ism?: number;
  /** 미시간 소비심리 — 심리 보정(선택) */
  umcsent?: number;
  /** 기대인플레 5Y(%) — 매파 보정(선택) */
  breakeven5y?: number;
  /** PPI 전년비(%) — 비용압력 보정(선택) */
  ppiYoy?: number;
  /** WTI 유가($) — 비용압력 보정(선택) */
  wti?: number;
};

export type FedHikeBias = "hawkish" | "neutral" | "dovish";

export type FedHikeResult = {
  /** Taylor 처방금리(%) */
  prescribedRate: number;
  /** 오쿤 근사 산출갭(%p) */
  outputGap: number;
  /** 처방갭 = 처방금리 − 현 기준금리(%p). +면 정책이 처방보다 완화적 → 인상 압력 */
  gap: number;
  /** 보정 후 압력지수(%p) */
  adjustedGap: number;
  /** 보정 내역 — 왜 그렇게 조정됐는지 화면이 그대로 보여줄 수 있게 */
  adjustments: {
    /** 비용압력(매파, 더함) */
    costPush: number;
    /** 성장 약화(비둘기, 뺌) */
    growth: number;
    /** 심리 약화(비둘기, 뺌) */
    sentiment: number;
  };
  /**
   * ⚠ 그 보정을 **실제로 계산했는가.** false면 값이 없어 건너뛴 것이다.
   * 0과 구분하지 않으면 화면의 "−0.00%p"가 "재 보니 영향이 없었다"로 읽힌다.
   */
  adjustmentsApplied: {
    costPush: boolean;
    growth: boolean;
    sentiment: boolean;
  };
  /** 다음 FOMC 기준 확률(합 1) */
  hike: number;
  hold: number;
  cut: number;
  bias: FedHikeBias;
  biasLabel: string;
  /** 보정에 실제로 쓰인 선택 지표 — 빠진 게 있으면 화면이 말한다 */
  usedOptional: string[];
  missingOptional: string[];
};

const logistic = (z: number): number => 1 / (1 + Math.exp(-z));

/** 볼트 스크립트가 보정항을 소수 3자리로 반올림해 쓰므로 그대로 맞춘다. */
const round3 = (n: number): number => Math.round(n * 1000) / 1000;

function isNum(n: number | undefined): n is number {
  return n !== undefined && Number.isFinite(n);
}

export const BIAS_LABEL: Record<FedHikeBias, string> = {
  hawkish: "매파(인상 편향)",
  neutral: "중립",
  dovish: "비둘기(인하 편향)",
};

/**
 * ⚠ 필수 셋(Core PCE·기준금리·실업률) 중 하나라도 없으면 **undefined를 낸다.**
 * 일부만으로 계산해 내보내면 "덜 본 것"이 "본 것"으로 보인다.
 */
export function estimateFedHike(input: FedHikeInput): FedHikeResult | undefined {
  const { corePce: pi, fedFunds: ff, unrate: u } = input;
  if (!isNum(pi) || !isNum(ff) || !isNum(u)) return undefined;

  // ① Taylor 처방금리와 처방갭
  const outputGap = -2.0 * (u - U_STAR);
  const prescribedRate = R_STAR + pi + 0.5 * (pi - PI_TARGET) + 0.5 * outputGap;
  const gap = prescribedRate - ff;

  // ② 보정 — 비용압력은 매파, 성장·심리 약화는 비둘기
  const used: string[] = [];
  const missing: string[] = [];

  let costPush = 0;
  const costPushApplied =
    isNum(input.ppiYoy) || isNum(input.breakeven5y) || isNum(input.wti);
  if (isNum(input.ppiYoy)) {
    used.push("PPI");
    if (input.ppiYoy > 5) costPush += 0.2;
  } else missing.push("PPI");

  if (isNum(input.breakeven5y)) {
    used.push("기대인플레(5Y)");
    if (input.breakeven5y > 2.5) costPush += 0.2;
    else if (input.breakeven5y > 2.2) costPush += 0.1;
  } else missing.push("기대인플레(5Y)");

  if (isNum(input.wti)) {
    used.push("WTI");
    if (input.wti > 90) costPush += 0.1;
  } else missing.push("WTI");

  let growth = 0;
  if (isNum(input.ism)) {
    used.push("ISM 제조업");
    growth = round3(Math.max(0, 50 - input.ism) * 0.1);
  } else missing.push("ISM 제조업");

  let sentiment = 0;
  if (isNum(input.umcsent)) {
    used.push("미시간 소비심리");
    sentiment = round3(Math.min(0.4, Math.max(0, 70 - input.umcsent) * 0.01));
  } else missing.push("미시간 소비심리");

  const adjustedGap = gap + costPush - growth - sentiment;

  // ③ 확률 매핑 — 합이 1이 되게 정규화
  const rawHike = logistic(A0 + B * adjustedGap);
  const rawCut = logistic(A0 - B * adjustedGap);
  const rawHold = Math.max(0, 1 - rawHike - rawCut);
  const sum = rawHike + rawHold + rawCut;

  const bias: FedHikeBias =
    adjustedGap > BIAS_THRESHOLD ? "hawkish" : adjustedGap < -BIAS_THRESHOLD ? "dovish" : "neutral";

  return {
    prescribedRate,
    outputGap,
    gap,
    adjustedGap,
    adjustments: { costPush: round3(costPush), growth, sentiment },
    adjustmentsApplied: {
      costPush: costPushApplied,
      growth: isNum(input.ism),
      sentiment: isNum(input.umcsent),
    },
    hike: rawHike / sum,
    hold: rawHold / sum,
    cut: rawCut / sum,
    bias,
    biasLabel: BIAS_LABEL[bias],
    usedOptional: used,
    missingOptional: missing,
  };
}

/** 화면에 그대로 쓰는 백분율 문자열. */
export function formatProbability(p: number): string {
  return `${(p * 100).toFixed(1)}%`;
}

/**
 * 한 문장 요약 — 검색·AI 인용 대상이 되는 문장이라 **숫자와 기준을 함께** 넣는다
 * (`docs/계획_AI친화_사이트_GEO.md`의 "한 문장 요약" 규칙).
 */
export function fedHikeSentence(r: FedHikeResult, asOf?: string): string {
  const when = asOf ? `${asOf} 기준 ` : "";
  return (
    `${when}Taylor 준칙 처방금리는 ${r.prescribedRate.toFixed(2)}%로 현 기준금리보다 ` +
    `${r.gap >= 0 ? "높고" : "낮고"}(처방갭 ${r.gap >= 0 ? "+" : ""}${r.gap.toFixed(2)}%p), ` +
    `보정 압력지수 ${r.adjustedGap >= 0 ? "+" : ""}${r.adjustedGap.toFixed(2)}%p 기준으로 ` +
    `다음 회의 인상 ${formatProbability(r.hike)} · 동결 ${formatProbability(r.hold)} · ` +
    `인하 ${formatProbability(r.cut)}입니다. 편향은 ${r.biasLabel}입니다.`
  );
}

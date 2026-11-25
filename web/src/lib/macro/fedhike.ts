/**
 * 연준 정책금리 방향 확률 — 순수 계산.
 *
 * 볼트의 `_scripts/fed-hike-prob.py`와 **같은 식·같은 상수**다. 한 사건에 두 숫자가 나오면 둘 다 못 믿는다 —
 * 식을 바꾸면 두 곳을 함께 고친다(테스트 고정값도).
 *
 * ## 어디서 온 식인가 (2026-11-25 교체 · 근거 `docs/연구_테일러준칙_계수근거_2026-11-24.md`)
 * 1. **처방금리** — Taylor(1993)·연준 통화정책보고서(2026-07 Box 4)의 균형 접근:
 *    `R* = r* + π + 0.5(π−2) + (u* − u)` (오쿤 근사 산출갭 −2(u−u*)에 0.5를 곱한 것과 같다).
 * 2. **확률 매핑** — 순서형 로짓을 **과거 FOMC 정례회의 223회(1990~2026, 제로금리 회의 제외)로 추정**했다.
 *    입력은 처방갭 x(= R* − 회의 전 목표 범위 중간값)와 **직전 회의 결정**(인상 +1 · 동결 0 · 인하 −1).
 *    `P(인하) = L(α1 − βx − γ·직전)` · `P(인상) = 1 − L(α2 − βx − γ·직전)` · 동결은 나머지.
 *    직전 결정이 가장 큰 설명력이었다(McFadden 0.056 → 0.268 · 표본 밖 2012+ Brier 0.554 → 0.519).
 *    연준이 한번 움직이면 이어서 움직이는 「관성」이다(Hamilton–Jordà 2002와 같은 결론).
 *
 * ## ⚠ 이 모델이 아닌 것
 * - **시장 내재확률이 아니다.** 연방기금 선물 역산(`fedfutures.ts`)과는 다른 숫자다.
 * - **발언·점도표·시장 기대를 보지 않는다.** 지표와 직전 결정만 본다.
 * - **매매 신호가 아니다.** 화면 문구도 그 선을 지킨다(`lib/macro/signal.ts`와 같은 규범).
 *
 * ## 2026-11-25 전과 달라진 것
 * - 계수는 정해 둔 값(A0 −2.197 · B 1.578, 출처 없음)이었다 → 과거 추정값으로.
 * - 비용압력·성장(ISM)·심리 보정을 **뺐다** — 심리는 과거 검정에서 근거 없음(p 0.45 · 표본 밖 악화), ISM은 검정 불가,
 *   비용압력·기대인플레는 따로 점검 중(연구 문서 「세분 적용 목록」 ②③④).
 * - 현 기준금리는 월평균 실효금리(FEDFUNDS)였다 → **목표 범위 중간값**(추정과 같은 정의).
 */

/**
 * 중립 실질금리 r* = FOMC 경제전망(SEP) 장기 연방기금금리 중앙값 − 장기 물가 2.0.
 * - 2026-09-16 SEP 장기 FFR 중앙값 **3.2** → r* **1.2**(federalreserve.gov/monetarypolicy/fomcprojtabl20260916.htm · 원문 대조).
 * - ⚠ 확률 계수는 HLW r*로 추정했다 — 정의 차이는 연구 문서 세분 과제 ①.
 * - ⏰ SEP가 나올 때마다(3·6·9·12월 FOMC) 갱신 · 볼트 `_scripts/fed-hike-prob.py`도 같이.
 */
export const R_STAR = 1.2;
/** r* 근거가 된 SEP 날짜 — 화면·기록이 「언제 기준의 r*인가」를 말할 수 있게 */
export const R_STAR_SOURCE = "FOMC 경제전망 2026-09-16 장기 금리 중앙값 3.2 − 2.0";
/** 연준 물가 목표 */
const PI_TARGET = 2.0;
/** 자연실업률 근사 — 추정은 CBO NROU(최신 4.16)를 썼다. 차이 0.04%p는 확률에 0.4%p 안팎. */
const U_STAR = 4.2;
/** 목표 범위 폭의 절반(25bp 범위) — 중간값 = 상단 − 0.125 */
const HALF_RANGE = 0.125;

/**
 * 순서형 로짓 계수 — `D:\Woodsman\Investor\_scripts\taylor-mapping-params.json` S2_gap_lag(2026-11-24 적합) 원값.
 * 다시 추정하면 이 넷과 볼트 스크립트를 함께 바꾼다.
 */
export const FED_HIKE_MODEL = {
  beta: 0.3839471009049613,
  gamma: 2.4242596323435266,
  alpha1: -1.7640015844077834,
  alpha2: 2.4364492605183385,
  /** 카드 각주에 그대로 쓴다 */
  sample: "1990~2026 FOMC 정례회의 223회(제로금리 회의 72회 제외)",
} as const;

/** 편향을 '중립'이 아니라고 부르는 경계 — 인상 확률과 인하 확률의 차이(2026-11-25 운영자: 라벨은 확률로). */
const BIAS_THRESHOLD = 0.1;

/** 직전 정례회의 결정 */
export type FedDecision = -1 | 0 | 1;

export type FedHikeInput = {
  /** Core PCE 전년비(%) — 연준이 보는 물가. ⚠ 없으면 계산하지 않는다 */
  corePce?: number;
  /** 연방기금 목표 범위 상단(%, FRED DFEDTARU) */
  targetUpper?: number;
  /** 실업률(%) */
  unrate?: number;
  /** 직전 정례회의 결정 — `lastMeetingDecision`으로 구한다. ⚠ 없으면 계산하지 않는다 */
  lastDecision?: FedDecision;
};

export type FedHikeBias = "hawkish" | "neutral" | "dovish";

export type FedHikeResult = {
  /** Taylor 처방금리(%) */
  prescribedRate: number;
  /** 오쿤 근사 산출갭(%p) */
  outputGap: number;
  /** 현 정책금리 = 목표 범위 중간값(%) */
  policyRate: number;
  /** 처방갭 = 처방금리 − 목표 범위 중간값(%p). +면 정책이 처방보다 완화적 → 인상 압력 */
  gap: number;
  /** 확률에 들어간 직전 회의 결정 */
  lastDecision: FedDecision;
  /** 다음 FOMC 기준 확률(합 1) */
  hike: number;
  hold: number;
  cut: number;
  bias: FedHikeBias;
  biasLabel: string;
};

const logistic = (z: number): number => 1 / (1 + Math.exp(-z));

function isNum(n: number | undefined): n is number {
  return n !== undefined && Number.isFinite(n);
}

export const BIAS_LABEL: Record<FedHikeBias, string> = {
  hawkish: "매파(인상 편향)",
  neutral: "중립",
  dovish: "비둘기(인하 편향)",
};

export const DECISION_LABEL: Record<FedDecision, string> = { 1: "인상", 0: "동결", [-1]: "인하" };

/** 처방갭 x와 직전 결정으로 세 확률(합 1). */
function probabilities(x: number, last: FedDecision): { hike: number; hold: number; cut: number } {
  const { beta, gamma, alpha1, alpha2 } = FED_HIKE_MODEL;
  const xb = beta * x + gamma * last;
  const cut = logistic(alpha1 - xb);
  const hike = 1 - logistic(alpha2 - xb);
  return { hike, hold: 1 - hike - cut, cut };
}

/**
 * ⚠ 필수 넷(Core PCE·목표 상단·실업률·직전 결정) 중 하나라도 없으면 **undefined를 낸다.**
 * 일부만으로 계산해 내보내면 "덜 본 것"이 "본 것"으로 보인다.
 */
export function estimateFedHike(input: FedHikeInput): FedHikeResult | undefined {
  const { corePce: pi, targetUpper, unrate: u, lastDecision } = input;
  if (!isNum(pi) || !isNum(targetUpper) || !isNum(u)) return undefined;
  if (lastDecision !== -1 && lastDecision !== 0 && lastDecision !== 1) return undefined;

  const outputGap = -2.0 * (u - U_STAR);
  const prescribedRate = R_STAR + pi + 0.5 * (pi - PI_TARGET) + 0.5 * outputGap;
  const policyRate = targetUpper - HALF_RANGE;
  const gap = prescribedRate - policyRate;

  const { hike, hold, cut } = probabilities(gap, lastDecision);
  const tilt = hike - cut;
  const bias: FedHikeBias = tilt > BIAS_THRESHOLD ? "hawkish" : tilt < -BIAS_THRESHOLD ? "dovish" : "neutral";

  return {
    prescribedRate,
    outputGap,
    policyRate,
    gap,
    lastDecision,
    hike,
    hold,
    cut,
    bias,
    biasLabel: BIAS_LABEL[bias],
  };
}

/**
 * 직전 정례회의 결정 — 추정과 같은 정의: 회의 끝 **전날**까지의 마지막 목표 상단 vs 회의 끝 **+3일**까지의 마지막 값,
 * 5bp 넘게 오르면 인상 · 내리면 인하 · 아니면 동결.
 * ⚠ 회의 다음 날 이후의 관측이 아직 없으면(수집 지연) undefined — 회의 전 값을 「동결」로 읽지 않는다.
 * @param points 날짜 오름차순 아니어도 된다. `date`는 YYYY-MM-DD.
 * @param meeting 회의 끝(결정 발표)일 YYYY-MM-DD
 */
export function lastMeetingDecision(
  points: { date: string; value: number }[],
  meeting: string,
): FedDecision | undefined {
  const shift = (d: string, days: number) => {
    const t = new Date(`${d}T12:00:00Z`);
    t.setUTCDate(t.getUTCDate() + days);
    return t.toISOString().slice(0, 10);
  };
  const sorted = points.filter((p) => Number.isFinite(p.value)).slice().sort((a, b) => a.date.localeCompare(b.date));
  const asof = (d: string) => sorted.filter((p) => p.date <= d).at(-1);
  const before = asof(shift(meeting, -1));
  const after = asof(shift(meeting, 3));
  if (!before || !after || after.date <= meeting) return undefined;
  const d = after.value - before.value;
  return d > 0.05 ? 1 : d < -0.05 ? -1 : 0;
}

/**
 * 인상 확률이 동결 확률을 처음 앞서는 처방갭(%p) — 화면이 「동결이 기본값인 모형」임을 숫자로 말하려고 쓴다.
 * ⚠ 손으로 적은 상수가 아니라 위 계수에서 **이분법으로 푼다** — 계수를 바꾸면 화면 문구도 같이 바뀐다.
 * 직전 결정에 따라 문턱이 달라진다(직전이 인상이면 훨씬 낮다).
 */
export function hikeOverHoldThreshold(lastDecision: FedDecision = 0): number {
  const diff = (x: number) => {
    const p = probabilities(x, lastDecision);
    return p.hike - p.hold;
  };
  let lo = -10;
  let hi = 20;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (diff(mid) > 0) hi = mid;
    else lo = mid;
  }
  return hi;
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
    `${when}Taylor 준칙 처방금리는 ${r.prescribedRate.toFixed(2)}%로 목표 범위 중간값 ${r.policyRate.toFixed(3)}%보다 ` +
    `${r.gap >= 0 ? "높고" : "낮고"}(처방갭 ${r.gap >= 0 ? "+" : ""}${r.gap.toFixed(2)}%p), ` +
    `직전 회의 결정(${DECISION_LABEL[r.lastDecision]})을 함께 넣은 과거 추정 모형으로 ` +
    `다음 회의 인상 ${formatProbability(r.hike)} · 동결 ${formatProbability(r.hold)} · ` +
    `인하 ${formatProbability(r.cut)}입니다. 편향은 ${r.biasLabel}입니다.`
  );
}

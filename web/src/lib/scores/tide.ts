/**
 * 홈 앞줄 「조류」 — 점수의 **방향**과 **읽는 법·판단법**. 순수 모듈.
 *
 * ## 운영자 원칙 (개발요구서 v2 「운영자 원칙」 ④ · ⑤, 2026-09-14)
 * - ④ 유동성 · AI 버블 점수는 **앞줄에**, 「어떻게 보나 · 어떻게 판단하나」와 함께. 판단 문장은 **조건형**이다 —
 *   매수·매도 권유나 방향 단정은 쓰지 않는다(`WOODSMAN_DOCTRINE` · `/disclaimer`).
 * - ⑤ 모은 거시 데이터로 **조류의 방향**을 알려 준다. 조류(몇 달) · 바람(이번 주) · 파도(오늘)를 한 블록에 섞지 않는다.
 *
 * ## ⚠ 문장의 근거
 * - 「50이 평소」 「67 위·33 아래는 드문 구간」은 **명세 식에서 나온 사실**이다: 점수 = 50 + 16.667 × z(10년 창의 robust z).
 *   67 ≈ z +1, 33 ≈ z −1.
 * - 방향 문턱 **5점(≈ z 0.3)** 은 명세에 없다 — Woodsman v0 가정이다(설계서 12장).
 * - ⚠ 버블 점수는 **분기 채점을 덮어쓴다** — 과거 점수가 없어 방향을 내지 않는다(지어내지 않는다).
 */
import type { ScoreKey } from "./config";

export type TideDirection = "up" | "down" | "flat" | "unknown";

/** ⚠ Woodsman v0 가정 — 이만큼 움직여야 「방향」이라고 부른다 */
export const DIRECTION_THRESHOLD = 5;

/** 두 점수로 방향. 하나라도 없으면 unknown — 발행 안 한 점수와 비교하지 않는다. */
export function tideDirection(now: number | null | undefined, past: number | null | undefined): TideDirection {
  if (now == null || past == null || !Number.isFinite(now) || !Number.isFinite(past)) return "unknown";
  const d = now - past;
  if (d >= DIRECTION_THRESHOLD) return "up";
  if (d <= -DIRECTION_THRESHOLD) return "down";
  return "flat";
}

/** 점수 수준을 말로 — 명세 식(50 + 16.667z)에서 나온 구간 */
export function levelWord(score: number): string {
  if (score >= 67) return "평소보다 크게 높다";
  if (score > 55) return "평소보다 높다";
  if (score >= 45) return "평소 수준";
  if (score > 33) return "평소보다 낮다";
  return "평소보다 크게 낮다";
}

export type TideGuide = {
  title: string;
  /** 어떻게 보나 — 무엇을 재는 숫자인가 */
  how: string;
  /** 어떻게 판단하나 — 조건형 */
  judge: string;
  /** 방향을 부르는 말(점수가 오를 때 · 내릴 때) */
  up: string;
  down: string;
};

export const TIDE_GUIDES: Partial<Record<ScoreKey, TideGuide>> = {
  global_liquidity: {
    title: "유동성",
    how: "연준 · 재무부 · 자금시장 · 신용 · 금리시장 다섯 계기를 각자 지난 10년에 대어 0~100으로 합칩니다. 50이 지난 10년의 평소입니다.",
    judge:
      "높을수록 시장에 돈이 넉넉한 쪽입니다. 67 위나 33 아래는 10년 중 드문 구간입니다. 수준보다 4주·13주 사이의 방향이 먼저 바뀌므로, 숫자와 화살표를 함께 봅니다.",
    up: "넉넉해지는 쪽",
    down: "빡빡해지는 쪽",
  },
  engine_heat: {
    title: "경기 엔진 온도",
    how: "근원 물가 · 생산자물가 · 임금 · 단위노동비용 · 에너지 · 기대인플레 · 실질금리를 각자 지난 10년에 대어 합칩니다. 50이 평소입니다.",
    judge:
      "높을수록 경제가 뜨겁습니다. 높은 온도가 이어지면 금리가 내려오기 어려운 쪽으로, 온도가 식으면 금리 부담이 줄어드는 쪽으로 읽습니다.",
    up: "뜨거워지는 쪽",
    down: "식는 쪽",
  },
};

/** 유동성 하위 계기 이름 — GLS가 판정 보류일 때 발행된 하위 점수만 보여 준다 */
export const LIQUIDITY_PARTS: { key: ScoreKey; label: string }[] = [
  { key: "fed_liquidity", label: "연준" },
  { key: "treasury_liquidity", label: "재무부" },
  { key: "funding", label: "자금시장" },
  { key: "credit_liquidity", label: "신용" },
  { key: "rate_liquidity", label: "금리시장" },
];

export type StoredScoreLike = {
  scoreKey: string;
  asOf: string;
  basis: string;
  /** ⚠ null = 발행하지 않은 점수 */
  value: number | null;
  coverage: number;
  state: string;
};

export type TideReading = {
  scoreKey: string;
  latest?: StoredScoreLike;
  past4?: StoredScoreLike;
  past13?: StoredScoreLike;
  dir4: TideDirection;
  dir13: TideDirection;
  /** 비교한 과거 점수가 나중의 수정 자료로 다시 계산한 값인가 — 화면이 그렇다고 적는다 */
  pastRecomputed: boolean;
  /** 최신 평가일이 오늘보다 `STALE_DAYS`일 넘게 묵었나(수집·계산이 멈췄을 수 있다) */
  stale: boolean;
};

/** ⚠ 수집은 매일이다. 사흘 넘게 새 점수가 없으면 멈춘 것으로 본다(주말 포함 여유). */
export const STALE_DAYS = 3;
/** 4주·13주 전 점수를 찾을 때 허용하는 앞쪽 여유(일) — 그날 계산이 없었으면 가장 가까운 이전 날 */
const PAST_TOLERANCE_DAYS = 7;

function dayNum(d: string): number {
  return Math.floor(Date.parse(`${d}T00:00:00Z`) / 86_400_000);
}

/** `target` 이전 `PAST_TOLERANCE_DAYS`일 안에서 가장 늦은 평가일의 점수 */
export function pickAt(rows: StoredScoreLike[], target: number): StoredScoreLike | undefined {
  let best: StoredScoreLike | undefined;
  for (const r of rows) {
    const n = dayNum(r.asOf);
    if (n > target || n < target - PAST_TOLERANCE_DAYS) continue;
    if (!best || r.asOf > best.asOf) best = r;
  }
  return best;
}

/** 한 점수의 저장 행들 → 최신 · 4주 전 · 13주 전 · 방향. */
export function buildTide(rows: StoredScoreLike[], scoreKey: string, today: string): TideReading {
  const mine = rows.filter((r) => r.scoreKey === scoreKey);
  const latest = mine.reduce<StoredScoreLike | undefined>((b, r) => (!b || r.asOf > b.asOf ? r : b), undefined);
  if (!latest) return { scoreKey, dir4: "unknown", dir13: "unknown", pastRecomputed: false, stale: false };
  const base = dayNum(latest.asOf);
  const past4 = pickAt(mine, base - 28);
  const past13 = pickAt(mine, base - 91);
  return {
    scoreKey,
    latest,
    past4,
    past13,
    dir4: tideDirection(latest.value, past4?.value),
    dir13: tideDirection(latest.value, past13?.value),
    pastRecomputed: [past4, past13].some((p) => p?.basis === "RECOMPUTED"),
    stale: dayNum(today) - base > STALE_DAYS,
  };
}

/**
 * 금리 방향 카드 — 원칙 ⑥의 첫 적용(홈 섹션 계획표 §2-1).
 * ⚠ 한 카드에 두 숫자를 섞지 않는다: 주 숫자는 「시장이 거는 것」(선물 내재), 보조는 「준칙이 처방하는 것」.
 */
export const RATE_GUIDE = {
  title: "금리 방향",
  how: "연방기금 선물 가격에서 시장이 다음 회의에 거는 금리 변화를 계산하고(주 숫자), 테일러 준칙이 지금 경제에 처방하는 방향을 함께 둡니다. CME 페드워치가 아니라 같은 원재료로 우리가 계산한 값입니다.",
  judge:
    "시장이 인상을 크게 반영할수록 채권 금리와 달러가 먼저 움직인 쪽으로 읽습니다. 시장과 준칙이 같은 쪽이면 흐름이 단단하고, 서로 벌어지면 발표나 회의에서 크게 출렁일 수 있는 자리로 읽습니다.",
} as const;

export const BUBBLE_GUIDE = {
  title: "AI·반도체 버블",
  how: "설비투자 · 밸류에이션 · 실물 수요 · 신용 · 심리 다섯 층 지표를 0·1·2로 채점해 0~100으로 냅니다. 운영자가 분기마다 근거와 함께 채점합니다.",
  judge:
    "20 이하 확장 · 40 이하 주의 · 60 이하 경계 · 80 이하 위험 · 그 위는 붕괴 초기 국면에 가깝다고 읽습니다. 점수는 예측이 아니라 지금 국면의 기록입니다.",
} as const;

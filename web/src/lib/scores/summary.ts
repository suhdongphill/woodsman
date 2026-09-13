/**
 * 유동성 카드 한 줄 요약 — 프로그램이 쓴다(LLM 없음). 순수 함수. 통합 계획 S4.
 *
 * ## 입력
 * 저장된 `ScoreValue` 한 행의 `detail`(`lib/scores/store.ts`의 `toScoreRow`가 쓴 모양)과 4주 전 점수.
 *
 * ## 규칙 (계획표 S4 설계 1)
 * 1. 「유동성 {점수} · {방향 말}」 — 방향은 `tideDirection`(문턱 5점).
 * 2. 발행된 계기 중 **50에서 가장 위** = 받치는 계기, **가장 아래** = 누르는 계기. 50과의 차이가 5점 미만이면 말하지 않는다.
 * 3. 빠진 계기가 있으면 「빠진 계기: …」.
 *
 * ⚠ 판단 문장이 아니라 **구성의 서술**이다 — 「사라/팔라」가 들어갈 자리가 없다(테스트가 권유 단어를 막는다).
 * ⚠ 발행하지 않은 점수(value null)에는 숫자를 쓰지 않는다 — 「판정 보류 · 커버리지 N%」.
 */
import { tideDirection, type TideDirection } from "./tide";

/** GLS 구성요소 키 → 화면 이름 */
export const GLS_COMPONENT_LABEL: Record<string, string> = {
  fed_system: "연준",
  treasury: "재무부",
  funding: "자금시장",
  credit: "신용",
  rates_market: "금리시장",
  global_dollar: "달러",
};

/** `toScoreRow`가 저장한 detail에서 이 요약이 쓰는 부분 */
export type StoredDetail = {
  components: { key: string; weight: number; score?: number; missingReason?: string }[];
};

export type LiquiditySummaryInput = {
  value: number | null;
  coverage: number;
  state: string;
  detail: StoredDetail;
  /** 4주 전 점수(없으면 방향을 말하지 않는다) */
  past4?: number | null;
};

/** 50과의 차이가 이보다 작으면 받친다/누른다고 말하지 않는다 */
export const LEAN_THRESHOLD = 5;

const DIRECTION_WORD: Record<TideDirection, string | undefined> = {
  up: "넉넉해지는 쪽",
  down: "빡빡해지는 쪽",
  flat: "보합",
  unknown: undefined,
};

/**
 * 저장된 `detail` JSON을 읽는다. ⚠ 깨져 있으면 undefined + 로그 — 화면은 한 줄 요약을 빼고, 없는 구성을 지어내지 않는다.
 */
export function parseStoredDetail(json: string | null | undefined): StoredDetail | undefined {
  if (!json) return undefined;
  try {
    const parsed = JSON.parse(json) as { components?: unknown };
    if (!Array.isArray(parsed.components)) throw new Error("components가 배열이 아니다");
    return { components: parsed.components as StoredDetail["components"] };
  } catch (error) {
    console.error("[scores] 저장된 점수 detail을 읽지 못했다", error);
    return undefined;
  }
}

/** 해석 팝업에 넘길 계기 한 줄 — 서버에서 만들어 클라이언트로 넘긴다(직렬화 가능) */
export type LiquidityComponentView = {
  key: string;
  label: string;
  /** 0~100 가중치 % */
  weightPct: number;
  score?: number;
  missingReason?: string;
};

export type LiquidityCardView = {
  asOf: string;
  oneLine: string;
  components: LiquidityComponentView[];
};

/**
 * 최신 GLS 저장 행 → 카드 한 줄 요약 + 팝업 계기 표. 행이 없거나 detail이 깨졌으면 undefined.
 * ⚠ 라우트가 JSON을 풀고 문장을 만들지 않게 여기서 한다(CLAUDE.md §1).
 */
export function liquidityCardView(
  latest: { asOf: string; value: number | null; coverage: number; state: string; detail: string } | undefined,
  past4?: number | null,
): LiquidityCardView | undefined {
  if (!latest) return undefined;
  const detail = parseStoredDetail(latest.detail);
  if (!detail) return undefined;
  return {
    asOf: latest.asOf,
    oneLine: liquidityOneLine({ value: latest.value, coverage: latest.coverage, state: latest.state, detail, past4 }),
    components: detail.components.map((c) => ({
      key: c.key,
      label: GLS_COMPONENT_LABEL[c.key] ?? c.key,
      weightPct: Math.round(c.weight * 100),
      ...(typeof c.score === "number" && Number.isFinite(c.score) ? { score: c.score } : {}),
      ...(c.missingReason ? { missingReason: c.missingReason } : {}),
    })),
  };
}

export function liquidityOneLine(input: LiquiditySummaryInput): string {
  const label = (key: string) => GLS_COMPONENT_LABEL[key] ?? key;
  const scored = input.detail.components.filter((c) => typeof c.score === "number" && Number.isFinite(c.score));
  const missing = input.detail.components.filter((c) => !(typeof c.score === "number" && Number.isFinite(c.score)));
  const missingText = missing.length ? ` · 빠진 계기: ${missing.map((c) => label(c.key)).join("·")}` : "";

  if (input.value === null || input.state === "DO_NOT_PUBLISH") {
    return `유동성 판정 보류 · 채운 계기 ${input.coverage}%${missingText}`;
  }

  const parts: string[] = [`유동성 ${Math.round(input.value)}`];
  const dir = DIRECTION_WORD[tideDirection(input.value, input.past4)];
  if (dir) parts[0] += ` · ${dir}`;

  const top = scored.reduce<(typeof scored)[number] | undefined>((b, c) => (!b || c.score! > b.score! ? c : b), undefined);
  const bottom = scored.reduce<(typeof scored)[number] | undefined>((b, c) => (!b || c.score! < b.score! ? c : b), undefined);
  const lean: string[] = [];
  if (top && top.score! - 50 >= LEAN_THRESHOLD) lean.push(`${label(top.key)}(${Math.round(top.score!)})이 받치고`);
  if (bottom && bottom !== top && 50 - bottom.score! >= LEAN_THRESHOLD) lean.push(`${label(bottom.key)}(${Math.round(bottom.score!)})이 누른다`);
  const leanText = lean.length ? ` — ${lean.join(" ")}` : "";

  return `${parts[0]}${leanText}${missingText}`;
}

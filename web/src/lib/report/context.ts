/**
 * 보고서에 **사이트가 이미 아는 것**을 채워 넣기 — 순수 함수.
 *
 * ## 왜 필요한가
 * 설계서 §5의 문장이 그대로 이유다. 사이트는 거시 40여 지표·버블 30지표·8트리거를
 * 이미 D1에 갖고 있는데, 보고서를 쓸 때 그걸 **손으로 다시 적게 하면 보고서를 안 쓰게 된다.**
 * 쓰는 비용을 먼저 낮춘다.
 *
 * ## ⚠ 스냅숏이다. 실시간 값이 아니다
 * 보고서는 **날짜가 박힌 문서**다. §01 논지가 "버블 56점(경계)"를 근거로 쓰였는데
 * 화면이 오늘 값 72를 띄우면 같은 문서가 스스로와 모순된다.
 * 그래서 주입 시점의 값을 **capturedAt과 함께 얼려서** 저장하고, 지금 값과 벌어진 차이는
 * `describeDrift()`가 **편집 화면에서만** 말한다. 그 차이가 곧 R7(다음 판단 시점)의 재료다.
 *
 * ## ⚠ 여기서 점수를 만들어 내지 않는다
 * 특히 CANSLIM M축이 그렇다 — `marketAxisEvidence()`는 **근거·출처·기준일만** 채우고
 * 점수는 사람이 넣는다. 이유는 `MARKET_AXIS_LIMITATION`에 적었다.
 */
import type { FunctionType } from "../types";
import type { RecessionLevel } from "../macro/signal";
import type { FedHikeBias } from "../macro/fedhike";

/** 침체 신호 종합 + 연준 방향. `loadMacroOverview()`가 이미 계산한 것을 옮겨 담는다. */
export type MacroContext = {
  level: RecessionLevel;
  /** 배지 문구("경계") */
  label: string;
  /** 한 문장 설명 — 그대로 화면에 나간다 */
  line: string;
  alerts: number;
  watches: number;
  unknowns: number;
  total: number;
  /** 거시 지표 전체에서 가장 최근 기준일 */
  asOf?: string;
  /** ⚠ 필수 셋(Core PCE·기준금리·실업률)이 없으면 계산 자체가 없다 */
  fed?: {
    bias: FedHikeBias;
    biasLabel: string;
    /** 0~1 */
    hike: number;
    hold: number;
    cut: number;
    /** ⚠ 입력 지표 중 **가장 오래된** 기준일 — 묵은 판단을 새 것으로 보이게 하지 않는다 */
    asOf?: string;
  };
};

/** 버블 점수·국면·발화 트리거. */
export type BubbleContext = {
  /** 0~100. ⚠ 채점된 지표가 없으면 undefined다. 0으로 내지 않는다(0은 "안전"으로 읽힌다) */
  score?: number;
  regime?: string;
  stance?: string;
  scored: number;
  total: number;
  /** 우선 경보 3종이 모두 2점인가 */
  priorityFired: boolean;
  /** ⚠ **키만** 담는다. 트리거 문장의 원본은 `lib/bubble/catalog.ts`다(코드=구조, DB=내용) */
  firedTriggerKeys: string[];
};

/** 대표 포트폴리오 편입 여부. */
export type HoldingContext = {
  inPortfolio: boolean;
  functionType?: FunctionType;
  /** % */
  targetWeight?: number;
  thesis?: string;
};

export type SiteContext = {
  macro: MacroContext;
  bubble: BubbleContext;
  holding: HoldingContext;
};

/** 저장된 스냅숏 — 사이트 자료 + **언제 떴는가**. */
export type ReportContextSnapshot = SiteContext & {
  /** YYYY-MM-DD */
  capturedAt: string;
};

/**
 * ⚠ 기능 라벨의 **세 번째 사본**이다. 일부러 따로 둔다 —
 * 화면 라벨(`components/ui/Badge`)은 컴포넌트라 순수 모듈이 쓸 수 없고,
 * AI 라벨(`lib/ai/labels`)은 프롬프트 용어라 화면 문구를 다듬는다고 같이 흔들리면
 * 모델 출력이 조용히 달라진다.
 * 대신 **값이 벌어지면 테스트가 깨진다**(`context.test.ts`) — 주석으로 "같이 고치세요"라고
 * 쓰지 않는다(CLAUDE.md §2-1).
 */
export const FUNCTION_LABEL_REPORT: Record<FunctionType, string> = {
  GROWTH: "성장",
  INCOME: "인컴",
  DEFENSE: "방어",
};

/**
 * ⚠ M축을 거시 지표로 **채점하지 않는** 이유. 화면에 그대로 띄운다.
 *
 * 오닐의 M은 지수의 **분산일 누적과 추세**를 읽는다. 사이트의 거시 지표는 **침체 신호와
 * 정책 방향**을 읽는다. 둘은 겹치지만 같지 않다. 겹친다고 점수를 대신 매기면
 * 다른 것을 잰 값이 M축 자리에 조용히 앉는다 — 데이터 태그로도 안 잡히는 종류의 거짓이다.
 */
export const MARKET_AXIS_LIMITATION =
  "사이트의 거시 지표는 침체 신호와 정책 방향을 잽니다. 오닐의 M축이 재는 지수의 분산일·추세와는 겹치지만 같지 않습니다. 그래서 근거·출처·기준일만 채우고 점수는 사람이 넣습니다.";

/** 0~1 확률을 사람이 읽는 %로. 소수점을 두지 않는다 — 없는 정밀도가 생긴다. */
function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

/**
 * "경고 0 · 주의 0 · 미수집 1" — 침체 신호의 내역 한 줄.
 *
 * ⚠ **미수집을 숨기지 않는다.** "안정 · 경고 0 · 주의 0"만 보이면 5개를 다 보고 안전하다는
 *    뜻으로 읽히는데, 실제로는 한 개를 못 읽은 것일 수 있다. "값이 없음"과 "읽지 못함"이
 *    같은 화면이 되면 안 된다(운영지침 §3).
 * ⚠ 화면 세 곳(편집 패널 · 붙여넣을 표 · 공개 카드)이 **이 함수 하나**를 쓴다.
 *    문장을 각자 만들면 한 곳만 미수집을 빠뜨린다 — 실제로 그렇게 만들었다가 잡았다.
 */
export function recessionCounts(macro: MacroContext): string {
  const parts = [`경고 ${macro.alerts}`, `주의 ${macro.watches}`];
  if (macro.unknowns > 0) parts.push(`미수집 ${macro.unknowns}`);
  return parts.join(" · ");
}

/** CANSLIM M축에 채워 넣을 근거. ⚠ **점수는 내지 않는다** — 위 `MARKET_AXIS_LIMITATION`. */
export type MarketAxisEvidence = {
  evidence: string;
  source: string;
  sourceUrl: string;
  asOf?: string;
};

/**
 * 거시 스냅숏 → M축 근거 한 줄.
 *
 * ⚠ 판정이 `unknown`이면 **아무것도 내지 않는다.** "아직 안 가져왔다"를 근거 문장으로
 *    만들면 빈 것이 채워진 것처럼 보인다.
 */
export function marketAxisEvidence(macro: MacroContext): MarketAxisEvidence | undefined {
  if (macro.level === "unknown") return undefined;

  const parts = [
    `침체 신호 종합 ${macro.label} — ${recessionCounts(macro)} (${macro.total}개 지표)`,
  ];
  if (macro.fed) {
    parts.push(
      `연준 ${macro.fed.biasLabel} — 인상 ${pct(macro.fed.hike)} · 동결 ${pct(macro.fed.hold)} · 인하 ${pct(macro.fed.cut)}`,
    );
  }

  return {
    evidence: parts.join(" / "),
    source: "사이트 거시 지표 — FRED 집계",
    sourceUrl: "/macro",
    // ⚠ 연준 판단이 있으면 **더 오래된 쪽**을 기준일로 쓴다. 한쪽만 오늘 것이어도
    //    "오늘 기준"이라고 적으면 묵은 판단이 새 것으로 보인다.
    asOf: [macro.asOf, macro.fed?.asOf].filter((d): d is string => !!d).sort()[0],
  };
}

/** 기준일 꼬리표. 날짜 없는 숫자는 자동으로 갱신되는 값처럼 읽힌다. */
function asOfSuffix(day: string | undefined): string {
  return day ? ` · 기준일 ${day}` : "";
}

/**
 * 본문에 붙여 넣을 마크다운.
 *
 * ⚠ **표를 쓰지 않는다.** `lib/markdown.ts`는 표 문법을 지원하지 않고 raw HTML도 escape한다
 *    (일부러 그렇게 만든 모듈이다). 표로 내보내면 붙여 넣은 자리에서
 *    `| 항목 | 값 | | --- | --- |`가 **한 문단으로 뭉개진다.**
 *    ⚠ 처음에 표로 만들었다가 이 사실을 뒤늦게 확인하고 목록으로 바꿨다 —
 *    되돌리려면 `markdown.ts`에 표 문법을 먼저 넣어야 한다.
 * ⚠ 저장하는 것은 **사람이 붙여 넣은 뒤의 본문**이다. 액션이 본문을 대신 고치지 않는다 —
 *    쓰던 글을 프로그램이 건드리면 다시는 안 쓴다.
 * ⚠ 없는 값은 `—`로 두고 어디서 보는지 적는다(R2). 0이나 "안전"으로 채우지 않는다.
 */
export function renderContextMarkdown(snapshot: ReportContextSnapshot): string {
  const { macro, bubble, holding } = snapshot;

  const lines: string[] = [`> 사이트 자료 자동 주입 · 기준 ${snapshot.capturedAt}`, ""];

  lines.push(
    macro.level === "unknown"
      ? "- **침체 신호 종합** — 아직 수집 전입니다 (/macro에서 가져옵니다)"
      : `- **침체 신호 종합** — ${macro.label} · ${recessionCounts(macro)} (${macro.total}개 지표)${asOfSuffix(macro.asOf)}`,
  );

  lines.push(
    macro.fed
      ? `- **연준 방향** — ${macro.fed.biasLabel} · 인상 ${pct(macro.fed.hike)} / 동결 ${pct(
          macro.fed.hold,
        )} / 인하 ${pct(macro.fed.cut)}${asOfSuffix(macro.fed.asOf)}`
      : "- **연준 방향** — 산출하지 않았습니다 (Core PCE·기준금리·실업률이 있어야 계산됩니다 · /macro)",
  );

  lines.push(
    bubble.score === undefined
      ? "- **AI·반도체 버블** — 아직 채점 전입니다 (/macro/bubble에서 채점합니다)"
      : `- **AI·반도체 버블** — ${bubble.score}점 · ${bubble.regime ?? "—"} (${bubble.total}개 중 ${
          bubble.scored
        }개 채점)${asOfSuffix(snapshot.capturedAt)}`,
  );

  lines.push(
    `- **발화한 하드 트리거** — ${
      bubble.firedTriggerKeys.length ? bubble.firedTriggerKeys.join(" · ") : "없음"
    }${bubble.priorityFired ? " · ⚠ 우선 경보 3종 동시 발화" : ""}`,
  );

  lines.push(
    holding.inPortfolio
      ? `- **대표 포트폴리오** — 편입 · ${
          holding.functionType ? FUNCTION_LABEL_REPORT[holding.functionType] : "—"
        } · 목표비중 ${holding.targetWeight != null ? `${holding.targetWeight}%` : "—"}`
      : "- **대표 포트폴리오** — 미편입 (관찰 종목)",
  );

  lines.push(
    "",
    "출처: [거시 지표](/macro) · [버블 모니터](/macro/bubble) · [대표 포트폴리오](/portfolio)",
  );

  return lines.join("\n");
}

/** 주입 시점과 지금의 차이 한 줄. */
export type ContextDrift = {
  label: string;
  before: string;
  after: string;
};

function bubbleScoreText(score: number | undefined, regime: string | undefined): string {
  return score === undefined ? "미채점" : `${score}점 · ${regime ?? "—"}`;
}

function holdingText(h: HoldingContext): string {
  if (!h.inPortfolio) return "미편입";
  const fn = h.functionType ? FUNCTION_LABEL_REPORT[h.functionType] : "—";
  return `편입 · ${fn} · ${h.targetWeight != null ? `${h.targetWeight}%` : "—"}`;
}

/**
 * 주입한 뒤 사이트 값이 얼마나 움직였나.
 *
 * ⚠ 이건 **편집 화면에서만** 쓴다. 공개 화면은 스냅숏 그대로를 보여준다 —
 *    발행된 문서의 숫자가 읽는 날마다 달라지면 그건 다른 문서다.
 * ⚠ 버블 점수는 **1점이라도 움직이면** 말한다. 이미 반올림한 둔한 눈금이다.
 */
export function describeDrift(snapshot: SiteContext, now: SiteContext): ContextDrift[] {
  const out: ContextDrift[] = [];

  if (snapshot.macro.level !== now.macro.level) {
    out.push({ label: "침체 신호 종합", before: snapshot.macro.label, after: now.macro.label });
  }
  if (snapshot.macro.fed?.bias !== now.macro.fed?.bias) {
    out.push({
      label: "연준 방향",
      before: snapshot.macro.fed?.biasLabel ?? "미산출",
      after: now.macro.fed?.biasLabel ?? "미산출",
    });
  }
  if (snapshot.bubble.score !== now.bubble.score) {
    out.push({
      label: "버블 점수",
      before: bubbleScoreText(snapshot.bubble.score, snapshot.bubble.regime),
      after: bubbleScoreText(now.bubble.score, now.bubble.regime),
    });
  }

  const was = new Set(snapshot.bubble.firedTriggerKeys);
  const is = new Set(now.bubble.firedTriggerKeys);
  const added = now.bubble.firedTriggerKeys.filter((k) => !was.has(k));
  const cleared = snapshot.bubble.firedTriggerKeys.filter((k) => !is.has(k));
  if (added.length || cleared.length) {
    out.push({
      label: "하드 트리거",
      before: snapshot.bubble.firedTriggerKeys.join(" · ") || "없음",
      after: now.bubble.firedTriggerKeys.join(" · ") || "없음",
    });
  }

  const beforeHolding = holdingText(snapshot.holding);
  const afterHolding = holdingText(now.holding);
  if (beforeHolding !== afterHolding) {
    out.push({ label: "대표 포트폴리오", before: beforeHolding, after: afterHolding });
  }

  return out;
}

/**
 * ⚠ 스냅숏이 묵었다고 보는 기준(일).
 * 거시 지표는 대부분 월간이고 버블 지표는 분기 점검이라, 한 달을 넘기면
 * "그때 그 숫자"라고 말하기 어렵다.
 */
export const CONTEXT_STALE_DAYS = 30;

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** 두 YYYY-MM-DD 사이의 일수. 모양이 아니면 undefined — 억지로 0을 내지 않는다. */
export function contextAgeDays(capturedAt: string, today: string): number | undefined {
  if (!DAY_PATTERN.test(capturedAt) || !DAY_PATTERN.test(today)) return undefined;
  const from = Date.parse(`${capturedAt}T00:00:00Z`);
  const to = Date.parse(`${today}T00:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return undefined;
  return Math.round((to - from) / 86_400_000);
}

export function isContextStale(capturedAt: string, today: string): boolean {
  const age = contextAgeDays(capturedAt, today);
  return age !== undefined && age > CONTEXT_STALE_DAYS;
}

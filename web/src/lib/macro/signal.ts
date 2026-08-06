/**
 * 침체 시그널 판정 — 순수 계산.
 *
 * ## 왜 '종합 등급'을 내나
 * 처음 온 사람에게 지표 5개의 임계값을 각각 설명하면 아무것도 남지 않는다.
 * **"지금은 어떤 상태인가"**를 한 줄로 먼저 주고, 근거가 되는 5개를 그 아래에 편다.
 *
 * ⚠ 이 등급은 **읽는 법**이지 매매 신호가 아니다. "그러니 팔아라"로 넘어가지 않는다
 * (`/disclaimer`, `lib/ai/persona.ts` 공통 규범과 같은 선).
 * ⚠ 값을 못 읽은 지표는 `unknown`으로 남긴다. 정상(normal)으로 처리하면
 *    **"읽지 못함"이 "괜찮음"으로 보이는** 조용한 실패가 된다.
 */
import type { MacroSignalRule } from "./catalog";

export type SignalStatus = "normal" | "watch" | "alert" | "unknown";

/** 값 하나를 규칙에 대어 본다. */
export function judgeSignal(
  rule: MacroSignalRule | undefined,
  value: number | undefined,
): SignalStatus {
  if (!rule || value === undefined || !Number.isFinite(value)) return "unknown";

  if (rule.op === "lt") {
    if (value < rule.alert) return "alert";
    if (value < rule.warn) return "watch";
    return "normal";
  }
  if (value > rule.alert) return "alert";
  if (value > rule.warn) return "watch";
  return "normal";
}

export const SIGNAL_LABEL: Record<SignalStatus, string> = {
  normal: "정상",
  watch: "주의",
  alert: "경고",
  unknown: "미수집",
};

export type RecessionLevel = "calm" | "watch" | "caution" | "danger" | "unknown";

export type RecessionSummary = {
  level: RecessionLevel;
  /** 배지에 쓰는 짧은 말 */
  label: string;
  /** 한 문장 설명 — 홈에 그대로 나간다 */
  line: string;
  alerts: number;
  watches: number;
  unknowns: number;
  /** 판정에 쓴 지표 수 */
  total: number;
};

/**
 * 5개 시그널을 하나의 등급으로.
 *
 * 경고 2개 이상이면 '경계'. 하나만으로 등급을 올리지 않는 이유는, 어떤 지표든 단독으로는
 * 헛발질을 하기 때문이다(금리 역전은 1년 넘게 이어지고도 침체가 오지 않은 적이 있다).
 */
export function summarizeRecession(statuses: SignalStatus[]): RecessionSummary {
  const total = statuses.length;
  const alerts = statuses.filter((s) => s === "alert").length;
  const watches = statuses.filter((s) => s === "watch").length;
  const unknowns = statuses.filter((s) => s === "unknown").length;

  if (total === 0 || unknowns === total) {
    return {
      level: "unknown",
      label: "미수집",
      line: "아직 지표를 가져오지 않았습니다. 관리자 화면에서 자료를 가져오면 판정이 시작됩니다.",
      alerts,
      watches,
      unknowns,
      total,
    };
  }

  const known = total - unknowns;
  const suffix =
    unknowns > 0 ? ` (${unknowns}개 지표는 값을 읽지 못해 판정에서 빠졌습니다)` : "";

  if (alerts >= 3) {
    return {
      level: "danger",
      label: "위험",
      line: `${known}개 중 ${alerts}개가 경고 수준입니다. 과거 침체 국면에서 함께 나타나던 조합입니다.${suffix}`,
      alerts,
      watches,
      unknowns,
      total,
    };
  }
  if (alerts >= 2) {
    return {
      level: "caution",
      label: "경계",
      line: `경고가 ${alerts}개입니다. 하나만이면 헛신호일 수 있지만, 둘 이상이 겹치는 구간은 따로 기록해 둘 만합니다.${suffix}`,
      alerts,
      watches,
      unknowns,
      total,
    };
  }
  if (alerts === 1 || watches >= 2) {
    return {
      level: "watch",
      label: "주의",
      line: `경고 ${alerts}개 · 주의 ${watches}개. 아직 한두 지표만 기준선을 넘었습니다. 방향이 이어지는지를 봅니다.${suffix}`,
      alerts,
      watches,
      unknowns,
      total,
    };
  }
  return {
    level: "calm",
    label: "안정",
    line: `${known}개 지표가 모두 기준선 안쪽입니다. 지금 당장 침체를 가리키는 신호는 없습니다.${suffix}`,
    alerts,
    watches,
    unknowns,
    total,
  };
}

/**
 * GCRM 조류 해설 — 입력(같은 run의 저장값) → AI 프롬프트 → **서버 대조**. 순수 함수.
 *
 * ## 왜 있나 (2026-11-14 · v3)
 * 운영자: 「조류는 AI가 지표를 판단해서 설명을 붙일 수 있도록」 · 「투자자에게 도움이 되는 Navigator」.
 * 독자는 점수 여섯 개를 봐도 **무엇이 바뀌었고 무엇을 지켜봐야 하는지** 모른다. 그 한 문단을 AI가 쓰되, 숫자는 엔진이 쥔다.
 *
 * ## ⚠ 지키는 것
 * - **숫자는 엔진이 정한다.** AI가 쓴 글의 모든 숫자는 이 모듈이 만든 사실표(`facts`)에 있어야 한다. 하나라도 없으면 그 초안은 실패.
 * - 근거는 사실 ID(`factIds`)로 단다. 화면은 AI 글이 아니라 **저장된 사실 값**을 옆에 그린다.
 * - 「판정 보류」는 그대로 전한다 — 여섯 점수가 다 나왔다(`published`)는 것과 레짐이 확정됐다(`regimeConfirmed`)는 것은 **다른 사실**이다.
 * - 비교값이 없으면(그날 run 없음 · 모델 버전이 다름 · 발행 안 됨) 없다고 적는다. 0이나 보합으로 메우지 않는다.
 * - 매매 권유·방향 단정 표현은 실패로 친다(`WOODSMAN_DOCTRINE`와 같은 선).
 * - 연구는 최대 2편, 입력에 준 ID만. 연구를 당일 원인이나 운영 산식의 근거로 쓰지 않는다(프롬프트 규칙 · 화면은 링크·한계를 DB 값으로).
 * - ⚠ 이 모듈은 운영 점수·가중치·임계값에 쓰는 경로가 없다.
 */

export const COMMENTARY_PROMPT_VERSION = "gcrm-commentary-v1";

export type CompareValue =
  | { kind: "value"; asOf: string; score: number }
  | { kind: "missing"; reason: "NO_RUN" | "VERSION_CHANGED" | "NOT_PUBLISHED"; detail: string };

export type CommentaryPillar = {
  pillar: string;
  nameKo: string;
  axis: string;
  /** 발행 안 됐으면 null */
  score: number | null;
  coverage: number | null;
  status: string;
  prevDay: CompareValue;
  w4: CompareValue;
};

export type CommentaryResearch = { id: string; title: string; horizon: string; candidate: string | null; limit: string | null };

export type CommentaryInput = {
  asOf: string;
  computedAt: string;
  runId: string;
  modelVersion: string;
  /** 정렬 상태 한글(예: 판정 보류). 없으면 null */
  regimeLabel: string | null;
  /** 레짐이 확정된 상태인가 — 판정 보류·없음이면 false */
  regimeConfirmed: boolean;
  pillars: CommentaryPillar[];
  research: CommentaryResearch[];
};

export type CommentaryFact = { id: string; label: string; text: string };

export type CommentaryBody = {
  regimeStatus: string;
  summary: string;
  evidence: { factIds: string[]; text: string }[];
  interpretation: string;
  nextChecks: string[];
  researchIds: string[];
};

const AXIS_KO: Record<string, string> = { tide: "조류(1~12개월)", wind: "바람(1~13주)", wave: "파도(1~5일)" };
const MISSING_KO: Record<Extract<CompareValue, { kind: "missing" }>["reason"], string> = {
  NO_RUN: "비교 시점 계산 없음",
  VERSION_CHANGED: "모델 버전이 달라 비교하지 않음",
  NOT_PUBLISHED: "비교 시점 미발행",
};

const round = (n: number) => Math.round(n);
const pct = (c: number) => `${Math.round(c * 100)}%`;

/**
 * 사실표 — 프롬프트에 들어가는 **유일한 숫자 원천**. ID는 화면이 값을 다시 그릴 때 쓴다.
 * ⚠ 표시 형식(정수 점수 · % 커버리지 · 정수 변화)이 곧 대조 기준이다 — AI가 소수점을 붙이면 실패한다.
 */
export function buildFacts(input: CommentaryInput): CommentaryFact[] {
  const facts: CommentaryFact[] = [
    { id: "run.asOf", label: "기준일", text: input.asOf },
    { id: "run.model", label: "모델 버전", text: input.modelVersion },
    { id: "regime.status", label: "레짐 판정 상태", text: input.regimeLabel ?? "자료 없음" },
    {
      id: "regime.confirmed",
      label: "레짐 확정 여부",
      text: input.regimeConfirmed ? "확정" : "확정 아님(점수 발행과 별개)",
    },
  ];
  const published = input.pillars.filter((p) => p.score != null);
  facts.push({ id: "pillars.published", label: "발행된 기둥 수", text: `${published.length}/${input.pillars.length}` });

  for (const p of input.pillars) {
    const base = `${p.pillar}.${p.axis}`;
    const name = `${p.nameKo} · ${AXIS_KO[p.axis] ?? p.axis}`;
    facts.push({
      id: `${base}.score`,
      label: `${name} 점수`,
      text: p.score == null ? `미발행(${p.status})` : `${round(p.score)}점(0~100)`,
    });
    if (p.coverage != null) facts.push({ id: `${base}.coverage`, label: `${name} 커버리지`, text: pct(p.coverage) });
    for (const [key, cmp, word] of [
      ["prev", p.prevDay, "직전 계산"],
      ["w4", p.w4, "4주 전"],
    ] as const) {
      if (cmp.kind === "missing") {
        facts.push({ id: `${base}.${key}`, label: `${name} ${word} 비교`, text: MISSING_KO[cmp.reason] });
      } else if (p.score == null) {
        facts.push({ id: `${base}.${key}`, label: `${name} ${word} 비교`, text: "지금 값 미발행" });
      } else {
        const d = round(p.score) - round(cmp.score);
        facts.push({
          id: `${base}.${key}`,
          label: `${name} ${word}(${cmp.asOf}) 대비`,
          text: `${round(cmp.score)}점 → ${round(p.score)}점(${d > 0 ? "+" : ""}${d})`,
        });
      }
    }
  }
  return facts;
}

/** 프롬프트에 실제로 쓴 숫자들 — 대조 기준. 날짜는 따로 뺀다. */
export function allowedNumbers(facts: CommentaryFact[], extra: string[] = []): { numbers: Set<number>; dates: Set<string> } {
  const numbers = new Set<number>();
  const dates = new Set<string>();
  for (const t of [...facts.map((f) => `${f.label} ${f.text}`), ...extra]) {
    for (const d of t.match(/\d{4}-\d{2}-\d{2}/g) ?? []) dates.add(d);
    for (const n of t.replace(/\d{4}-\d{2}-\d{2}/g, " ").match(/[+-]?\d+(?:\.\d+)?/g) ?? []) numbers.add(Math.abs(Number(n)));
  }
  return { numbers, dates };
}

export function buildCommentaryPrompt(input: CommentaryInput): string {
  const facts = buildFacts(input);
  const research = input.research
    .map((r) => `- ${r.id} · ${r.title} · ${AXIS_KO[r.horizon] ?? r.horizon} · 검증 후보: ${r.candidate ?? "—"} · 한계: ${r.limit ?? "—"}`)
    .join("\n");
  return `오늘의 GCRM 조류 해설 초안을 써 주세요. 독자는 개인 투자자입니다 — 「무엇이 바뀌었고, 무엇을 지켜봐야 하나」를 알고 싶어 합니다.

## 사실표 (이 표의 숫자만 쓸 수 있습니다)
${facts.map((f) => `- [${f.id}] ${f.label}: ${f.text}`).join("\n")}

## 관련 연구 후보 (최대 2편 · 직접 관련 있을 때만 · 없으면 빈 배열)
${research || "- (없음)"}

## 규칙
- 사실표에 없는 숫자를 쓰지 않습니다. 점수는 정수, 커버리지는 %로 표에 적힌 그대로.
- regimeStatus에는 사실표의 「레짐 판정 상태」를 글자 그대로 옮깁니다. 확정이 아니면 확정처럼 쓰지 않습니다.
  여섯 점수가 발행됐다는 것과 레짐이 확정됐다는 것은 다른 사실입니다.
- 비교값이 없다고 적힌 기둥은 「비교할 수 없다」고만 씁니다. 방향을 추측하지 않습니다.
- 커버리지가 낮거나 미발행인 기둥이 해석을 어떻게 제한하는지 interpretation에 짧게 적습니다.
- nextChecks는 앞으로 확인할 관측을 **가설**로 씁니다(「~이면 ~를 다시 본다」). 엔진의 승격 조건이라고 말하지 않습니다.
- 연구는 배경 설명일 뿐입니다. 오늘 움직임의 원인이나 점수의 근거로 쓰지 않습니다.
- 매수·매도·비중 조절을 권하지 않습니다. 가격 방향을 단정하지 않습니다.
- 짧게: summary 2~3문장, evidence 2~5개, interpretation 2~3문장, nextChecks 1~3개.`;
}

const FORBIDDEN = /(매수|매도|사세요|파세요|팔아야|사야|비중을 늘|비중을 줄|목표주가|지금이 기회|반드시 오른|반드시 내린)/;

function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) return undefined;
  try {
    return JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    return undefined;
  }
}

const isStr = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

/**
 * AI 답을 읽고 대조한다. 통과하면 본문, 아니면 **모든** 문제를 돌려준다(첫 문제에서 멈추지 않는다 — 운영자가 한 번에 본다).
 */
export function verifyCommentary(
  raw: string,
  input: CommentaryInput,
): { ok: true; body: CommentaryBody } | { ok: false; problems: string[] } {
  const parsed = extractJson(raw);
  if (!parsed || typeof parsed !== "object") return { ok: false, problems: ["JSON으로 읽지 못했습니다."] };
  const o = parsed as Record<string, unknown>;
  const problems: string[] = [];
  const facts = buildFacts(input);
  const factIds = new Set(facts.map((f) => f.id));
  const researchIds = new Set(input.research.map((r) => r.id));
  const expectedStatus = input.regimeLabel ?? "자료 없음";

  if (o.regimeStatus !== expectedStatus) problems.push(`regimeStatus가 「${expectedStatus}」와 다릅니다: ${String(o.regimeStatus)}`);
  if (!isStr(o.summary)) problems.push("summary가 비었습니다.");
  else if (o.summary.length > 400) problems.push(`summary가 깁니다(${o.summary.length}자 · 400자).`);
  if (!isStr(o.interpretation)) problems.push("interpretation이 비었습니다.");
  else if (o.interpretation.length > 600) problems.push(`interpretation이 깁니다(${o.interpretation.length}자 · 600자).`);

  const evidence: CommentaryBody["evidence"] = [];
  if (!Array.isArray(o.evidence) || o.evidence.length === 0 || o.evidence.length > 6) {
    problems.push("evidence는 1~6개여야 합니다.");
  } else {
    for (const [i, e] of o.evidence.entries()) {
      const ev = e as Record<string, unknown>;
      const ids = Array.isArray(ev?.factIds) ? ev.factIds.filter(isStr) : [];
      if (!isStr(ev?.text)) problems.push(`evidence[${i}] text가 비었습니다.`);
      if (ids.length === 0) problems.push(`evidence[${i}]에 근거 ID가 없습니다.`);
      const unknown = ids.filter((id) => !factIds.has(id));
      if (unknown.length) problems.push(`evidence[${i}]의 근거 ID가 사실표에 없습니다: ${unknown.join(", ")}`);
      if (isStr(ev?.text)) evidence.push({ factIds: ids, text: ev.text });
    }
  }

  const nextChecks = Array.isArray(o.nextChecks) ? o.nextChecks.filter(isStr) : [];
  if (nextChecks.length === 0 || nextChecks.length > 3) problems.push("nextChecks는 1~3개여야 합니다.");

  const rIds = Array.isArray(o.researchIds) ? o.researchIds.filter(isStr) : [];
  if (rIds.length > 2) problems.push("연구는 최대 2편입니다.");
  const badR = rIds.filter((id) => !researchIds.has(id));
  if (badR.length) problems.push(`입력에 없는 연구 ID: ${badR.join(", ")}`);

  // ⭐ 숫자 대조 — 글에 나온 숫자는 모두 사실표에 있어야 한다
  const texts = [o.summary, o.interpretation, ...evidence.map((e) => e.text), ...nextChecks].filter(isStr);
  const { numbers, dates } = allowedNumbers(facts, ["4주 1일 6개 1~12개월 1~13주 1~5일 0~100"]);
  const strayNumbers = new Set<string>();
  const strayDates = new Set<string>();
  for (const t of texts) {
    for (const d of t.match(/\d{4}-\d{2}-\d{2}/g) ?? []) if (!dates.has(d)) strayDates.add(d);
    for (const n of t.replace(/\d{4}-\d{2}-\d{2}/g, " ").match(/[+-]?\d+(?:\.\d+)?/g) ?? []) {
      if (!numbers.has(Math.abs(Number(n)))) strayNumbers.add(n);
    }
    const bad = t.match(FORBIDDEN);
    if (bad) problems.push(`권유·단정 표현: 「${bad[0]}」`);
  }
  if (strayNumbers.size) problems.push(`사실표에 없는 숫자: ${[...strayNumbers].join(", ")}`);
  if (strayDates.size) problems.push(`사실표에 없는 날짜: ${[...strayDates].join(", ")}`);

  if (problems.length) return { ok: false, problems };
  return {
    ok: true,
    body: {
      regimeStatus: expectedStatus,
      summary: (o.summary as string).trim(),
      evidence,
      interpretation: (o.interpretation as string).trim(),
      nextChecks,
      researchIds: rIds,
    },
  };
}

/** 비교값 만들기 — 같은 모델 버전 · 발행된 값일 때만 숫자. */
export function compareValue(
  other: { asOf: string; modelVersion: string; score: number | null } | undefined,
  currentModelVersion: string,
): CompareValue {
  if (!other) return { kind: "missing", reason: "NO_RUN", detail: "비교 시점의 계산이 없다" };
  if (other.modelVersion !== currentModelVersion)
    return { kind: "missing", reason: "VERSION_CHANGED", detail: `${other.modelVersion} → ${currentModelVersion}` };
  if (other.score == null || !Number.isFinite(other.score))
    return { kind: "missing", reason: "NOT_PUBLISHED", detail: `${other.asOf}에 발행되지 않았다` };
  return { kind: "value", asOf: other.asOf, score: other.score };
}

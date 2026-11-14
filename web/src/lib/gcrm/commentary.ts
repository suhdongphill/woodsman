/**
 * GCRM 조류 해설 — 입력(같은 run의 저장값) → AI 프롬프트 → **서버 대조**. 순수 함수.
 *
 * ## 왜 있나 (2026-11-14 · v3)
 * 운영자: 「조류는 AI가 지표를 판단해서 설명을 붙일 수 있도록」 · 「투자자에게 도움이 되는 Navigator」 · 「항상 투자자 관점에서」.
 * 독자는 점수 여섯 개를 봐도 **무엇이 바뀌었고 무엇을 지켜봐야 하는지** 모른다. 그 브리핑을 AI가 쓰되, 숫자는 엔진이 쥔다.
 *
 * ## 프롬프트 판
 * - v1(2026-11-14 첫 배포): 요약·근거·해석·다음 확인. 운영에서 한 번도 돌지 않았다(초안 0건).
 * - **v2(2026-11-14 · 운영자가 붙여 넣은 `gcrm-commentary-v2` 문서)**: 「사실표 자체 참조형 브리핑」 — 판정 한 문장 · 본문 2문단 ·
 *   단서(「이 해석이 틀린다면」) · 「이렇게 되면 다시 봅니다」 · 근거 숫자 · 카드. 방향은 **사실표 우선 → 내장표 → 둘 다 없으면 쓰지 않는다**.
 *   - ⚠ 문서는 「서버 파이프라인은 손대지 않는다」고 했지만 v1 서버 대조는 JSON을 받는다 → v2 구성을 **JSON 칸으로** 받는다(대조는 그대로).
 *   - ⚠ 문서의 「조류 → 1년 흐름」 변환은 따르지 않았다 — 운영자 결정(11/14): **「조류(1~12개월 흐름)」로 첫 등장에 기간 설명**.
 *     홈 첫 문장(「바람과 조류를 설명하는 길잡이」)과 말을 맞추고, 실제 기간(1~12개월)과도 맞춘다.
 *   - 문서가 권한 서버 쪽 보강을 넣었다: 기둥별 **방향(극성)** · **수준 말**(홈 칩과 같은 `levelWord`) · **서버 메모 다섯 가지**.
 *
 * ## ⚠ 지키는 것
 * - **숫자는 엔진이 정한다.** AI 글의 모든 숫자·날짜·분수는 사실표에 있어야 한다. 하나라도 없으면 그 초안은 실패.
 * - 「판정 보류」는 그대로 — 점수가 다 나왔다는 것과 레짐이 확정됐다는 것은 **다른 사실**이다.
 * - 비교값이 없으면 이유를 적는다. 0·보합으로 메우지 않는다.
 * - 매매 권유·방향 단정·내부 용어는 실패로 친다. 방향이 맞는지는 서버가 못 잡는다 — **사람 승인이 마지막 관문**.
 * - ⚠ 이 모듈은 운영 점수·가중치·임계값에 쓰는 경로가 없다.
 */
import { DIRECTION } from "./config/model";
import { levelWord } from "../scores/tide";

export const COMMENTARY_PROMPT_VERSION = "gcrm-commentary-v2";

export type CompareValue =
  | { kind: "value"; asOf: string; score: number }
  | { kind: "missing"; reason: "NO_RUN" | "VERSION_CHANGED" | "NOT_PUBLISHED"; detail: string };

export type CommentaryPillar = {
  pillar: string;
  nameKo: string;
  axis: string;
  /** favorable(높을수록 자본에 유리) | stress(높을수록 불리) — `GCRM_PILLARS.polarity`. 모르면 null */
  polarity: "favorable" | "stress" | null;
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
  regimeLabel: string | null;
  regimeConfirmed: boolean;
  pillars: CommentaryPillar[];
  research: CommentaryResearch[];
};

export type CommentaryFact = { id: string; label: string; text: string };

/** v2 출력 — 브리핑(brief)과 카드(card)를 한 번에 받는다. */
export type CommentaryBody = {
  regimeStatus: string;
  /** [1] 판정 — 한 문장, 점수 없음 */
  verdict: string;
  /** [2] 본문 — 산문 2문단 */
  paragraphs: string[];
  /** [3] 단서 — 마지막 1~2문장은 「이 해석이 틀린다면」 */
  caveat: string;
  /** [4] 이렇게 되면 다시 봅니다 — 2~3개 */
  triggers: string[];
  /** [5] 근거 숫자 — 본문에서 쓴 숫자의 사실 ID. 값은 화면이 사실표에서 그린다 */
  evidenceFactIds: string[];
  /** 카드 — 2~3문장(홈용) */
  card: string;
  researchIds: string[];
};

const AXIS_KO: Record<string, string> = { tide: "조류(1~12개월 흐름)", wind: "바람(1~13주 흐름)", wave: "파도(1~5일 반응)" };
const MISSING_KO: Record<Extract<CompareValue, { kind: "missing" }>["reason"], string> = {
  NO_RUN: "비교 시점 계산 없음",
  VERSION_CHANGED: "모델 버전이 달라 비교하지 않음",
  NOT_PUBLISHED: "비교 시점에 점수 없음",
};
const POLARITY_KO = {
  favorable: "점수가 높을수록 자본에 유리(우호형) — 상승은 좋은 소식",
  stress: "점수가 높을수록 자본에 불리(긴장형) — 상승은 나쁜 소식",
} as const;

const round = (n: number) => Math.round(n);
const pct = (c: number) => `${Math.round(c * 100)}%`;

type Move = "up" | "down" | "flat";
function move(p: CommentaryPillar, cmp: CompareValue): Move | null {
  if (p.score == null || cmp.kind !== "value") return null;
  const d = round(p.score) - round(cmp.score);
  if (Math.abs(d) < DIRECTION.deadband.tide) return "flat";
  return d > 0 ? "up" : "down";
}
const MOVE_KO: Record<Move, string> = { up: "올라감", down: "내려감", flat: "제자리" };

/**
 * 서버 메모 — 모델이 계산으로 알아내다 틀리기 쉬운 것(v2 문서 권고 다섯 가지). ⚠ 새 숫자를 만들지 않는다(이름·방향 말만).
 * 방향 판정은 홈과 같은 불감대(`DIRECTION.deadband.tide`)를 쓴다 — 홈 칩이 「보합」이라 한 것을 메모가 「올라감」이라 하지 않게.
 */
export function serverNotes(input: CommentaryInput): string[] {
  const notes: string[] = [];
  const scored = input.pillars.filter((p) => p.score != null);

  const flips = scored.filter((p) => {
    const a = move(p, p.prevDay);
    const b = move(p, p.w4);
    return a && b && a !== "flat" && b !== "flat" && a !== b;
  });
  for (const p of flips)
    notes.push(`${p.nameKo}: 직전 계산 대비 ${MOVE_KO[move(p, p.prevDay)!]} · 4주 전 대비 ${MOVE_KO[move(p, p.w4)!]} — 두 비교 시점의 방향이 다르다`);

  const withCov = scored.filter((p) => p.coverage != null);
  if (withCov.length) {
    const low = withCov.reduce((a, b) => ((b.coverage as number) < (a.coverage as number) ? b : a));
    notes.push(`반영률이 가장 낮은 항목: ${low.nameKo}`);
  }

  const w4moves = scored.map((p) => ({ p, m: move(p, p.w4) })).filter((x): x is { p: CommentaryPillar; m: Move } => x.m === "up" || x.m === "down");
  for (let i = 0; i < w4moves.length; i++)
    for (let j = i + 1; j < w4moves.length; j++) {
      const a = w4moves[i];
      const b = w4moves[j];
      notes.push(
        a.m === b.m
          ? `4주 전 대비 같은 방향(${MOVE_KO[a.m]}): ${a.p.nameKo} · ${b.p.nameKo}`
          : `4주 전 대비 반대 방향: ${a.p.nameKo}(${MOVE_KO[a.m]}) · ${b.p.nameKo}(${MOVE_KO[b.m]})`,
      );
    }

  for (const p of input.pillars.filter((x) => x.score == null)) notes.push(`${p.nameKo}: 자료가 모자라 점수를 내지 않았다`);
  if (!input.regimeConfirmed) notes.push("레짐은 확정 아님 — 「아직 국면이 바뀌었다고 보지 않습니다」로 쓴다");
  return notes;
}

/**
 * 사실표 — 프롬프트에 들어가는 **유일한 숫자 원천**. ID는 화면이 값을 다시 그릴 때 쓴다.
 * ⚠ 표시 형식(정수 점수 · % 반영률 · 정수 변화)이 곧 대조 기준이다.
 */
export function buildFacts(input: CommentaryInput): CommentaryFact[] {
  const facts: CommentaryFact[] = [
    { id: "run.asOf", label: "기준일", text: input.asOf },
    { id: "run.model", label: "모델 버전", text: input.modelVersion },
    { id: "regime.status", label: "레짐 판정 상태", text: input.regimeLabel ?? "자료 없음" },
    { id: "regime.confirmed", label: "레짐 확정 여부", text: input.regimeConfirmed ? "확정" : "확정 아님(점수가 나온 것과 별개)" },
  ];
  for (const p of input.pillars) {
    const base = `${p.pillar}.${p.axis}`;
    const name = `${p.nameKo} · ${AXIS_KO[p.axis] ?? p.axis}`;
    if (p.polarity) facts.push({ id: `${base}.polarity`, label: `${p.nameKo} 방향`, text: POLARITY_KO[p.polarity] });
    facts.push({
      id: `${base}.score`,
      label: `${name} 점수`,
      text: p.score == null ? "자료가 모자라 점수 없음" : `${round(p.score)}점(0~100)`,
    });
    if (p.score != null) facts.push({ id: `${base}.level`, label: `${p.nameKo} 수준`, text: levelWord(p.score) });
    if (p.coverage != null) facts.push({ id: `${base}.coverage`, label: `${p.nameKo} 반영률`, text: pct(p.coverage) });
    for (const [key, cmp, word] of [
      ["prev", p.prevDay, "직전 계산"],
      ["w4", p.w4, "4주 전"],
    ] as const) {
      if (cmp.kind === "missing") {
        facts.push({ id: `${base}.${key}`, label: `${p.nameKo} ${word} 비교`, text: MISSING_KO[cmp.reason] });
      } else if (p.score == null) {
        facts.push({ id: `${base}.${key}`, label: `${p.nameKo} ${word} 비교`, text: "지금 점수 없음" });
      } else {
        const d = round(p.score) - round(cmp.score);
        facts.push({
          id: `${base}.${key}`,
          label: `${p.nameKo} ${word}(${cmp.asOf}) 대비`,
          text: `${round(cmp.score)}점 → ${round(p.score)}점(${d > 0 ? "+" : ""}${d})`,
        });
      }
    }
  }
  return facts;
}

/** 사실표에 실제로 쓴 숫자·날짜·분수 — 대조 기준. */
export function allowedTokens(facts: CommentaryFact[], extra: string[] = []) {
  const numbers = new Set<number>();
  const dates = new Set<string>();
  const fractions = new Set<string>();
  for (const t of [...facts.map((f) => `${f.label} ${f.text}`), ...extra]) {
    for (const d of t.match(/\d{4}-\d{2}-\d{2}/g) ?? []) dates.add(d);
    for (const f of t.match(/\d+\/\d+/g) ?? []) fractions.add(f);
    for (const n of t.replace(/\d{4}-\d{2}-\d{2}/g, " ").match(/[+-]?\d+(?:\.\d+)?/g) ?? []) numbers.add(Math.abs(Number(n)));
  }
  return { numbers, dates, fractions };
}

/** 프롬프트에서 숫자로 허용하는 기간 표현(조류 1~12개월 등) — 사실표 밖이지만 용어 설명에 쓴다. */
const TERM_NUMBERS = ["1~12개월 1~13주 1~5일 0~100 4주"];

export function buildCommentaryPrompt(input: CommentaryInput): string {
  const facts = buildFacts(input);
  const notes = serverNotes(input);
  const research = input.research
    .map((r) => `- ${r.id} · ${r.title} · 검증 후보: ${r.candidate ?? "—"} · 한계: ${r.limit ?? "—"}`)
    .join("\n");
  return `당신은 글로벌 매크로 애널리스트입니다.
WoodsMan 포털에 「글로벌 자본 레짐 모니터」의 오늘 결과를 브리핑으로 올립니다.
독자는 투자를 시작한 지 2년쯤 된 개인 투자자입니다. 금리와 유동성이 무엇인지는 알지만, 전문 보고서는 읽지 않습니다.

== 성격 ==
리포트가 아니라 브리핑입니다. 짧고, 사실이 먼저 오고, 판단은 한 번만 겁니다. 오늘 달라진 것에 집중하십시오.
어휘는 쉽게, 판단은 깊게. "~로 사료된다", "제반 여건을 종합하면", "~할 여지가 있다"를 쓰지 마십시오.
권위는 판단을 걸고 그 판단이 틀릴 조건을 밝히는 데서 나옵니다. 숫자 하나를 깊게 해석하는 쪽이 낫습니다.

== 1. 사실표 읽는 법 ==
아래 사실표가 유일한 사실 출처입니다. 먼저 확인하십시오: (1) 점수가 실제로 있는 항목 (2) 비교 시점과 그 이름
(3) 항목별 방향(「방향」 줄) (4) 반영률 (5) 서버 메모 — 메모는 반드시 반영합니다. 사실표에 없는 것은 추론해서 채우지 말고 쓰지 마십시오.

== 2. 점수 방향 ==
1순위 — 사실표의 「방향」 줄이 최종입니다.
2순위 — 없으면: [우호형] 유동성, 금리 감내력, 엔진 출력, 달러 네트워크 지배력 / [긴장형] 시장위험·지정학, 위험 전이, 엔진 온도, 재정 우위 압력, 통화 규율 압력.
3순위 — 둘 다 없으면 방향을 추측하지 말고 「좋아졌다/나빠졌다」 없이 수치 변화만 쓰거나 다루지 마십시오.
방향을 틀리면 아무도 잡아내지 못한 채 독자에게 반대로 전달됩니다. 이 판단이 가장 중요합니다.

== 3. 점수를 말로 ==
사실표의 「수준」 줄의 말을 그대로 씁니다(홈 화면과 같은 말). 변화폭은 사실표의 변화값을 보고:
0~2 사실상 제자리 · 3~5 소폭 · 6~9 뚜렷하게 · 10~15 크게 · 16 이상 이례적으로 크게.

== 4. 비교 시점 ==
사실표가 붙인 이름(직전 계산, 4주 전)이나 날짜를 그대로 씁니다. 비교 시점 없는 변화 서술은 쓰지 마십시오.
두 비교 시점의 방향이 다르면 그 사실 자체를 한 문장으로 설명하십시오.

== 5. 숫자 규칙 (서버가 사실표와 대조합니다) ==
사실표에 있는 값만 그대로. 반올림·계산·어림 금지. 반영률을 분수로 풀지 마십시오(분모를 지어내는 것).
점수가 없는 항목에 숫자를 붙이지 마십시오.

== 6. 하지 말 것 ==
1. 사실표에 없는 숫자·사건·인과. 원인을 모르면 "무엇 때문인지는 이 숫자만으로 알 수 없습니다".
2. 본문과 근거에 같은 사실을 두 번.
3. "~점 올랐습니다/내렸습니다"로 문장을 끝내기.
4. "다시 본다", "지켜본다", "주목할 필요가 있다"로 끝내기 — 무엇이 어떻게 되면 판단이 어떻게 바뀌는지를 쓰십시오.
5. 내부 용어를 설명 없이(아래 변환표).
6. 투자 권유, 매수·매도 판단, 목표가.

== 7. 용어 ==
조류 → 첫 등장에 「조류(1~12개월 흐름)」, 이후 「조류」. 바람 → 「바람(1~13주 흐름)」. 파도 → 「파도(1~5일 반응)」.
기둥·발행·커버리지·INSUFFICIENT라는 말은 쓰지 않습니다(반영률 · 「자료가 모자라 점수를 내지 않았습니다」).
레짐 확정 아님 → 「아직 국면이 바뀌었다고 보지 않습니다」.
설명은 글 전체에서 최대 두 항목, 첫 등장에만: 위험 전이 — 한 곳의 충격이 다른 시장으로 옮겨붙는 정도 /
금리 감내력 — 지금 금리를 경제와 기업이 버틸 수 있는지 / 엔진 온도 — 경기가 과열 쪽인지 식는 쪽인지 /
달러 네트워크 지배력 — 달러가 세계 자금에서 갖는 영향력. 목록에 없는 항목은 이름만.

== 8. 출력 — JSON 하나 ==
{
  "regimeStatus": "사실표의 레짐 판정 상태를 글자 그대로",
  "verdict": "[1] 판정 — 한 문장, 25자 내외, 점수 없음",
  "paragraphs": ["[2] 첫 문단 3~4문장 — 가장 크게 움직인 것 하나에서", "둘째 문단 3~4문장 — 왜 아직 국면 전환이 아닌지(또는 왜 맞는지)"],
  "caveat": "[3] 단서 3~4문장 — 반대 방향·자료 부족 항목, 마지막 1~2문장은 반드시 「이 해석이 틀린다면 무엇 때문일지」",
  "triggers": ["[4] <관찰 대상>이 <조건>이면, <판단이 어떻게 바뀌는지> — 2~3개, 기준선은 사실표 값에서만"],
  "evidenceFactIds": ["[5] 본문에서 쓴 숫자의 사실 ID"],
  "card": "카드 2~3문장, 100~150자 — 판정 · 근거 항목 하나 · (있다면) 엇갈리는 신호 하나, 숫자 최대 2개",
  "researchIds": ["직접 관련된 연구가 있을 때만, 최대 2개 — 원인이나 점수의 근거로 쓰지 않습니다"]
}
문단당 숫자 2~3개까지. verdict~triggers 합계 공백 포함 600~900자.

== 9. 문체 ==
「~입니다/~합니다」체. 한 문장 50자 안팎. 같은 어미 세 번 연속 금지. 쉼표로 잇지 말고 끊기.
이모지·느낌표·과장(급등, 폭락, 심각한) 금지. 영어 용어는 첫 등장에 함께. 억지 한자어 금지.

== 10. 입력 — 오늘의 사실표 ==
${facts.map((f) => `- [${f.id}] ${f.label}: ${f.text}`).join("\n")}

서버 메모
${notes.map((n) => `- ${n}`).join("\n") || "- (없음)"}

관련 연구 후보
${research || "- (없음)"}

== 11. 자가 점검 ==
모든 숫자가 사실표에 그대로 있는가 · 방향을 말한 항목은 「방향」 줄에 근거가 있는가 · 변화마다 비교 시점을 밝혔는가 ·
서버 메모를 반영했는가 · 「지켜본다」로 끝난 항목이 없는가 · 단서의 마지막 두 문장이 형식적이지 않은가 · 900자를 넘지 않았는가.`;
}

const FORBIDDEN = /(매수|매도|사세요|파세요|팔아야|사야|비중을 늘|비중을 줄|목표주가|목표가|지금이 기회|반드시 오른|반드시 내린)/;
const STYLE_BANNED = /(사료된다|제반 여건|여지가 있다|급등|폭락|심각한|!)/;
const INTERNAL_TERMS = /(기둥|발행|커버리지|INSUFFICIENT|pillar|published)/i;
const WEAK_ENDING = /(다시 본다|다시 봅니다|지켜본다|지켜봅니다|주목할 필요가 있다|주목할 필요가 있습니다)[.。]?\s*$/;

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
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter(isStr).map((s) => s.trim()) : []);

/** 브리핑 글자 수(판정 + 본문 + 단서 + 다시 볼 조건, 공백 포함) */
export function briefLength(b: Pick<CommentaryBody, "verdict" | "paragraphs" | "caveat" | "triggers">): number {
  return [b.verdict, ...b.paragraphs, b.caveat, ...b.triggers].join("").length;
}

/** 문단당 데이터 숫자 상한 — 문서는 2~3개. 「점」「%」이 붙은 숫자만 센다(「4주 전」 같은 기간은 세지 않는다). */
export const PARAGRAPH_NUMBER_MAX = 4;
export function dataNumberCount(text: string): number {
  return (text.match(/\d+(?:\.\d+)?\s*(점|%)/g) ?? []).length;
}

/** 「52점에서 62점으로 10점 올랐습니다.」처럼 점수 변화로 끝나는 문장(문서 규칙 6-3). */
const SCORE_ENDING = /\d+\s*점\s*(?:올랐|내렸|상승했|하락했|높아졌|낮아졌)습니다[.。]?(?=\s|$)/;

/**
 * 조건(triggers)의 숫자는 **그 조건이 부르는 항목의 사실**이어야 한다.
 * 2026-11-14 첫 v2 초안: 「유동성이 … 50점 아래에 머물면」 — 50은 달러 네트워크 점수였다(사실표 어딘가에 있어 전역 대조는 통과).
 * 항목 이름이 하나도 없으면 전역 대조에 맡긴다.
 */
export function triggerStrayNumbers(trigger: string, input: CommentaryInput, facts: CommentaryFact[]): string[] {
  const named = input.pillars.filter((p) => trigger.includes(p.nameKo) || trigger.includes(p.nameKo.replace(/ 지배력$/, "")));
  if (named.length === 0) return [];
  const own = facts.filter((f) => named.some((p) => f.id.startsWith(`${p.pillar}.`)));
  const { numbers } = allowedTokens(own, TERM_NUMBERS);
  const out: string[] = [];
  for (const n of trigger.replace(/\d{4}-\d{2}-\d{2}/g, " ").match(/[+-]?\d+(?:\.\d+)?/g) ?? []) {
    if (!numbers.has(Math.abs(Number(n)))) out.push(n);
  }
  return [...new Set(out)];
}

/** 길이 관문 — 문서는 600~900자. 조금 넘친 것까지 버리지 않도록 여유를 둔다(실패는 크게 벗어난 것만). */
export const BRIEF_MIN = 400;
export const BRIEF_MAX = 1000;

/**
 * AI 답을 읽고 대조한다. 통과하면 본문, 아니면 **모든** 문제를 돌려준다.
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
  const verdict = isStr(o.verdict) ? o.verdict.trim() : "";
  if (!verdict) problems.push("판정(verdict)이 비었습니다.");
  else if (/\d/.test(verdict)) problems.push("판정에는 숫자를 넣지 않습니다.");
  const paragraphs = strs(o.paragraphs);
  if (paragraphs.length !== 2) problems.push(`본문은 2문단이어야 합니다(${paragraphs.length}).`);
  const caveat = isStr(o.caveat) ? o.caveat.trim() : "";
  if (!caveat) problems.push("단서(caveat)가 비었습니다.");
  const triggers = strs(o.triggers);
  if (triggers.length < 2 || triggers.length > 3) problems.push(`「이렇게 되면 다시 봅니다」는 2~3개여야 합니다(${triggers.length}).`);
  for (const t of triggers) if (WEAK_ENDING.test(t)) problems.push(`조건이 「지켜본다」류로 끝납니다: ${t.slice(0, 40)}`);
  const card = isStr(o.card) ? o.card.trim() : "";
  if (!card) problems.push("카드(card)가 비었습니다.");
  else if (card.length > 220) problems.push(`카드가 깁니다(${card.length}자 · 150자 안팎).`);

  const evidenceFactIds = strs(o.evidenceFactIds);
  if (evidenceFactIds.length === 0) problems.push("근거 숫자(evidenceFactIds)가 없습니다.");
  const unknownIds = evidenceFactIds.filter((id) => !factIds.has(id));
  if (unknownIds.length) problems.push(`근거 ID가 사실표에 없습니다: ${unknownIds.join(", ")}`);

  const rIds = strs(o.researchIds);
  if (rIds.length > 2) problems.push("연구는 최대 2편입니다.");
  const badR = rIds.filter((id) => !researchIds.has(id));
  if (badR.length) problems.push(`입력에 없는 연구 ID: ${badR.join(", ")}`);

  const len = briefLength({ verdict, paragraphs, caveat, triggers });
  if (len < BRIEF_MIN || len > BRIEF_MAX) problems.push(`브리핑 길이 ${len}자 — ${BRIEF_MIN}~${BRIEF_MAX}자를 벗어났습니다(목표 600~900자).`);

  // ⭐ 숫자·날짜·분수 대조 — 글에 나온 것은 모두 사실표(또는 용어 설명의 기간 표현)에 있어야 한다
  const texts = [verdict, ...paragraphs, caveat, ...triggers, card].filter(Boolean);
  const { numbers, dates, fractions } = allowedTokens(facts, TERM_NUMBERS);
  const strayNumbers = new Set<string>();
  const strayDates = new Set<string>();
  const strayFractions = new Set<string>();
  for (const t of texts) {
    for (const d of t.match(/\d{4}-\d{2}-\d{2}/g) ?? []) if (!dates.has(d)) strayDates.add(d);
    for (const f of t.replace(/\d{4}-\d{2}-\d{2}/g, " ").match(/\d+\/\d+/g) ?? []) if (!fractions.has(f)) strayFractions.add(f);
    for (const n of t.replace(/\d{4}-\d{2}-\d{2}/g, " ").match(/[+-]?\d+(?:\.\d+)?/g) ?? []) {
      if (!numbers.has(Math.abs(Number(n)))) strayNumbers.add(n);
    }
    const bad = t.match(FORBIDDEN);
    if (bad) problems.push(`권유·단정 표현: 「${bad[0]}」`);
    const style = t.match(STYLE_BANNED);
    if (style) problems.push(`쓰지 않기로 한 표현: 「${style[0]}」`);
    const internal = t.match(INTERNAL_TERMS);
    if (internal) problems.push(`내부 용어: 「${internal[0]}」`);
  }
  // v2 규칙을 서버에서도 — 2026-11-14 첫 v2 초안에서 셋 다 새어 나왔다
  for (const [i, p] of paragraphs.entries()) {
    const n = dataNumberCount(p);
    if (n > PARAGRAPH_NUMBER_MAX) problems.push(`본문 ${i + 1}문단에 숫자가 ${n}개 — 문단당 2~3개(최대 ${PARAGRAPH_NUMBER_MAX})`);
  }
  for (const t of texts) {
    const end = t.match(SCORE_ENDING);
    if (end) problems.push(`「~점 올랐/내렸습니다」로 끝나는 문장: 「${end[0].trim()}」`);
  }
  for (const t of triggers) {
    const stray = triggerStrayNumbers(t, input, facts);
    if (stray.length) problems.push(`조건의 기준선이 그 항목의 사실이 아닙니다: ${stray.join(", ")} — 「${t.slice(0, 40)}」`);
  }

  if (strayNumbers.size) problems.push(`사실표에 없는 숫자: ${[...strayNumbers].join(", ")}`);
  if (strayDates.size) problems.push(`사실표에 없는 날짜: ${[...strayDates].join(", ")}`);
  if (strayFractions.size) problems.push(`사실표에 없는 분수: ${[...strayFractions].join(", ")}`);

  if (problems.length) return { ok: false, problems: [...new Set(problems)] };
  return {
    ok: true,
    body: { regimeStatus: expectedStatus, verdict, paragraphs, caveat, triggers, evidenceFactIds, card, researchIds: rIds },
  };
}

/** 비교값 만들기 — 같은 모델 버전 · 점수가 있을 때만 숫자. */
export function compareValue(
  other: { asOf: string; modelVersion: string; score: number | null } | undefined,
  currentModelVersion: string,
): CompareValue {
  if (!other) return { kind: "missing", reason: "NO_RUN", detail: "비교 시점의 계산이 없다" };
  if (other.modelVersion !== currentModelVersion)
    return { kind: "missing", reason: "VERSION_CHANGED", detail: `${other.modelVersion} → ${currentModelVersion}` };
  if (other.score == null || !Number.isFinite(other.score))
    return { kind: "missing", reason: "NOT_PUBLISHED", detail: `${other.asOf}에 점수가 없다` };
  return { kind: "value", asOf: other.asOf, score: other.score };
}

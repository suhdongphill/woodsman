/**
 * 「오늘의 브리핑」 AI 재편집 — 순수 함수 (2026-10-31, 운영자 「AI를 활용해서 재편집해서 등록」).
 *
 * ## 무엇을 AI에 맡기나
 * **문장만** 다듬는다 — 제목·리드·본문 문단·「확인할 것」. 표·목록·출처는 건드리지 않는다(넘기지도 않는다).
 * SNS 출처를 지우는 일은 이미 `article.ts`가 규칙으로 끝냈다. AI는 그 결과만 받는다.
 *
 * ## ⚠ 숫자는 기계가 대조한다
 * 브리핑에서 가장 위험한 것은 **숫자가 바뀌는 것**이다(바뀐 숫자는 화면에서 멀쩡해 보인다).
 * 그래서 문단마다 「AI가 쓴 글의 숫자 ⊆ 원문의 숫자」를 검사하고, 어기면 **그 문단만 원문을 쓴다**.
 * 길이가 크게 달라지거나(사실을 지웠거나 지어냈다) SNS 흔적이 생겨도 마찬가지다.
 * 무엇을 되돌렸는지는 `rejected`로 돌려줘 관리자 미리보기에 보인다 — 조용히 고치지 않는다.
 */
import { hasSns, type BriefingArticle, type BriefingBlock } from "./article";

export type EditItem = { id: string; kind: "headline" | "summary" | "title" | "p" | "watch"; text: string };

/** 기사에서 AI가 다듬을 문장들을 꺼낸다. id는 자리(`s2.b3`)라 되돌려 꽂을 수 있다. */
export function editableItems(article: BriefingArticle): EditItem[] {
  const items: EditItem[] = [{ id: "headline", kind: "headline", text: article.headline }];
  article.summary.forEach((text, i) => items.push({ id: `sum${i}`, kind: "summary", text }));
  article.sections.forEach((s, si) => {
    items.push({ id: `s${si}.title`, kind: "title", text: s.title });
    s.blocks.forEach((b, bi) => {
      if (b.t === "p" || b.t === "watch") items.push({ id: `s${si}.b${bi}`, kind: b.t, text: b.text });
    });
  });
  return items;
}

/** 글 속의 숫자들 — 쉼표를 뗀 꼴로. `1조6,167억` → `1`, `6167`. */
export function numbersIn(text: string): string[] {
  return (text.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((n) => n.replace(/,/g, ""));
}

/** 원문에 없는 숫자. 비어 있어야 통과다. */
export function introducedNumbers(original: string, edited: string): string[] {
  const allowed = new Set(numbersIn(original));
  return [...new Set(numbersIn(edited).filter((n) => !allowed.has(n)))];
}

/** 길이 허용 범위 — 원문 대비. 짧은 제목은 넉넉히 본다. */
function lengthOk(original: string, edited: string): boolean {
  const o = original.length;
  const e = edited.length;
  if (o < 30) return e > 0 && e <= o * 2 + 20;
  return e >= o * 0.5 && e <= o * 1.6;
}

export type Rejection = { id: string; reason: string };

/** 한 문장의 판정 — 통과면 `null`, 아니면 이유. */
export function judgeEdit(original: string, edited: string): string | null {
  if (!edited.trim()) return "비어 있음";
  const extra = introducedNumbers(original, edited);
  if (extra.length) return `원문에 없는 숫자: ${extra.join(", ")}`;
  if (hasSns(edited)) return "SNS 흔적이 생김";
  if (!lengthOk(original, edited)) return `길이가 크게 달라짐(${original.length} → ${edited.length}자)`;
  if (/\(미확인\)/.test(original) && !/미확인|확인되지/.test(edited)) return "「미확인」 표시를 지움";
  return null;
}

/** 모델에 줄 본문. ⚠ 지시는 페르소나(`briefing-edit`)가 하고, 여기는 재료만 준다. */
export function buildRewritePrompt(items: EditItem[]): string {
  return `아래 JSON 배열의 각 항목 text를 다듬어, {"id": "다듬은 글"} 꼴의 JSON 객체 하나로만 답하세요.
모든 id를 빠짐없이 돌려주세요. 설명이나 코드 블록 표시는 쓰지 마세요.

${JSON.stringify(items, null, 1)}`;
}

/** 모델 답 → {id: text}. 코드 블록·앞뒤 말을 걷어 낸다. 읽지 못하면 `null`. */
export function parseRewriteResponse(text: string): Record<string, string> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const obj = JSON.parse(text.slice(start, end + 1)) as unknown;
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) if (typeof v === "string") out[k] = v.trim();
    return out;
  } catch {
    return null;
  }
}

/**
 * 다듬은 글을 기사에 되꽂는다. 판정에 걸린 문장·빠진 id는 **원문 그대로** 두고 `rejected`에 적는다.
 * ⚠ 원본 기사를 바꾸지 않는다(새 객체를 낸다).
 */
export function applyRewrite(
  article: BriefingArticle,
  edits: Record<string, string>,
): { article: BriefingArticle; accepted: number; rejected: Rejection[] } {
  const rejected: Rejection[] = [];
  let accepted = 0;
  const pick = (id: string, original: string): string => {
    const edited = edits[id];
    if (edited === undefined) {
      rejected.push({ id, reason: "답에 없음" });
      return original;
    }
    const why = judgeEdit(original, edited);
    if (why) {
      rejected.push({ id, reason: why });
      return original;
    }
    accepted += 1;
    return edited;
  };

  const next: BriefingArticle = {
    ...article,
    headline: pick("headline", article.headline),
    summary: article.summary.map((t, i) => pick(`sum${i}`, t)),
    sections: article.sections.map((s, si) => ({
      title: pick(`s${si}.title`, s.title),
      blocks: s.blocks.map((b, bi): BriefingBlock => {
        if (b.t === "p" || b.t === "watch") return { ...b, text: pick(`s${si}.b${bi}`, b.text) };
        return b;
      }),
    })),
  };
  return { article: next, accepted, rejected };
}

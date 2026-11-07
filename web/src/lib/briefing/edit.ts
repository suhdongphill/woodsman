/**
 * 「오늘의 브리핑」 사람 수정 — 순수 함수 (2026-11-07, 운영자 「수정할 수 있도록 관리자 화면을 개선」).
 *
 * 올린 뒤 고칠 길이 다시 올리기(AI가 전부 다시 다듬음)뿐이었다. 오타 하나에 글 전체가 바뀌면 안 되므로
 * 저장된 기사(JSON)를 **칸별로** 고친다. 원고 원문은 DB에 없고(SNS 출처) 앞으로도 두지 않는다.
 *
 * ## ⚠ 사람이 고쳐도 관문은 같다
 * - `articleProblems` — SNS 흔적 · 빈 제목 · 빈 본문이면 저장하지 않는다.
 * - **고지(`notices`)는 저장된 값을 그대로 쓴다** — 화면에 칸이 없고, 요청에 실려 와도 받지 않는다(AI 활용 고지).
 * - **날짜는 저장된 값**이다. 날짜가 바뀌면 다른 날의 글을 덮게 된다.
 *
 * ## 숫자는 막지 않고 알린다
 * AI와 달리 사람은 숫자를 고칠 권한이 있다(정정이 수정의 이유다). 대신 **새로 생긴 숫자를 저장 결과에 보여 준다** —
 * 잘못 친 숫자는 화면에서 멀쩡해 보이기 때문이다.
 */
import { articleProblems, articleText, type BriefingArticle, type BriefingBlock, type BriefingSection } from "./article";
import { introducedNumbers } from "./rewrite";

/** 수정 요청에서 받는 칸 — 날짜·고지는 없다. */
export type BriefingEdit = Omit<BriefingArticle, "date" | "notices">;

const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

function validBlock(v: unknown): v is BriefingBlock {
  if (!v || typeof v !== "object") return false;
  const b = v as Record<string, unknown>;
  switch (b.t) {
    case "p":
    case "h3":
    case "watch":
      return typeof b.text === "string";
    case "ul":
    case "src":
      return isStringArray(b.items);
    case "table":
      return isStringArray(b.head) && Array.isArray(b.rows) && b.rows.every(isStringArray);
    default:
      return false;
  }
}

/** 요청 본문 → 수정 칸. 모양이 다르면 `null`(추측해서 고치지 않는다). */
export function parseEditedArticle(json: string): BriefingEdit | null {
  let v: unknown;
  try {
    v = JSON.parse(json);
  } catch {
    return null;
  }
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const a = v as Record<string, unknown>;
  if (typeof a.headline !== "string") return null;
  if (!isStringArray(a.summary) || !isStringArray(a.basis) || !isStringArray(a.sources)) return null;
  if (a.closing !== undefined && typeof a.closing !== "string") return null;
  if (!Array.isArray(a.sections)) return null;
  for (const s of a.sections) {
    if (!s || typeof s !== "object") return null;
    const sec = s as Record<string, unknown>;
    if (typeof sec.title !== "string" || !Array.isArray(sec.blocks) || !sec.blocks.every(validBlock)) return null;
  }
  return {
    headline: a.headline,
    summary: a.summary,
    basis: a.basis,
    sources: a.sources,
    closing: a.closing as string | undefined,
    sections: a.sections as BriefingSection[],
  };
}

const cleanList = (items: string[]) => items.map((s) => s.trim()).filter(Boolean);

/** 칸을 비우면 그 블록을 뺀다 — 화면에 빈 문단이 남지 않게. */
function cleanBlock(block: BriefingBlock): BriefingBlock | null {
  switch (block.t) {
    case "p":
    case "h3":
    case "watch": {
      const text = block.text.trim();
      return text ? { ...block, text } : null;
    }
    case "ul":
    case "src": {
      const items = cleanList(block.items);
      return items.length ? { ...block, items } : null;
    }
    case "table": {
      const rows = block.rows.map((row) => row.map((c) => c.trim())).filter((row) => row.some(Boolean));
      return rows.length ? { t: "table", head: block.head.map((h) => h.trim()), rows } : null;
    }
  }
}

export type EditOutcome =
  | { ok: false; problems: string[] }
  | { ok: true; article: BriefingArticle; newNumbers: string[]; changed: boolean };

/**
 * 고친 값을 저장할 기사로 만든다. ⚠ 원본을 바꾸지 않는다.
 * 날짜·고지는 `stored`에서 가져온다 — 수정 요청이 바꿀 수 없다.
 */
export function applyHumanEdit(stored: BriefingArticle, edited: BriefingEdit): EditOutcome {
  const sections: BriefingSection[] = edited.sections.flatMap((s) => {
    const blocks = s.blocks.map(cleanBlock).filter((b): b is BriefingBlock => !!b);
    const title = s.title.trim();
    return !title && blocks.length === 0 ? [] : [{ title, blocks }];
  });

  const closing = edited.closing?.trim() || undefined;
  const article: BriefingArticle = {
    date: stored.date,
    headline: edited.headline.trim(),
    summary: cleanList(edited.summary),
    basis: cleanList(edited.basis),
    sections,
    ...(closing ? { closing } : {}),
    sources: cleanList(edited.sources),
    notices: stored.notices,
  };

  const problems = articleProblems(article);
  if (sections.some((s) => !s.title)) problems.push("제목이 빈 절이 있습니다. 제목을 쓰거나 그 절의 내용을 모두 비우세요.");
  if (problems.length) return { ok: false, problems };

  return {
    ok: true,
    article,
    // ⚠ 전체 글에서 처음 나타나는 숫자만 — 사람이 확인할 짧은 목록이어야 읽힌다.
    newNumbers: introducedNumbers(articleText(stored), articleText(article)),
    changed: canonical(stored) !== canonical(article),
  };
}

/** 칸 순서와 무관하게 내용만 비교한다(저장된 JSON의 키 순서가 달라도 「고친 것 없음」이 맞도록). */
function canonical(a: BriefingArticle): string {
  return JSON.stringify([a.headline, a.summary, a.basis, a.sections, a.closing ?? "", a.sources]);
}

/** 사람이 고친 글의 편집자 표시 — `ai:모델` → `ai:모델+사람`. 여러 번 고쳐도 한 번만 붙는다. */
export function editorAfterHumanEdit(editor: string): string {
  return editor.endsWith("+사람") ? editor : `${editor}+사람`;
}

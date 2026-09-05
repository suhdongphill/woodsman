/**
 * HTML → 사람이 읽는 텍스트. **순수 함수.**
 *
 * ## 왜 필요한가
 * AI에게 지표값을 뽑게 할 때 **모델이 기억하는 숫자를 쓰게 두면 안 된다.** 서버가 페이지를
 * 직접 받아서 그 텍스트만 주고, 그 안에서만 찾게 한다. 그러려면 태그·스크립트를 걷어낸
 * 본문이 필요하다.
 *
 * ⚠ 잘라내는 순서가 중요하다. 태그부터 지우면 `<script>` 안의 코드가 본문으로 남는다.
 * ⚠ 길이를 자른다. 모델 컨텍스트와 요금 양쪽 문제이고, 지표값은 대개 문서 앞부분에 있다.
 */

/** 모델에 넘길 최대 길이(자). 넘으면 앞에서 자른다. */
export const MAX_PAGE_CHARS = 12_000;

const ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
};

export function decodeEntities(text: string): string {
  return text
    .replace(/&(?:nbsp|amp|lt|gt|quot|apos|#39);/g, (m) => ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));
}

export function htmlToText(html: string, maxChars: number = MAX_PAGE_CHARS): string {
  const body = html
    // ⚠ 먼저 통째로 버릴 것부터. 태그만 지우면 스크립트 본문이 글로 남는다.
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    // 줄바꿈이 의미를 갖는 태그는 줄바꿈으로 바꾼다(표·목록이 한 줄로 뭉치지 않게).
    .replace(/<\/(p|div|tr|li|h[1-6]|section|article)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  const text = decodeEntities(body)
    .replace(/[ \t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n")
    .trim();

  return text.length > maxChars ? text.slice(0, maxChars) : text;
}

/**
 * 인용문이 원문에 실제로 있는가 — **환각을 막는 마지막 관문.**
 *
 * ⚠ 공백·줄바꿈만 다른 경우를 통과시킨다(모델은 줄바꿈을 자주 흘린다).
 *   그 외의 한 글자라도 다르면 **없는 것으로 본다** — 느슨하게 맞추기 시작하면
 *   "비슷한 문장을 지어내도 통과하는" 검사가 된다.
 */
export function containsQuote(pageText: string, quote: string): boolean {
  const norm = (s: string) => s.replace(/\s+/g, " ").trim();
  const needle = norm(quote);
  if (needle.length < 8) return false;
  return norm(pageText).includes(needle);
}

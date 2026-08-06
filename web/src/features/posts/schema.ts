/**
 * 콘텐츠 입력 검증 + 본문 렌더 — 순수 모듈.
 *
 * ⚠ 저장 경로는 **하나뿐이다**: 원본(`body`) → 형식에 따라 변환 → 정화 → `bodyHtml`.
 *    HTML을 직접 넣는 샛길을 만들지 않는다. 샛길이 생기는 순간 정화되지 않은 HTML이
 *    화면에 꽂힌다.
 */
import { z } from "zod";
import { markdownToHtml, toPlainText } from "@/lib/markdown";
import { sanitizeHtml } from "@/lib/sanitize-html";
import type { PostFormat } from "@/lib/types";

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

/** 주소에 그대로 들어가는 값이라 영문·숫자·하이픈만 받는다. */
const slug = z
  .string()
  .trim()
  .min(2, "주소(slug)를 입력하세요.")
  .max(80, "주소가 너무 깁니다.")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "주소는 영문 소문자·숫자·하이픈만 쓸 수 있습니다.");

export const postSchema = z
  .object({
    slug,
    title: z.string().trim().min(2, "제목을 입력하세요.").max(160, "제목이 너무 깁니다."),
    type: z.enum(["INSIGHT", "ANALYSIS", "NOTICE"]),
    section: z.enum(["HOME", "MACRO", "PORTFOLIO", "JOURNAL", "INSIGHT"]),
    category: optionalText,
    excerpt: z
      .string()
      .trim()
      .transform((v) => (v === "" ? undefined : v))
      .refine((v) => v === undefined || v.length <= 300, "요약이 너무 깁니다.")
      .optional(),
    body: z
      .string()
      .transform((v) => (v.trim() === "" ? undefined : v))
      .refine((v) => v === undefined || v.length <= 60_000, "본문이 너무 깁니다.")
      .optional(),
    format: z.enum(["MARKDOWN", "HTML"]),
    source: z.enum(["SELF", "TISTORY"]),
    externalUrl: z
      .string()
      .trim()
      .transform((v) => (v === "" ? undefined : v))
      .refine((v) => v === undefined || /^https?:\/\//.test(v), "링크는 http(s)로 시작해야 합니다.")
      .optional(),
    ticker: optionalText,
    tags: optionalText,
    commentsEnabled: z.boolean(),
    published: z.boolean(),
  })
  .refine((v) => v.source !== "TISTORY" || !!v.externalUrl, {
    // ⚠ 티스토리 글은 원문이 정본이다. 링크가 없으면 유입도 없고 중복 콘텐츠만 남는다.
    message: "티스토리 글에는 원문 링크가 필요합니다.",
    path: ["externalUrl"],
  });

export type PostFormValues = z.infer<typeof postSchema>;

/**
 * 원본 → 화면 HTML.
 *
 * 마크다운이면 변환한 뒤 정화하고, HTML이면 바로 정화한다.
 * **어느 쪽이든 정화를 거친다** — 마크다운 안에도 raw HTML을 섞을 수 있다.
 */
export function renderBody(body: string | undefined, format: PostFormat): string | undefined {
  if (!body || !body.trim()) return undefined;
  const html = format === "MARKDOWN" ? markdownToHtml(body) : body;
  return sanitizeHtml(html);
}

/** 요약을 안 적었으면 본문 앞부분으로 만든다 — 목록·검색결과가 비면 안 된다. */
export function deriveExcerpt(
  excerpt: string | undefined,
  bodyHtml: string | undefined,
): string | undefined {
  if (excerpt) return excerpt;
  return bodyHtml ? toPlainText(bodyHtml, 160) : undefined;
}

/** 제목에서 주소 후보를 만든다(한글 제목이면 비어 나올 수 있어 화면이 안내한다). */
export function suggestSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[가-힣]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "입력값을 확인하세요.";
}

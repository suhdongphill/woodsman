"use client";

/**
 * 콘텐츠 편집기 — **기본은 보이는 화면, 필요할 때 마크다운·HTML로 내려간다.**
 *
 * ## 왜 세 모드인가
 * 글을 쓰는 사람은 대개 **결과**를 보며 쓰고 싶어 한다. 그래서 기본 탭이 "보기"다.
 * 다만 표·각주처럼 손으로 만져야 하는 순간이 오고, 그때 형식을 골라 직접 고칠 수 있어야 한다.
 *
 * - **보기** — 저장되면 독자에게 보일 그대로. 편집은 못 한다(읽는 자리).
 * - **마크다운** — 평소 쓰는 자리. 저장할 때 HTML로 변환된다.
 * - **HTML** — 손으로 짜야 할 때. 허용 목록으로 정화된다.
 *
 * ⚠ 미리보기는 서버 저장과 **같은 함수**(`markdownToHtml` → `sanitizeHtml`)를 쓴다.
 *    미리보기 전용 렌더러를 따로 두면 "미리보기와 실제가 다른" 사고가 난다.
 * ⚠ 형식을 마크다운 → HTML로 바꾸면 **본문을 변환해서 넘긴다**(내용을 잃지 않게).
 *    반대 방향은 되돌릴 수 없어 경고만 하고 글자를 그대로 둔다.
 */
import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { savePostAction } from "../actions";
import { emptyPostFormState } from "../form-state";
import { markdownToHtml } from "@/lib/markdown";
import { sanitizeHtml } from "@/lib/sanitize-html";
import type { Post, PostFormat, PostSection } from "@/lib/types";

const SECTIONS: { value: PostSection; label: string; hint: string }[] = [
  { value: "INSIGHT", label: "인사이트", hint: "/insights 목록에 쌓입니다" },
  { value: "HOME", label: "홈", hint: "홈 아래쪽 '기록' 프레임에 쌓입니다" },
  { value: "MACRO", label: "거시 지표", hint: "/macro 아래 해설 프레임에 쌓입니다" },
  { value: "PORTFOLIO", label: "포트폴리오", hint: "/portfolio 아래 프레임에 쌓입니다" },
  { value: "JOURNAL", label: "투자일지", hint: "/journal 아래 프레임에 쌓입니다" },
];

const TYPES = [
  { value: "INSIGHT", label: "인사이트" },
  { value: "ANALYSIS", label: "종목분석" },
  { value: "NOTICE", label: "공지" },
] as const;

const field =
  "w-full bg-[#12141c] border border-border rounded-xl px-3 py-2 text-[13px] text-white placeholder:text-gray-600";
const label = "block text-[11px] text-muted mb-1";

type Mode = "preview" | "MARKDOWN" | "HTML";

export function PostEditor({ post }: { post?: Post }) {
  const [state, formAction, pending] = useActionState(savePostAction, emptyPostFormState);

  const [format, setFormat] = useState<PostFormat>(post?.format ?? "MARKDOWN");
  const [mode, setMode] = useState<Mode>("preview");
  const [body, setBody] = useState(post?.body ?? "");
  const [warning, setWarning] = useState<string | null>(null);

  /** 저장될 것과 같은 결과 */
  const previewHtml = useMemo(
    () => sanitizeHtml(format === "MARKDOWN" ? markdownToHtml(body) : body),
    [body, format],
  );

  function switchTo(next: Mode) {
    if (next === "preview" || next === format) {
      setMode(next);
      return;
    }

    if (format === "MARKDOWN" && next === "HTML") {
      // 잃지 않게 변환해서 넘긴다.
      setBody(markdownToHtml(body));
      setFormat("HTML");
      setWarning("마크다운을 HTML로 바꿔 두었습니다. 이제 HTML 그대로 저장됩니다.");
    } else if (format === "HTML" && next === "MARKDOWN") {
      setFormat("MARKDOWN");
      setWarning(
        "HTML은 마크다운으로 되돌릴 수 없습니다. 본문은 그대로 두었지만, 이대로 저장하면 태그가 글자로 보일 수 있습니다.",
      );
    }
    setMode(next);
  }

  const tabs: { key: Mode; label: string }[] = [
    { key: "preview", label: "보기" },
    { key: "MARKDOWN", label: "마크다운" },
    { key: "HTML", label: "HTML" },
  ];

  return (
    <form action={formAction} className="space-y-4">
      {post && <input type="hidden" name="id" value={post.id} />}
      {/* 본문과 형식은 상태에서 넘긴다(탭을 옮겨도 값이 살아 있게) */}
      <input type="hidden" name="body" value={body} />
      <input type="hidden" name="format" value={format} />

      <div className="grid gap-3 sm:grid-cols-6">
        <label className="sm:col-span-4">
          <span className={label}>제목</span>
          <input name="title" defaultValue={post?.title} className={field} />
        </label>
        <label className="sm:col-span-2">
          <span className={label}>주소 (영문·숫자·하이픈)</span>
          <input
            name="slug"
            defaultValue={post?.slug}
            placeholder="rate-cut-2026"
            className={field}
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <label>
          <span className={label}>유형</span>
          <select name="type" defaultValue={post?.type ?? "INSIGHT"} className={field}>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={label}>쌓일 자리(섹션)</span>
          <select name="section" defaultValue={post?.section ?? "INSIGHT"} className={field}>
            {SECTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label} — {s.hint}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={label}>분류</span>
          <input
            name="category"
            defaultValue={post?.category}
            placeholder="포트폴리오 전략"
            className={field}
          />
        </label>
        <label>
          <span className={label}>태그 (쉼표)</span>
          <input name="tags" defaultValue={post?.tags} placeholder="금리,침체" className={field} />
        </label>
      </div>

      <label className="block">
        <span className={label}>요약 — 비우면 본문 앞부분이 들어갑니다</span>
        <textarea name="excerpt" rows={2} defaultValue={post?.excerpt} className={field} />
      </label>

      {/* ── 본문: 보기 / 마크다운 / HTML ── */}
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className={label + " mb-0"}>본문</span>
          <div
            role="tablist"
            aria-label="본문 편집 방식"
            className="flex gap-1 rounded-lg border border-border bg-[#12141c] p-1"
          >
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={mode === t.key}
                onClick={() => switchTo(t.key)}
                className={`rounded-md px-3 py-1 text-[12px] transition-colors ${
                  mode === t.key
                    ? "bg-gold-600/90 font-medium text-black"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-gray-600">
            저장 형식: {format === "MARKDOWN" ? "마크다운" : "HTML"}
          </span>
        </div>

        {warning && (
          <p className="mb-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-[12px] text-yellow-200">
            {warning}
          </p>
        )}

        {mode === "preview" ? (
          <div className="rounded-xl border border-border bg-[#12141c] p-5">
            {previewHtml ? (
              <div
                className="prose-woodsman text-[14px] leading-relaxed text-gray-200"
                // 서버 저장과 같은 정화를 거친 결과다.
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            ) : (
              <p className="text-[13px] text-gray-500">
                본문이 비어 있습니다. 위에서 마크다운이나 HTML을 골라 쓰면 여기에 보일 모습이
                그대로 나옵니다.
              </p>
            )}
          </div>
        ) : (
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={18}
            spellCheck={false}
            placeholder={
              mode === "MARKDOWN"
                ? "## 소제목\n\n**굵게**, *기울임*, [링크](https://…)\n\n- 목록\n- 목록"
                : "<h2>소제목</h2>\n<p>문단</p>"
            }
            className={`${field} font-mono text-[12.5px] leading-relaxed`}
          />
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <label>
          <span className={label}>출처</span>
          <select name="source" defaultValue={post?.source ?? "SELF"} className={field}>
            <option value="SELF">직접 작성</option>
            <option value="TISTORY">티스토리 원문</option>
          </select>
        </label>
        <label className="sm:col-span-2">
          <span className={label}>티스토리 원문 링크</span>
          <input
            name="externalUrl"
            defaultValue={post?.externalUrl}
            placeholder="https://suhdp.tistory.com/…"
            className={field}
          />
        </label>
        <label>
          <span className={label}>연결 종목</span>
          <input name="ticker" defaultValue={post?.ticker} className={field} />
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-3">
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-[12.5px] text-gray-300">
            <input
              type="checkbox"
              name="published"
              defaultChecked={post?.published ?? false}
              className="h-4 w-4 accent-emerald-500"
            />
            발행 (공개 화면에 노출)
          </label>
          <label className="flex items-center gap-2 text-[12.5px] text-gray-300">
            <input
              type="checkbox"
              name="commentsEnabled"
              defaultChecked={post?.commentsEnabled ?? true}
              className="h-4 w-4 accent-emerald-500"
            />
            댓글 허용
          </label>
        </div>

        <div className="flex items-center gap-3">
          {state.error && (
            <span role="alert" className="text-[12px] text-red-400">
              {state.error}
            </span>
          )}
          {state.savedAt && !state.error && (
            <span className="text-[12px] text-emerald-400">
              저장했습니다{state.published ? " · 공개됨" : " · 작성중"}
            </span>
          )}
          {post && (
            <Link
              href="/admin/posts"
              className="rounded-xl border border-border px-3 py-2 text-[13px] text-gray-300 transition-colors hover:bg-cardHover"
            >
              목록으로
            </Link>
          )}
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-gold-600/90 px-4 py-2 text-[13px] font-medium text-black transition-colors hover:bg-gold-600 disabled:opacity-50"
          >
            {pending ? "저장 중…" : post ? "수정 저장" : "글 저장"}
          </button>
        </div>
      </div>
    </form>
  );
}

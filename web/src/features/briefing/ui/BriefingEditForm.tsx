"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import type { BriefingArticle, BriefingBlock } from "@/lib/briefing/article";
import type { Rejection } from "@/lib/briefing/rewrite";
import { Badge } from "@/components/ui/Badge";
import { editBriefingAction } from "../actions";
import { emptyBriefingEditState } from "../form-state";
import type { BriefingStatus } from "../repository";
import { BriefingArticleView } from "./BriefingArticleView";

const fieldLabel = "mb-1 block text-[11px] text-muted";
const inputClass =
  "w-full rounded-lg border border-border bg-bg px-3 py-2 text-[13.5px] leading-relaxed text-ink focus:border-gold-500 focus:outline-none";

/** 내용 길이에 맞춰 늘어나는 칸 — 글 전체가 스크롤 없이 보여야 고치기 쉽다. */
function GrowingArea({
  value,
  onChange,
  className = "",
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  ariaLabel?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight + 2}px`;
    }
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={1}
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${inputClass} resize-none ${className}`}
    />
  );
}

function TextArea({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <label className="block">
      <span className={fieldLabel}>{label}</span>
      <GrowingArea value={value} onChange={onChange} />
    </label>
  );
}

/** 한 줄이 한 항목인 칸(리드·기준 시각·목록·출처). */
function LinesField({ value, onChange, label }: { value: string[]; onChange: (v: string[]) => void; label: string }) {
  return <TextArea label={`${label} — 한 줄에 하나`} value={value.join("\n")} onChange={(v) => onChange(v.split("\n"))} />;
}

const BLOCK_LABEL: Record<BriefingBlock["t"], string> = {
  p: "문단",
  h3: "소제목",
  watch: "다음에 볼 것",
  ul: "목록",
  table: "표",
  src: "이 절의 출처",
};

function TableField({
  block,
  onChange,
  label,
}: {
  block: Extract<BriefingBlock, { t: "table" }>;
  onChange: (b: BriefingBlock) => void;
  label: string;
}) {
  return (
    <div>
      <span className={fieldLabel}>{label}</span>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr>
              {block.head.map((h, i) => (
                <th key={i} className="p-1 font-normal">
                  <GrowingArea
                    ariaLabel={`표 머리 ${i + 1}`}
                    value={h}
                    onChange={(v) => onChange({ ...block, head: block.head.map((x, j) => (j === i ? v : x)) })}
                    className="min-w-24 !py-1 font-semibold"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} className="p-1 align-top">
                    <GrowingArea
                      ariaLabel={`${ri + 1}행 ${ci + 1}열`}
                      value={cell}
                      onChange={(v) =>
                        onChange({
                          ...block,
                          rows: block.rows.map((r, i) => (i === ri ? r.map((c, j) => (j === ci ? v : c)) : r)),
                        })
                      }
                      className="min-w-24 !py-1"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1 text-[11px] text-ink-3">한 행을 전부 비우면 그 행이 빠집니다.</p>
    </div>
  );
}

function BlockField({ block, onChange }: { block: BriefingBlock; onChange: (b: BriefingBlock) => void }) {
  const label = BLOCK_LABEL[block.t];
  switch (block.t) {
    case "p":
    case "h3":
    case "watch":
      return <TextArea label={label} value={block.text} onChange={(text) => onChange({ ...block, text })} />;
    case "ul":
    case "src":
      return <LinesField label={label} value={block.items} onChange={(items) => onChange({ ...block, items })} />;
    case "table":
      return <TableField label={label} block={block} onChange={onChange} />;
  }
}

function Group({ title, children, onFocus }: { title: string; children: ReactNode; onFocus?: () => void }) {
  return (
    <fieldset onFocus={onFocus} className="space-y-3 rounded-xl border border-border bg-card p-4">
      <legend className="px-1 text-[12px] font-semibold text-ink">{title}</legend>
      {children}
    </fieldset>
  );
}

/**
 * 브리핑 수정 — 왼쪽에서 칸을 고치면 오른쪽 미리보기가 바로 바뀐다(공개 화면과 같은 컴포넌트).
 *
 * ⚠ 칸을 비우면 그 문단이 빠진다(`lib/briefing/edit`). AI는 부르지 않는다 — 고친 문장이 그대로 나간다.
 * ⚠ 고지(AI 활용·투자 유의)는 칸이 없다. 미리보기에는 보인다.
 */
export function BriefingEditForm({
  date,
  status,
  article,
  updatedAt,
  editNote,
}: {
  date: string;
  status: BriefingStatus;
  article: BriefingArticle;
  updatedAt: string;
  editNote: Rejection[];
}) {
  const [draft, setDraft] = useState(article);
  const [state, formAction, pending] = useActionState(editBriefingAction, emptyBriefingEditState);
  const published = status === "PUBLISHED";

  const serialized = JSON.stringify(draft);
  const [savedSnapshot, setSavedSnapshot] = useState(serialized);
  const [baseUpdatedAt, setBaseUpdatedAt] = useState(updatedAt);
  const dirty = serialized !== savedSnapshot;

  // 저장에 성공했으면 그때 보낸 값이 새 기준이다. 저장 뒤 다시 친 글자는 계속 「안 저장」으로 남는다.
  const lastSubmitted = useRef(serialized);
  useEffect(() => {
    if (state.saved || state.unchanged) setSavedSnapshot(lastSubmitted.current);
    if (state.updatedAt) setBaseUpdatedAt(state.updatedAt);
  }, [state]);

  // 저장 안 한 글을 잃지 않게 — 창을 닫거나 새로고침할 때 브라우저가 묻는다.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // 다른 화면으로 넘어가는 링크는 beforeunload가 안 걸린다(앱 안 이동) — 링크 클릭을 따로 묻는다.
  useEffect(() => {
    if (!dirty) return;
    const guard = (e: MouseEvent) => {
      const link = e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (link && !window.confirm("저장하지 않은 수정이 있습니다. 이 화면을 떠날까요?")) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener("click", guard, true);
    return () => document.removeEventListener("click", guard, true);
  }, [dirty]);

  // 고치는 절을 미리보기에서도 보여 준다 — 나란히 볼 때만 의미가 있고, 쌓인 화면에서는 미리보기가 스크롤되지 않아 아무 일도 없다.
  const previewRef = useRef<HTMLElement>(null);
  const followPreview = (top: () => number) => {
    const box = previewRef.current;
    if (box) box.scrollTo({ top: top(), behavior: "smooth" });
  };
  const followSection = (si: number) =>
    followPreview(() => {
      const target = previewRef.current?.querySelectorAll<HTMLElement>("section")[si];
      return target ? target.offsetTop - 16 : 0;
    });

  const patchSection = (si: number, title: string) =>
    setDraft((d) => ({ ...d, sections: d.sections.map((s, i) => (i === si ? { ...s, title } : s)) }));
  const patchBlock = (si: number, bi: number, block: BriefingBlock) =>
    setDraft((d) => ({
      ...d,
      sections: d.sections.map((s, i) =>
        i === si ? { ...s, blocks: s.blocks.map((b, j) => (j === bi ? block : b)) } : s,
      ),
    }));

  return (
    <form
      action={formAction}
      onSubmit={() => {
        lastSubmitted.current = serialized;
      }}
    >
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="article" value={serialized} />
      <input type="hidden" name="baseUpdatedAt" value={baseUpdatedAt} />

      {/* 저장 줄은 긴 글 어디서든 닿게 위에 붙인다. */}
      <div className="sticky top-0 z-10 mb-5 rounded-xl border border-border bg-card px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          {published ? <Badge tone="emerald">공개 중</Badge> : <Badge tone="neutral">초안</Badge>}
          <Link href={`/admin/briefing/${date}`} className="text-[12.5px] text-muted underline">
            미리보기로 돌아가기
          </Link>
          <span className="text-[12px] text-muted" aria-live="polite">
            {dirty ? "저장 안 한 수정이 있습니다" : state.saved ? "저장했습니다" : state.unchanged ? "고친 내용이 없습니다" : ""}
          </span>
          <button
            type="submit"
            disabled={pending || !dirty}
            className="ml-auto rounded-lg bg-gold-500 px-4 py-2 text-[13px] font-semibold text-onAccent disabled:opacity-50"
          >
            {pending ? "저장하는 중…" : published ? "저장 — 공개 글에 바로 반영" : "초안 저장"}
          </button>
        </div>
        {state.error && <p className="mt-2 text-[12.5px] text-red-400">{state.error}</p>}
        {state.saved && state.newNumbers && state.newNumbers.length > 0 && (
          <p className="mt-2 text-[12.5px] text-gold-500">
            ⚠ 글에 처음 나타난 숫자: {state.newNumbers.join(", ")} — 잘못 친 값이 아닌지 확인하세요.
          </p>
        )}
        {editNote.length > 0 && (
          <p className="mt-2 text-[12px] text-muted">
            AI가 다듬다 원문으로 되돌린 문장(올릴 때 기준): {editNote.map((r) => `${r.id}(${r.reason})`).join(" · ")}
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <div className="min-w-0 space-y-4">
          <p className="text-[12px] text-muted">
            칸을 비우면 그 문단이 빠집니다. 문단 안에서는 <code>**굵게**</code>만 쓸 수 있습니다. 고지는 고칠 수 없습니다.
          </p>
          <Group title="제목 · 리드" onFocus={() => followPreview(() => 0)}>
            <TextArea label="제목" value={draft.headline} onChange={(headline) => setDraft((d) => ({ ...d, headline }))} />
            <LinesField label="3줄 요약" value={draft.summary} onChange={(summary) => setDraft((d) => ({ ...d, summary }))} />
            <LinesField label="기준 시각" value={draft.basis} onChange={(basis) => setDraft((d) => ({ ...d, basis }))} />
          </Group>

          {draft.sections.map((s, si) => (
            <Group key={si} title={`${si + 1}절`} onFocus={() => followSection(si)}>
              <TextArea label="절 제목" value={s.title} onChange={(title) => patchSection(si, title)} />
              {s.blocks.map((b, bi) => (
                <BlockField key={bi} block={b} onChange={(next) => patchBlock(si, bi, next)} />
              ))}
            </Group>
          ))}

          <Group title="맺음 · 출처" onFocus={() => followPreview(() => previewRef.current?.scrollHeight ?? 0)}>
            <TextArea label="맺음 한 줄" value={draft.closing ?? ""} onChange={(closing) => setDraft((d) => ({ ...d, closing }))} />
            <LinesField label="출처" value={draft.sources} onChange={(sources) => setDraft((d) => ({ ...d, sources }))} />
          </Group>
        </div>

        <section
          ref={previewRef}
          aria-label="미리보기"
          className="min-w-0 rounded-2xl border border-border bg-bg px-4 py-6 sm:px-6 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto"
        >
          <BriefingArticleView article={draft} />
        </section>
      </div>
    </form>
  );
}

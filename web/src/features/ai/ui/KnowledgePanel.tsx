"use client";

/**
 * 지식 검색 패널 — AI가 무엇을 근거로 답하게 될지 미리 본다.
 *
 * 화면 구성을 이렇게 둔 이유: **뽑힌 기록(사람이 읽는 형태) → 실제 프롬프트 조각(모델이 받는
 * 형태)** 순서다. 앞을 보면 검색이 맞았는지 알 수 있고, 뒤를 보면 모델에게 무엇이 갔는지 안다.
 */
import { useActionState } from "react";
import Link from "next/link";
import { searchKnowledgeAction } from "../knowledge-actions";
import { emptyKnowledgeState } from "../knowledge-state";
import { KIND_LABEL } from "@/lib/ai/retrieval";

const EXAMPLES = ["HBM 수요", "금리 역전", "성장 버킷 비중", "반도체 사이클"];

export function KnowledgePanel() {
  const [state, formAction, pending] = useActionState(searchKnowledgeAction, emptyKnowledgeState);

  return (
    <div className="space-y-4">
      <form action={formAction} className="flex flex-wrap gap-2">
        <input
          name="query"
          defaultValue={state.query}
          placeholder="예: 지금 반도체 사이클 어디쯤인가"
          aria-label="찾을 내용"
          className="min-w-[240px] flex-1 rounded-xl border border-border bg-bg px-3 py-2 text-[13px] text-ink placeholder:text-gray-600"
        />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-xl bg-gold-600/90 px-4 py-2 text-[13px] font-medium text-onAccent transition-colors hover:bg-gold-600 disabled:opacity-50"
        >
          {pending ? "찾는 중…" : "기록 검색"}
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-gray-600">
        예시:
        {EXAMPLES.map((e) => (
          <span key={e} className="rounded-md border border-border px-2 py-0.5">
            {e}
          </span>
        ))}
      </div>

      {state.error && (
        <p role="alert" className="text-[12px] text-red-400">
          {state.error}
        </p>
      )}

      {state.hits && (
        <>
          <p className="text-[12px] text-gray-500">
            창고 문서 {state.total}건 중 <strong className="text-gray-300">{state.hits.length}건</strong>{" "}
            선택 — 점수 0인 기록은 넣지 않습니다(자리를 채우면 모델이 그걸 근거로 삼습니다).
          </p>

          {state.hits.length === 0 ? (
            <p className="rounded-xl border border-yellow-500/30 bg-yellow-500/[0.06] px-4 py-3 text-[12.5px] text-yellow-200">
              관련된 기록이 없습니다. 이 상태로 모델을 부르면 일반론이 나옵니다 — 먼저 그 주제에
              대한 기록을 남기는 편이 낫습니다.
            </p>
          ) : (
            <ul className="space-y-2">
              {state.hits.map((hit) => (
                <li key={hit.id} className="rounded-xl border border-border bg-bg px-4 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-[13px] font-medium text-ink">
                      <span className="mr-1.5 text-[11px] text-gold-400">
                        [{KIND_LABEL[hit.kind]}]
                      </span>
                      {hit.title}
                    </p>
                    <span className="text-[11px] tabular-nums text-gray-600">
                      점수 {hit.score.toFixed(2)}
                      {hit.date && ` · ${hit.date}`}
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-gray-400">{hit.snippet}</p>
                  {hit.href && (
                    <Link
                      href={hit.href}
                      className="mt-1 inline-block text-[11px] text-gray-600 underline hover:text-gold-400"
                    >
                      {hit.href}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}

          {state.prompt && (
            <details className="rounded-xl border border-border bg-bg px-4 py-3">
              <summary className="cursor-pointer text-[12.5px] text-gray-300">
                모델에게 실제로 넘어갈 문장 보기
              </summary>
              <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-[11.5px] leading-relaxed text-gray-400">
                {state.prompt}
              </pre>
            </details>
          )}
        </>
      )}
    </div>
  );
}

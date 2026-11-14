import { buildFacts } from "@/lib/gcrm/commentary";
import { seoulDay } from "@/lib/kst";
import type { PublicCommentary } from "@/features/gcrm/commentary-repo";

/**
 * 홈 「조류」 맨 위 — GCRM 조류 해설(2026-11-14 · v3 · 운영자 「조류에 AI 해설」 · 「해설 공개는 b로」).
 *
 * ⚠ 지키는 것
 * - **승인된 해설 · 최신 계산과 같은 기준일**만 온다(`loadPublicCommentary`). 없으면 이 블록은 그려지지 않는다.
 * - 기준일 · 판정 상태 · 모델 버전 · 「모델 백테스트 전 · 해석은 참고」 · 「AI 초안 · 운영자 승인」을 **먼저**(모바일에서도 위에) 보인다.
 * - 근거 숫자는 AI 글이 아니라 **저장된 사실표 값**으로 그린다.
 * - 펼치기는 `<details>` — 자바스크립트 없이도 열리고, 검색엔진과 사람이 같은 글을 본다.
 */
export function TideCommentary({ c }: { c: PublicCommentary }) {
  const facts = new Map(buildFacts(c.facts).map((f) => [f.id, f]));
  return (
    <article aria-label="조류 해설" className="mb-4 rounded-2xl border border-border bg-card px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-3">
        <span className="font-semibold text-ink">조류 해설</span>
        <span>· 기준일 {c.asOf}</span>
        <span>· 판정 {c.regimeLabel ?? "자료 없음"}</span>
        <span>· 모델 {c.modelVersion}</span>
        <span className="rounded-full border border-border px-2 py-0.5">모델 백테스트 전 · 해석은 참고</span>
        <span className="rounded-full border border-border px-2 py-0.5">
          AI 초안 · 운영자 승인{c.decidedAt ? ` ${seoulDay(c.decidedAt)}` : ""}
        </span>
      </div>

      <p className="mt-2 text-[14px] leading-relaxed text-ink">{c.body.card}</p>

      <details className="mt-3">
        <summary className="cursor-pointer text-[12px] font-medium text-gold-500 hover:text-gold-400">브리핑 펼치기</summary>
        <div className="mt-3 space-y-3 text-[13.5px] leading-relaxed text-ink">
          <p className="text-[15px] font-semibold">{c.body.verdict}</p>
          {c.body.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          <div>
            <p className="text-[12px] font-semibold text-ink-3">단서</p>
            <p>{c.body.caveat}</p>
          </div>
          <div>
            <p className="text-[12px] font-semibold text-ink-3">이렇게 되면 다시 봅니다</p>
            <ul className="list-disc pl-5">
              {c.body.triggers.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
          <details>
            <summary className="cursor-pointer text-[12px] text-ink-3">수치 근거 펼치기</summary>
            <ul className="mt-1 space-y-0.5 text-[12.5px]">
              {c.body.evidenceFactIds
                .filter((id) => facts.has(id))
                .map((id) => (
                  <li key={id}>
                    <span className="text-ink-3">{facts.get(id)!.label}</span> {facts.get(id)!.text}
                  </li>
                ))}
            </ul>
          </details>
          {c.research.length > 0 && (
            <div>
              <p className="text-[12px] font-semibold text-ink-3">관련 연구 (배경 · 오늘 움직임의 원인이 아닙니다)</p>
              <ul className="mt-1 space-y-1 text-[12.5px]">
                {c.research.map((r) => (
                  <li key={r.id}>
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-gold-500 underline hover:text-gold-400">
                      {r.title}
                    </a>
                    {r.limit ? <span className="text-ink-3"> — 한계: {r.limit}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-[11px] text-ink-3">
            점수와 판정은 프로그램이 규칙대로 계산하고, 글은 AI가 그 숫자만 써서 초안을 만든 뒤 운영자가 확인해 올립니다. 투자 권유가 아닙니다.
          </p>
        </div>
      </details>
    </article>
  );
}

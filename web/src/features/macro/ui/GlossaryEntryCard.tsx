/**
 * 용어 사전의 한 항목.
 *
 * ⚠ 카드에 `id={slug}`를 준다 — 본문의 `<Term>`과 발행 글이 이 앵커로 링크한다.
 *   `Card`가 앵커 도착 시 헤더에 가리지 않게(`scroll-mt`) 하고 잠깐 강조한다(`target:`).
 * ⭐ 우리 정의는 **제목 옆에서 먼저** 「표준 지표가 아니다」라고 말한다. 맨 아래 출처 줄까지
 *   내려가야 알 수 있으면, 그 전에 표준 지표로 읽힌다.
 */
import { Card } from "@/components/ui/Card";
import { Emphasis } from "@/components/ui/Emphasis";
import { checkNote, sourceNote, type GlossaryEntry } from "@/lib/macro/glossary";

export function GlossaryEntryCard({ entry }: { entry: GlossaryEntry }) {
  return (
    <Card id={entry.slug} padding="p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[16px] font-semibold text-ink">{entry.term}</h2>
        {entry.own && (
          <span className="rounded-full border border-gold-600/30 bg-gold-500/10 px-2 py-0.5 text-[10.5px] font-semibold text-gold-400">
            Woodsman 정의 · 표준 지표 아님
          </span>
        )}
      </div>
      {entry.aka && entry.aka.length > 0 && (
        <p className="mt-1 text-[11.5px] text-ink-3">다른 표기: {entry.aka.join(" · ")}</p>
      )}

      <p className="mt-3 text-[13.5px] leading-relaxed text-gray-300">
        <Emphasis text={entry.short} />
      </p>

      {entry.role && (
        <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
          <strong className="text-gold-400">이 사이트가 왜 보나</strong> — <Emphasis text={entry.role} />
        </p>
      )}

      <p className="mt-3 border-t border-border pt-2.5 text-[11.5px] leading-relaxed text-ink-3">
        {entry.url ? (
          <>
            출처{" "}
            <a
              href={entry.url}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-dotted hover:text-gold-400"
            >
              {entry.sourceLabel} ↗
            </a>{" "}
            · {checkNote(entry)}
          </>
        ) : (
          sourceNote(entry)
        )}
      </p>
    </Card>
  );
}

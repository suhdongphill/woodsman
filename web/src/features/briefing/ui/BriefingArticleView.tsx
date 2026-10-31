/**
 * 오늘의 브리핑 기사 — 공개 화면과 관리자 미리보기가 **같은 컴포넌트**를 쓴다(미리보기가 실제와 달라지지 않게).
 *
 * ⚠ HTML을 꽂지 않는다(`dangerouslySetInnerHTML` 없음). 기사는 구조(JSON)이고 글자는 React가 escape한다.
 * ⚠ 순서: 제목 → 리드(3줄 요약) → 본문 → 맺음 → 출처 → 고지. 고지(AI 활용·투자 유의)는 빼지 않는다.
 */
import type { BriefingArticle, BriefingBlock } from "@/lib/briefing/article";

/** `**굵게**`만 살린다 — 원고의 다른 문법은 이미 규칙이 걷어 냈다. */
function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        /^\*\*[^*]+\*\*$/.test(p) ? (
          <strong key={i} className="text-ink">
            {p.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

function Block({ block }: { block: BriefingBlock }) {
  switch (block.t) {
    case "p":
      return (
        <p className="mt-4 text-[15px] leading-[1.85] text-ink-2">
          <Inline text={block.text} />
        </p>
      );
    case "h3":
      return <h3 className="mt-7 text-[15px] font-semibold text-ink">{block.text}</h3>;
    case "watch":
      return (
        <p className="mt-5 rounded-xl border border-border bg-card px-4 py-3 text-[13.5px] leading-relaxed text-ink-2">
          <span className="mr-2 text-[11px] font-semibold text-gold-500">다음에 볼 것</span>
          <Inline text={block.text} />
        </p>
      );
    case "ul":
      return (
        <ul className="mt-4 list-disc space-y-2 pl-5 text-[15px] leading-[1.8] text-ink-2">
          {block.items.map((item, i) => (
            <li key={i}>
              <Inline text={item} />
            </li>
          ))}
        </ul>
      );
    case "table":
      return (
        <div className="mt-4 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-[13px]">
            <thead className="bg-card text-left text-muted">
              <tr>
                {block.head.map((h, i) => (
                  <th key={i} scope="col" className="px-3 py-2 font-medium whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri} className="border-t border-border">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 text-ink-2">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "src":
      return (
        <p className="mt-4 text-[11.5px] leading-relaxed text-ink-3">
          출처 · {block.items.join(" · ")}
        </p>
      );
  }
}

/** `2026-10-31` → `2026.10.31(토)` */
export function briefingDateLabel(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  const day = ["일", "월", "화", "수", "목", "금", "토"][d.getUTCDay()];
  return `${date.replace(/-/g, ".")}(${day})`;
}

export function BriefingArticleView({ article }: { article: BriefingArticle }) {
  return (
    <div>
      <p className="text-[11px] font-semibold tracking-[0.14em] text-gold-500">
        오늘의 브리핑 · {briefingDateLabel(article.date)}
      </p>
      <h1 className="mt-3 text-2xl sm:text-[30px] font-bold leading-snug tracking-tight text-ink">
        {article.headline}
      </h1>

      {article.summary.length > 0 && (
        <ul className="mt-6 space-y-2 rounded-2xl border border-border bg-card px-5 py-4">
          {article.summary.map((s, i) => (
            <li key={i} className="flex gap-2 text-[14px] leading-relaxed text-ink">
              <span className="text-gold-500">·</span>
              <span>{s}</span>
            </li>
          ))}
        </ul>
      )}

      {article.basis.length > 0 && (
        <div className="mt-3 space-y-1 text-[11.5px] leading-relaxed text-ink-3">
          {article.basis.map((b, i) => (
            <p key={i}>{b}</p>
          ))}
        </div>
      )}

      {article.sections.map((s, i) => (
        <section key={i} className="mt-12">
          <h2 className="text-lg sm:text-xl font-bold leading-snug text-ink">{s.title}</h2>
          {s.blocks.map((b, bi) => (
            <Block key={bi} block={b} />
          ))}
        </section>
      ))}

      {article.closing && (
        <blockquote className="mt-12 border-l-2 border-gold-500 pl-4 text-[16px] font-medium leading-relaxed text-ink">
          {article.closing}
        </blockquote>
      )}

      {article.sources.length > 0 && (
        <section className="mt-12 border-t border-border pt-6">
          <h2 className="text-[13px] font-semibold text-ink">출처</h2>
          <div className="mt-2 space-y-2 text-[12px] leading-relaxed text-muted">
            {article.sources.map((s, i) => (
              <p key={i}>{s}</p>
            ))}
          </div>
        </section>
      )}

      <div className="mt-8 space-y-2 rounded-xl bg-card px-4 py-3 text-[11.5px] leading-relaxed text-ink-3">
        {article.notices.map((n, i) => (
          <p key={i}>{n}</p>
        ))}
      </div>
    </div>
  );
}

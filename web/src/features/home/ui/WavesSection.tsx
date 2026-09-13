import type { StoredNews } from "@/features/news/repository";
import type { NewsSource } from "@/lib/news/feeds";
import { seoulDay } from "@/lib/kst";

/**
 * 홈 「파도」 — 오늘의 기사. 통합 계획 S3 · 홈 섹션 계획표 §2.
 *
 * ## 자리와 층 (운영자 결정 2026-09-14)
 * 「지금 부는 바람」(이번 주 지표) **바로 아래**, 「조류」(몇 달 점수) **위**. 가까운 시간 → 먼 시간 순서로 읽힌다.
 *
 * ## ⚠ 지키는 것
 * - **본문을 싣지 않는다**(저작권) — 제목 · 날짜 · 원문 링크 · 기관이 준 한 줄 설명만. 원문은 새 창.
 * - 출처를 카드마다 적는다(연준 연설 · 연준 보도자료 · 의회 증언 · BLS · 운영자) — 누가 한 말인지가 파도의 절반이다.
 * - 기사를 점수로 바꾸지 않는다(원칙 ③). 파도는 「무슨 일이 있었나」까지다.
 * - 기사가 없어도 블록은 남는다 — 「다음 수집 뒤」라고 적는다.
 */
const SOURCE_LABEL: Record<NewsSource, string> = {
  FED_SPEECH: "연준 연설",
  FED_MONETARY: "연준 보도자료",
  FED_TESTIMONY: "의회 증언",
  BLS_CPI: "미 노동통계국(BLS)",
  MANUAL: "운영자",
};

export function WavesSection({ news }: { news: StoredNews[] }) {
  return (
    <section aria-labelledby="waves-heading" className="mx-auto max-w-6xl px-4 pb-10 sm:px-6">
      <div className="mb-3">
        <h2 id="waves-heading" className="text-[13px] font-semibold tracking-tight text-ink">
          파도 — 오늘의 기사
        </h2>
        <p className="mt-0.5 text-[11.5px] text-ink-3">
          연준 발언 · FOMC · CPI 발표는 기관 원문에서 자동으로 받습니다. 제목과 원문 링크만 싣고, 본문은 원문에서 읽어 주세요.
        </p>
      </div>

      {news.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card px-5 py-4 text-[12.5px] text-muted">
          아직 받은 기사가 없습니다 — 다음 자료 수집 뒤에 채워집니다.
        </p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {news.map((n) => (
            <li key={n.id} className="flex flex-col rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10.5px]">
                <span className="rounded-md border border-gold-500/30 bg-gold-500/10 px-1.5 py-0.5 font-medium text-gold-500">
                  {n.category}
                </span>
                <span className="text-ink-3">{seoulDay(n.publishedAt)}</span>
                <span className="text-ink-3">· {SOURCE_LABEL[n.source] ?? n.source}</span>
                {n.speaker && <span className="text-ink">· {n.speaker}</span>}
              </div>
              <a
                href={n.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 text-[13px] font-medium leading-snug text-ink hover:text-gold-500"
              >
                {n.title}
              </a>
              {n.summary && <p className="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-muted">{n.summary}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

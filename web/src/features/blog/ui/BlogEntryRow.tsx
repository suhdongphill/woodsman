import { Badge } from "@/components/ui/Badge";
import { ExternalIcon } from "@/components/icons";
import { displaySummary, splitCategory, splitTitle, type BlogEntry } from "@/lib/blog/tistory";
import { outboundBlogHref } from "@/lib/outbound";
import { formatDate } from "@/lib/format";

/**
 * 블로그 글 한 줄 — `/blog`와 홈 「블로그」 공용.
 *
 * ⚠ 링크는 언제나 `/go/blog-<번호>` 경유다 — 주소를 직접 박으면 「티스토리로 넘어간 클릭」에 안 잡힌다(1순위 지표).
 * ⚠ 새 탭 `<a>`다. `next/link`는 미리 받기(prefetch)로 경유 주소를 두드릴 수 있다.
 * ⚠ **모바일 가로 넘침**(2026-09-27 운영자 신고 · scrollWidth 586/596px @390px): 요약에 띄어쓰기 없는 긴 URL(약 200자)이 있으면
 *   grid 항목의 기본 `min-width:auto`가 그 폭 밑으로 줄지 않아 **목록 전체**가 넓어졌다.
 *   → 링크에 `min-w-0`, 제목·요약에 `[overflow-wrap:anywhere]`(`break-word`와 달리 **최소 폭 계산에도** 반영된다).
 *   한글은 원래 글자 단위로 줄바꿈되므로 보이는 변화는 긴 영문·URL에만 있다. URL 자체는 `displaySummary`가 뺀다.
 * ⚠ 공감 수는 0이면 적지 않는다(「공감 0」은 글을 깎아내리는 말이 된다). 인기 목록은 기준이 공감이라 거기선 늘 적는다.
 */
export function BlogEntryRow({ entry, compact = false }: { entry: BlogEntry; compact?: boolean }) {
  const [top, sub] = splitCategory(entry.category);
  const summary = displaySummary(entry);
  const { head, dek } = splitTitle(entry.title);
  // ⚠ 외부 링크 아이콘은 **마지막 단어와 묶는다** — 아이콘만 다음 줄로 떨어지는 타이포 사고를 막는다((81)).
  const words = head.split(" ");
  const lastWord = words.pop() ?? "";
  const lead = words.join(" ");
  const summaryId = `blog-summary-${compact ? "c" : "f"}-${entry.entryId}`;
  return (
    <a
      href={outboundBlogHref(entry.entryId)}
      target="_blank"
      rel="noopener"
      /*
        ⚠ 접근 가능한 이름 = **전체 제목**, 요약 = 설명((81)). 그러지 않으면 스크린리더가 링크마다
           「카테고리+날짜+제목+요약」 약 250자를 이름으로 읽는다((80) 접근성 트리에서 확인). 전체 제목은 보이는 글자를 모두 포함한다(WCAG 2.5.3).
      */
      aria-label={`${entry.title} (새 창, 티스토리)`}
      aria-describedby={summary ? summaryId : undefined}
      className={
        compact
          ? "group block min-w-0 py-3.5 first:pt-0 last:pb-0"
          : "group block min-w-0 rounded-2xl border border-border bg-card p-4 sm:p-5 card-hover hover:border-gold-600/40"
      }
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-gray-500">
        <Badge tone="neutral">{sub ? `${top} · ${sub}` : top}</Badge>
        <span className="tabular-nums">{formatDate(entry.publishedAt)}</span>
        {entry.likes ? <span className="tabular-nums">공감 {entry.likes}</span> : null}
      </div>
      <h3 className="mt-1.5 text-[15px] font-semibold leading-[1.4] text-ink transition-colors group-hover:text-gold-400 line-clamp-2 [overflow-wrap:anywhere]">
        {lead ? `${lead} ` : ""}
        <span className="whitespace-nowrap">
          {lastWord}
          <ExternalIcon size={12} aria-hidden className="ml-1 inline-block align-baseline text-gray-500" />
        </span>
      </h3>
      {/* 부제 — 제목의 「 — 」 뒤. 흐리게 한 줄(매체 카드의 dek) */}
      {dek && <p className="mt-0.5 text-[13px] leading-[1.5] text-muted line-clamp-1 [overflow-wrap:anywhere]">{dek}</p>}
      {summary && (
        <p
          id={summaryId}
          className={`mt-1.5 text-[13px] leading-relaxed text-muted [overflow-wrap:anywhere] ${compact ? "line-clamp-2" : "line-clamp-3"}`}
        >
          {summary}
        </p>
      )}
    </a>
  );
}

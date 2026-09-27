import { Badge } from "@/components/ui/Badge";
import { ExternalIcon } from "@/components/icons";
import { displaySummary, splitCategory, type BlogEntry } from "@/lib/blog/tistory";
import { outboundBlogHref } from "@/lib/outbound";
import { formatDate } from "@/lib/format";

/**
 * 블로그 글 한 줄 — `/blog`와 홈 「블로그」 공용.
 *
 * ⚠ 링크는 언제나 `/go/blog-<번호>` 경유다 — 주소를 직접 박으면 「티스토리로 넘어간 클릭」에 안 잡힌다(1순위 지표).
 * ⚠ 새 탭 `<a>`다. `next/link`는 미리 받기(prefetch)로 경유 주소를 두드릴 수 있다.
 * ⚠ 공감 수는 0이면 적지 않는다(「공감 0」은 글을 깎아내리는 말이 된다). 인기 목록은 기준이 공감이라 거기선 늘 적는다.
 */
export function BlogEntryRow({ entry, compact = false }: { entry: BlogEntry; compact?: boolean }) {
  const [top, sub] = splitCategory(entry.category);
  const summary = displaySummary(entry);
  return (
    <a
      href={outboundBlogHref(entry.entryId)}
      target="_blank"
      rel="noopener"
      className={
        compact
          ? "group block py-3.5 first:pt-0 last:pb-0"
          : "group block rounded-2xl border border-border bg-card p-4 sm:p-5 card-hover hover:border-gold-600/40"
      }
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-gray-500">
        <Badge tone="neutral">{sub ? `${top} · ${sub}` : top}</Badge>
        <span className="tabular-nums">{formatDate(entry.publishedAt)}</span>
        {entry.likes ? <span className="tabular-nums">공감 {entry.likes}</span> : null}
      </div>
      <h3 className="mt-1.5 text-[15px] font-semibold leading-snug text-ink transition-colors group-hover:text-gold-400 line-clamp-2">
        {entry.title}
        <ExternalIcon size={12} className="ml-1 inline-block align-baseline text-gray-500" />
      </h3>
      {summary && (
        <p className={`mt-1.5 text-[13px] leading-relaxed text-muted ${compact ? "line-clamp-2" : "line-clamp-3"}`}>{summary}</p>
      )}
    </a>
  );
}

import Link from "next/link";
import { outboundStockHref } from "@/lib/outbound";
import { sanitizeReportHtml } from "@/lib/report/file";

/**
 * 올린 보고서 HTML — 공개 화면과 관리자 미리보기가 **같은 컴포넌트**를 쓴다.
 *
 * ⚠ 보고서는 자기 글자색을 인라인으로 들고 있다(티스토리용). 밝은 바탕을 고정해 어두운 화면에서도 읽히게 한다.
 * ⚠ 저장 때 정화했어도 그릴 때 한 번 더 지난다 — 나중에 규칙이 강해지면 옛 행도 따라온다.
 */
export function ReportFileView({
  ticker,
  name,
  html,
  blogUrl,
  publishedAt,
}: {
  ticker: string;
  name: string;
  html: string;
  blogUrl: string | null;
  publishedAt: string | null;
}) {
  const blogLink = blogUrl && (
    <a
      href={outboundStockHref(ticker)}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-2xl border border-gold-600/40 bg-gold-500/10 p-4 text-sm font-semibold text-gold-400"
    >
      티스토리에서 이 보고서 읽기 →
    </a>
  );

  return (
    <article className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <p className="mb-3 text-[12px] text-muted">
        <Link href="/stocks" className="underline underline-offset-2 hover:text-ink">
          종목분석
        </Link>{" "}
        · {name} ({ticker})
        {publishedAt ? ` · 게시 ${publishedAt.slice(0, 10)}` : ""}
      </p>

      {blogLink}

      <div
        className="mt-4 overflow-x-auto rounded-2xl bg-white p-4 text-[#1e3a2b] sm:p-6"
        dangerouslySetInnerHTML={{ __html: sanitizeReportHtml(html) }}
      />

      <p className="mt-4 text-[11.5px] leading-relaxed text-ink-3">
        숫자는 보고서에 적힌 기준일 값이며 지금과 다를 수 있습니다. 정보 제공 목적의 기록이고 투자 권유가 아닙니다.{" "}
        <Link href="/disclaimer" className="underline underline-offset-2 hover:text-ink">
          투자 판단 책임 고지
        </Link>
      </p>
    </article>
  );
}

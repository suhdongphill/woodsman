import { ExternalIcon } from "@/components/icons";
import { outboundHref } from "@/lib/outbound";

/**
 * 티스토리 블로그 유도 CTA.
 *
 * 이 사이트의 1순위 목적은 블로그로 트래픽을 보내는 것이다.
 * 그래서 **글을 다 읽은 자리(본문 끝)를 광고가 아니라 이 CTA가 차지한다.**
 * 광고는 이 아래로 밀린다 — 자리 경쟁에서 트래픽이 이긴다.
 *
 * ## 주소를 보여주지 않는다
 * 전에는 `suhdp.tistory.com/2`를 그대로 찍었다. 읽는 사람에게 **주소는 아무 정보가 아니다** —
 * 거기 무슨 글이 있는지 알 수 없으니 누를 이유가 없다.
 * 그래서 글의 **제목과 요약**을 보여주고, 카드 전체를 누르면 그 글로 간다.
 *
 * 링크는 `/go/tistory`를 경유해 클릭 수를 센다(`src/lib/outbound.ts`).
 * 성과 판단 기준이 "몇 명이 넘어갔나"라서 그 숫자가 없으면 개선이 감이 된다.
 */

type Variant =
  /** 본문 끝 — 가장 눈에 띄는 형태 */
  | "prominent"
  /** 목록·사이드 — 한 줄짜리 */
  | "compact";

export function TistoryCta({
  variant = "prominent",
  headline,
  description,
  /** 블로그 글 제목 — 없으면 headline만 보여준다 */
  postTitle,
  /** 블로그 글 요약 */
  postExcerpt,
  className,
}: {
  variant?: Variant;
  headline?: string;
  description?: string;
  postTitle?: string;
  postExcerpt?: string;
  className?: string;
}) {
  const href = outboundHref("tistory");

  if (variant === "compact") {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener"
        className={`group flex items-center justify-between gap-4 rounded-2xl border border-gold-600/30 bg-gradient-to-r from-gold-500/10 to-transparent p-5 transition-colors hover:border-gold-500/60 ${className ?? ""}`}
      >
        <div className="min-w-0">
          <p className="text-[11px] font-medium tracking-[0.12em] text-gold-400">
            TISTORY · 블로그 원문
          </p>
          <h3 className="mt-1.5 text-[15px] font-semibold leading-snug text-white transition-colors group-hover:text-gold-400">
            {postTitle ?? headline ?? "티스토리 블로그에서 더 깊게 읽기"}
          </h3>
          {postExcerpt && (
            <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-relaxed text-muted">
              {postExcerpt}
            </p>
          )}
        </div>
        <ExternalIcon size={18} className="shrink-0 text-gold-400" />
      </a>
    );
  }

  return (
    <aside
      className={`my-10 overflow-hidden rounded-2xl border border-gold-600/40 bg-gradient-to-br from-gold-500/[0.12] via-gold-500/[0.04] to-transparent ${className ?? ""}`}
    >
      <a href={href} target="_blank" rel="noopener" className="group block p-6 sm:p-7">
        <p className="text-[11px] font-medium tracking-[0.14em] text-gold-400">
          TISTORY · 원문 블로그
        </p>

        <h2 className="mt-2 text-lg font-bold leading-snug text-white transition-colors group-hover:text-gold-400 sm:text-xl">
          {postTitle ?? headline ?? "이 주제를 더 길게 다룬 글이 블로그에 있습니다"}
        </h2>

        <p className="mt-2.5 text-[13.5px] leading-relaxed text-gray-300">
          {postExcerpt ??
            description ??
            "여기는 계좌와 판단을 기록하는 곳이고, 배경 설명과 긴 분석은 티스토리에 씁니다. 같은 원칙을 다른 각도로 풀어 둔 글들을 이어서 읽어보세요."}
        </p>

        <span className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gold-500 px-5 py-3 text-sm font-semibold text-[#1a1400] transition-colors group-hover:bg-gold-400">
          블로그에서 이어 읽기
          <ExternalIcon size={15} />
        </span>
      </a>
    </aside>
  );
}

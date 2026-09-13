/**
 * 본문 속 용어 — 누르면 사전의 그 자리(`/macro/glossary#<slug>`)로 간다.
 *
 * ## ⚠ 클라이언트 JS 없이 한다
 * 툴팁 하나에 번들을 늘리지 않는다. 뜻 한 줄은 `title` 속성으로 띄우고, 나머지(쓰임·1차 출처·
 * 확인일)는 사전으로 보낸다. 터치 기기에서는 `title`이 안 보이지만 **누르면 사전으로 가므로**
 * 뜻에 닿는 길은 막히지 않는다.
 *
 * ## ⚠ 사전에 없는 말이면 링크 없이 글자만 두고 로그를 남긴다
 * 오타 하나로 링크가 **조용히** 사라지면 아무도 모른다. 화면은 깨지지 않게 두되 `console.error`로
 * 남긴다(`CLAUDE.md` §3). 카드가 거는 말은 `capital.test.ts`가 사전에 있는지 대조한다.
 *
 * ⚠ 다른 `<Link>` 안에 넣지 않는다 — 링크 안의 링크는 HTML이 허용하지 않는다(묶음 카드 등).
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { findTerm, glossaryHref } from "@/lib/macro/glossary";
import { cx, stripEmphasis } from "@/lib/format";

export function Term({
  term,
  children,
  className,
}: {
  /** 사전의 용어나 별칭 */
  term: string;
  /** 화면에 보일 글자. 없으면 사전의 용어 그대로 */
  children?: ReactNode;
  className?: string;
}) {
  const entry = findTerm(term);
  if (!entry) {
    console.error(`[glossary] 사전에 없는 용어라 링크를 걸지 못했습니다: "${term}"`);
    return <>{children ?? term}</>;
  }

  return (
    <Link
      href={glossaryHref(entry)}
      title={stripEmphasis(entry.short)}
      className={cx(
        "underline decoration-dotted decoration-1 underline-offset-[3px] hover:text-gold-400",
        className,
      )}
    >
      {children ?? entry.term}
    </Link>
  );
}

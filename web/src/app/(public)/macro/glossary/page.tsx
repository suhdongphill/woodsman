import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { ChevronRightIcon } from "@/components/icons";
import { JsonLd } from "@/components/seo/JsonLd";
import { TistoryCta } from "@/features/site/ui/TistoryCta";
import { GlossaryEntryCard } from "@/features/macro/ui/GlossaryEntryCard";
import { GLOSSARY_PATH, orderedGlossary } from "@/lib/macro/glossary";
import { breadcrumbJsonLd, definedTermSetJsonLd } from "@/lib/seo";
import { getSiteBasics } from "@/lib/site-settings";
import { stripEmphasis } from "@/lib/format";

const TITLE = "거시 용어 사전";
const DESCRIPTION =
  "화면에 쓰는 거시 용어의 뜻과, 누가 그렇게 정의했는지를 원 발표 기관 링크와 확인일로 적었습니다. 우리가 계산해 붙인 이름은 표준 지표가 아니라고 먼저 밝힙니다.";

export const metadata: Metadata = {
  title: `${TITLE} — 뜻과 누가 그렇게 정의했는지`,
  description: DESCRIPTION,
  alternates: { canonical: GLOSSARY_PATH },
};

/** ⚠ 정적 생성 금지 — 아래 티스토리 안내 문구를 DB 설정에서 읽는다. */
export const dynamic = "force-dynamic";

/**
 * 거시 용어 사전 (2026-09-14).
 *
 * 본문의 `<Term>`이 이 페이지의 앵커로 온다. 용어 자체는 `lib/macro/glossary.ts`에 있고
 * 여기서는 조립만 한다 — 링크 확인 규칙도 그 파일과 테스트가 지킨다.
 *
 * ⚠ 이 페이지가 내는 약속은 셋이다(확인한 링크만 · 원 발표 기관 · 우리 정의는 우리 것).
 *   약속을 **화면에 적어 둔다.** 적어 두지 않으면 독자는 우리가 확인했는지 알 방법이 없다.
 */
export default async function MacroGlossaryPage() {
  const entries = orderedGlossary();
  const basics = await getSiteBasics();

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "홈", path: "/" },
          { name: "거시 지표", path: "/macro" },
          { name: "용어 사전", path: GLOSSARY_PATH },
        ])}
      />
      <JsonLd
        data={definedTermSetJsonLd({
          name: TITLE,
          description: DESCRIPTION,
          path: GLOSSARY_PATH,
          terms: entries.map((e) => ({
            name: e.term,
            description: stripEmphasis(e.short),
            anchor: e.slug,
            alternateName: e.aka,
          })),
        })}
      />

      <PageHeader
        eyebrow="GLOSSARY"
        title={TITLE}
        description="뜻을 모르면 숫자는 장식이고, 누가 그렇게 정의했는지 못 대면 설명은 주장입니다. 화면에 쓰는 말의 뜻과 출처를 한곳에 모았습니다."
      />

      <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
        <nav aria-label="현재 위치" className="flex items-center gap-1.5 text-[12px] text-gray-500">
          <Link href="/macro" className="hover:text-gold-400">
            거시 지표
          </Link>
          <ChevronRightIcon size={12} />
          <span className="text-gray-400">용어 사전</span>
        </nav>

        {/* ⚠ 약속을 화면에 적는다 */}
        <Card className="border-gold-600/30 bg-gold-500/[0.04]">
          <h2 className="text-[15px] font-semibold text-ink">이 사전의 약속</h2>
          <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-gray-300">
            <li>
              <strong className="text-gold-400">확인한 링크만 싣습니다.</strong> 용어마다 링크를
              확인한 날을 적었습니다. 스크립트 접근을 막는 기관은 페이지 본문을 받아 살아 있는지
              확인했고(「본문 확인」), 그렇게도 확인이 안 된 출처는 싣지 않았습니다.
            </li>
            <li>
              <strong className="text-gold-400">원 발표 기관을 댑니다.</strong> 데이터를 모아 주는
              곳이 아니라 그 숫자를 만드는 곳 — 생산성은 노동통계국, GDP는 경제분석국입니다.
            </li>
            <li>
              <strong className="text-gold-400">우리가 만든 이름은 우리 것이라고 밝힙니다.</strong>{" "}
              표준 지표가 아닌 것은 제목 옆에 그렇게 표시했습니다. 계산식은 해당 카드에 적어 두어
              직접 검산하실 수 있습니다.
            </li>
          </ul>
        </Card>

        {/* 목차 — 스크롤 대신 바로 간다 */}
        <nav aria-label="용어 목록" className="flex flex-wrap gap-2">
          {entries.map((e) => (
            <a
              key={e.slug}
              href={`#${e.slug}`}
              className="rounded-full border border-border bg-card px-3 py-1 text-[12px] text-gray-300 transition-colors hover:border-gold-600/40 hover:text-gold-400"
            >
              {e.term}
            </a>
          ))}
        </nav>

        <div className="space-y-4">
          {entries.map((e) => (
            <GlossaryEntryCard key={e.slug} entry={e} />
          ))}
        </div>

        <p className="text-[11.5px] leading-relaxed text-gray-600">
          ※ 화면에 새 용어가 쓰일 때 링크를 확인한 뒤에 추가합니다. 잠재산출(CBO)과 연방기금
          선물(CME)은 출처 링크를 아직 확인하지 못해 싣지 않았습니다.
        </p>

        <TistoryCta
          headline="이 용어들로 실제 흐름을 어떻게 읽는지 블로그에 적었습니다"
          postTitle={basics.featuredTitle}
          postExcerpt={basics.featuredExcerpt}
        />
      </div>
    </>
  );
}

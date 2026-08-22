import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { ChevronRightIcon } from "@/components/icons";
import { JsonLd } from "@/components/seo/JsonLd";
import { AdSlot } from "@/components/analytics/AdSlot";
import { TistoryCta } from "@/features/site/ui/TistoryCta";
import { IndicatorCard } from "@/features/macro/ui/IndicatorCard";
import { HealthNotice } from "@/features/macro/ui/Freshness";
import { loadMacroGroup } from "@/features/macro/service";
import { findMacroGroup, type MacroGroupKey } from "@/lib/macro/groups";
import { indicatorsByGroup } from "@/lib/macro/catalog";
import { breadcrumbJsonLd, datasetJsonLd, faqJsonLd } from "@/lib/seo";
import { getSiteBasics } from "@/lib/site-settings";

type Props = { params: Promise<{ group: string }> };

/**
 * ⚠ 정적 생성 금지 — DB(수집한 시계열)를 읽는다.
 *    `generateStaticParams`로 굳히면 자료를 가져와도 옛 숫자가 그대로 남는다.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { group: key } = await params;
  const group = findMacroGroup(key);
  if (!group) return { title: "지표를 찾을 수 없습니다" };

  const names = indicatorsByGroup(group.key as MacroGroupKey)
    .map((i) => i.name)
    .join(", ");

  return {
    // 검색 결과에서 질문형 제목이 클릭을 만든다.
    title: `${group.name} 지표 — ${group.question}`,
    description: `${group.intro} 다루는 지표: ${names}.`.slice(0, 300),
    alternates: { canonical: `/macro/${group.key}` },
    openGraph: {
      type: "article",
      title: `${group.name} 지표 — ${group.question}`,
      description: group.intro,
      url: `/macro/${group.key}`,
    },
  };
}

/**
 * 그룹 상세 — 지표별 값·흐름·읽는 법.
 *
 * 각 지표를 카드 하나로 두고, 카드 안에서 "이게 뭔가 / 왜 보나 / 어떻게 읽나"를 편다.
 * 페이지 끝에는 **다음 묶음으로 가는 길**을 둔다 — 하나만 보고 나가지 않게.
 */
export default async function MacroGroupPage({ params }: Props) {
  const { group: key } = await params;
  const detail = await loadMacroGroup(key as MacroGroupKey);
  if (!detail) notFound();

  const [basics] = await Promise.all([getSiteBasics()]);
  const { group, items, prev, next } = detail;

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "홈", path: "/" },
          { name: "거시 지표", path: "/macro" },
          { name: group.name, path: `/macro/${group.key}` },
        ])}
      />
      <JsonLd
        data={datasetJsonLd({
          name: `${group.name} 지표`,
          description: group.intro,
          path: `/macro/${group.key}`,
          dateModified: detail.asOf,
          variables: items.map((i) => i.indicator.name),
          sources: [...new Set(items.map((i) => i.indicator.sourceLabel))],
        })}
      />
      {/* 지표 설명은 그대로 자주 묻는 질문이 된다 — 화면에 있는 문장만 태운다. */}
      <JsonLd
        data={faqJsonLd(
          items.map((i) => ({
            question: `${i.indicator.name}는(은) 무엇인가요?`,
            answer: `${i.indicator.what} ${i.indicator.why}`,
          })),
        )}
      />

      <PageHeader
        eyebrow={`거시 지표 · ${group.name.toUpperCase()}`}
        title={`${group.emoji} ${group.name}`}
        description={group.question}
      />

      <div className="mx-auto max-w-4xl space-y-8 px-4 py-10 sm:px-6">
        <nav aria-label="현재 위치" className="flex items-center gap-1.5 text-[12px] text-gray-500">
          <Link href="/" className="hover:text-gold-400">
            홈
          </Link>
          <ChevronRightIcon size={12} />
          <Link href="/macro" className="hover:text-gold-400">
            거시 지표
          </Link>
          <ChevronRightIcon size={12} />
          <span className="text-gray-400">{group.name}</span>
        </nav>

        {/* 묶음 소개 — 초보자가 여기서 맥락을 잡는다 */}
        <Card padding="p-5 sm:p-6">
          <p className="text-[14px] leading-relaxed text-gray-300">{group.intro}</p>
          <p className="mt-3 text-[11.5px] text-gray-600">
            지표 {items.length}개 · {detail.asOf ? `가장 최근 기준일 ${detail.asOf}` : "아직 수집 전"}
          </p>
        </Card>

        {/* ⚠ 문제가 없으면 렌더되지 않는다 */}
        <HealthNotice health={detail.health} />

        {/* 지표 목록 — 카드 하나가 지표 하나 */}
        <div className="space-y-5">
          {items.map((view) => (
            <IndicatorCard key={view.indicator.key} view={view} />
          ))}
        </div>

        {/* 블로그로 — 광고보다 위 */}
        <TistoryCta
          headline={`${group.name}를 실제 판단에 어떻게 썼는지 블로그에 적었습니다`}
          postTitle={basics.featuredTitle}
          postExcerpt={basics.featuredExcerpt}
        />

        <AdSlot placement="article-end" />

        {/* 다음 묶음으로 — 한 장만 보고 나가지 않게 */}
        <nav aria-label="다른 지표 묶음" className="grid gap-3 sm:grid-cols-2">
          {prev && (
            <Link
              href={`/macro/${prev.key}`}
              className="rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-gold-600/40"
            >
              <span className="text-[11px] text-gray-500">이전 묶음</span>
              <span className="mt-0.5 block text-[13.5px] font-semibold text-white">
                {prev.emoji} {prev.name}
              </span>
              <span className="text-[12px] text-muted">{prev.question}</span>
            </Link>
          )}
          {next && (
            <Link
              href={`/macro/${next.key}`}
              className="rounded-xl border border-border bg-card px-4 py-3 text-right transition-colors hover:border-gold-600/40 sm:col-start-2"
            >
              <span className="text-[11px] text-gray-500">다음 묶음</span>
              <span className="mt-0.5 block text-[13.5px] font-semibold text-white">
                {next.emoji} {next.name}
              </span>
              <span className="text-[12px] text-muted">{next.question}</span>
            </Link>
          )}
        </nav>

        <p className="text-[11px] leading-relaxed text-gray-600">
          ※ 정보 제공을 위한 기록이며 투자 권유가 아닙니다. 각 지표의 원 출처 링크에서 숫자를 직접
          확인할 수 있고, 발표 기관의 사후 수정에 따라 값이 바뀔 수 있습니다.{" "}
          <Link href="/disclaimer" className="underline hover:text-gold-400">
            투자 판단 책임 고지
          </Link>
        </p>
      </div>
    </>
  );
}

import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { AdSlot } from "@/components/analytics/AdSlot";
import { JsonLd } from "@/components/seo/JsonLd";
import { SectionFrame } from "@/features/posts/ui/SectionFrame";
import { HeroSection } from "@/features/home/ui/HeroSection";
import { AccountStrip } from "@/features/home/ui/AccountStrip";
import { MacroSection } from "@/features/home/ui/MacroSection";
import { MacroStrip } from "@/features/home/ui/MacroStrip";
import { PrinciplesGrid } from "@/features/home/ui/PrinciplesGrid";
import { LatestInsights } from "@/features/home/ui/LatestInsights";
import { JournalAndReports } from "@/features/home/ui/JournalAndReports";
import { visibleHomeBlocks, type HomeBlock } from "@/lib/home-layout";
import { macroLede } from "@/lib/home-lede";
import { MACRO_INDICATORS } from "@/lib/macro/catalog";
import { summarizePerformance } from "@/lib/performance";
import { getSiteBasics } from "@/lib/site-settings";
import { loadPublishedJournal, loadSnapshots } from "@/features/journal/repository";
import { loadRebalances } from "@/features/portfolio/repository";
import { loadBuckets } from "@/features/portfolio/buckets-repo";
import { loadMacroOverview } from "@/features/macro/service";
import { loadPublishedSummaries } from "@/features/reports/repository";
import { loadPublishedPosts, loadSectionPosts } from "@/features/posts/repository";
import { websiteJsonLd } from "@/lib/seo";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site-identity";

/**
 * 홈 — **조립만 한다.**
 *
 * 이 사이트는 서비스 가입을 파는 곳이 아니라 **읽는 곳**이다.
 * 그래서 가입 유도 퍼널을 두지 않고, 첫 화면에서 바로
 * "넣은 돈이 얼마가 됐는지"와 "그때 무슨 판단을 했는지"를 보여준다.
 *
 * ⚠ 2026-08-30(Step 1): 이 파일은 400줄이었고 그 안에 **로드·조립·문구·판단**이 섞여 있었다.
 *    이제 블록은 `features/home/ui/*`, "무엇을 그릴지"는 `lib/home-layout.ts`(순수 함수)다.
 *    ⚠ **판단과 문구를 여기에 다시 넣지 않는다.** 넣는 순간 화면을 띄워야만 확인되는 규칙이
 *    다시 생긴다(CLAUDE.md §1).
 * ⚠ **겉모습은 이 단계에서 한 줄도 바꾸지 않았다.** 콘텐츠 중심 재편은 Step 2 이후다
 *    (`docs/설계_홈_콘텐츠중심_재편.md`).
 */

/** ⚠ 정적 생성 금지 — 기록을 올려도 홈이 안 바뀐다. */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [
    snapshots,
    allJournal,
    basics,
    rebalances,
    macro,
    latestPosts,
    homePosts,
    featuredReports,
    buckets,
  ] = await Promise.all([
    loadSnapshots(),
    loadPublishedJournal(),
    getSiteBasics(),
    loadRebalances(),
    loadMacroOverview(),
    loadPublishedPosts(6),
    loadSectionPosts("HOME", 4),
    loadPublishedSummaries(4),
    loadBuckets(),
  ]);

  const perf = summarizePerformance(snapshots);
  const blocks = visibleHomeBlocks({ homePostCount: homePosts.length });

  /**
   * ⚠ **순서는 `HOME_BLOCKS` 배열이 정한다. 여기서 나열하지 않는다.**
   *
   * 2026-08-30 사고: 전에는 이 파일이 블록을 **JSX로 나열**하고 배열은 "보일지 말지"만
   * 정했다. 그래서 배열 순서를 바꾸고 **테스트까지 통과했는데 화면은 그대로였다** —
   * 순서를 지킨다고 믿은 테스트가 실제로는 아무것도 지키지 않았다.
   * 지금은 아래 표에서 **꺼내 쓰기만** 하므로, 배열과 화면이 어긋날 수가 없다.
   */
  const rendered: Record<HomeBlock, ReactNode> = {
    hero: (
      <HeroSection
        heroTitle={basics.heroTitle}
        heroSubtitle={basics.heroSubtitle}
        lede={macroLede({ empty: macro.empty, summary: macro.summary, asOf: macro.asOf })}
        perf={perf}
        rebalances={rebalances}
        journalCount={allJournal.length}
        indicatorCount={MACRO_INDICATORS.length}
      />
    ),
    macroStrip: <MacroStrip indicators={macro.headlines} />,
    latestInsights: (
      <LatestInsights
        posts={latestPosts.filter((p) => p.type !== "NOTICE")}
        featuredTitle={basics.featuredTitle}
        featuredExcerpt={basics.featuredExcerpt}
      />
    ),
    /* 발행할 때마다 여기가 한 편씩 길어진다(features/posts/ui/SectionFrame). */
    homePosts: (
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pb-14">
        <SectionFrame section="HOME" posts={homePosts} />
      </div>
    ),
    macro: <MacroSection macro={macro} />,
    /* ⚠ 계좌는 콘텐츠를 읽은 **뒤에** 온다 — 입구가 아니라 증거다(2026-08-30, Step 2). */
    accountStrip: <AccountStrip perf={perf} buckets={buckets} dataMode={basics.dataMode} />,
    journalAndReports: (
      <JournalAndReports entries={allJournal.slice(0, 3)} reports={featuredReports} />
    ),
    principles: <PrinciplesGrid />,
  };

  return (
    <>
      {/*
        ⚠ 홈에 구조화 데이터가 **하나도 없었다**(2026-08-31, Step 5). 지표 묶음 화면은
        `Dataset`으로 자기를 밝히는데, 정작 "이 사이트가 무엇인가"는 검색·AI가 HTML로
        추측하고 있었다. 홈의 성격이 계좌에서 콘텐츠로 바뀐 마당에 가장 먼저 정정할 자리다.
      */}
      <JsonLd data={websiteJsonLd({ name: SITE_NAME, description: SITE_DESCRIPTION })} />

      {blocks.map((block) => (
        <Fragment key={block}>{rendered[block]}</Fragment>
      ))}

      {/* 광고 — 콘텐츠를 다 훑은 자리. 첫 화면은 광고 없이 콘텐츠로 시작한다. */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <AdSlot placement="content-bottom" />
      </div>

      {/* 광고·검색 심사에서도 첫 페이지에 고지가 보여야 한다 */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pb-14">
        <p className="text-[11px] leading-relaxed text-gray-600">
          ※ Woodsman의 모든 콘텐츠는 개인의 기록이자 정보 제공 목적이며, 투자 권유나 자문이
          아닙니다. 과거의 성과는 미래의 수익을 보장하지 않으며 투자 판단과 그 결과의 책임은
          투자자 본인에게 있습니다.{" "}
          <Link href="/disclaimer" className="text-gray-500 underline hover:text-gold-400">
            투자 판단 책임 고지
          </Link>
          {" · "}
          <Link href="/privacy" className="text-gray-500 underline hover:text-gold-400">
            개인정보 처리방침
          </Link>
        </p>
      </div>
    </>
  );
}

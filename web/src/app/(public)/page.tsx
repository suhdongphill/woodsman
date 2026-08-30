import Link from "next/link";
import { AdSlot } from "@/components/analytics/AdSlot";
import { SectionFrame } from "@/features/posts/ui/SectionFrame";
import { HeroSection } from "@/features/home/ui/HeroSection";
import { CapitalFlowSection } from "@/features/home/ui/CapitalFlowSection";
import { MacroSection } from "@/features/home/ui/MacroSection";
import { PrinciplesGrid } from "@/features/home/ui/PrinciplesGrid";
import { LatestInsights } from "@/features/home/ui/LatestInsights";
import { JournalAndReports } from "@/features/home/ui/JournalAndReports";
import { hasBlock, visibleHomeBlocks } from "@/lib/home-layout";
import { summarizePerformance } from "@/lib/performance";
import { getSiteBasics } from "@/lib/site-settings";
import { loadPublishedJournal, loadSnapshots } from "@/features/journal/repository";
import { loadRebalances } from "@/features/portfolio/repository";
import { loadBuckets } from "@/features/portfolio/buckets-repo";
import { loadMacroOverview } from "@/features/macro/service";
import { loadPublishedSummaries } from "@/features/reports/repository";
import { loadPublishedPosts, loadSectionPosts } from "@/features/posts/repository";

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
    loadPublishedPosts(3),
    loadSectionPosts("HOME", 4),
    loadPublishedSummaries(4),
    loadBuckets(),
  ]);

  const perf = summarizePerformance(snapshots);
  const blocks = visibleHomeBlocks({
    hasAccountCurve: perf !== null,
    homePostCount: homePosts.length,
  });

  return (
    <>
      {hasBlock(blocks, "hero") && (
        <HeroSection
          heroTitle={basics.heroTitle}
          heroSubtitle={basics.heroSubtitle}
          perf={perf}
          buckets={buckets}
          rebalances={rebalances}
          journalCount={allJournal.length}
        />
      )}

      {hasBlock(blocks, "capitalFlow") && (
        <CapitalFlowSection
          snapshots={snapshots}
          rebalances={rebalances}
          dataMode={basics.dataMode}
        />
      )}

      {hasBlock(blocks, "macro") && <MacroSection macro={macro} />}

      {hasBlock(blocks, "principles") && <PrinciplesGrid />}

      {/* 발행할 때마다 여기가 한 편씩 길어진다(features/posts/ui/SectionFrame). */}
      {hasBlock(blocks, "homePosts") && (
        <div className="mx-auto max-w-6xl px-4 sm:px-6 pb-14">
          <SectionFrame section="HOME" posts={homePosts} />
        </div>
      )}

      {hasBlock(blocks, "latestInsights") && (
        <LatestInsights
          posts={latestPosts.filter((p) => p.type !== "NOTICE")}
          featuredTitle={basics.featuredTitle}
          featuredExcerpt={basics.featuredExcerpt}
        />
      )}

      {hasBlock(blocks, "journalAndReports") && (
        <JournalAndReports entries={allJournal.slice(0, 3)} reports={featuredReports} />
      )}

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

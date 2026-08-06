/**
 * 사이트 지식 창고 — D1의 기록을 검색 가능한 문서로 편다.
 *
 * ## 무엇을 넣나
 * 글 · 투자일지 · 보유 종목 · 거시 지표 최신값 · 버블 채점. 전부 **사이트가 이미 공개한 것**이다.
 *
 * ⚠ 넣지 않는 것: 미발행 글, 계좌 절대금액, 개인 식별 정보.
 *    AI에 넘어가는 자리라 공개 화면에 없는 것은 여기에도 없어야 한다
 *    (`lib/ai/context.ts`의 규칙과 같은 선).
 *
 * ## 왜 매 요청마다 만드나
 * 문서가 수백 건 규모라 색인을 따로 저장할 만큼 크지 않고, 저장하면 **원본과 색인이 어긋나는**
 * 문제가 새로 생긴다(글을 고쳤는데 검색은 옛 문장을 준다). 지금 규모에선 그때그때 만드는 편이
 * 정직하고 빠르다. 커지면 그때 색인을 두면 된다.
 */
import { loadPublishedPosts } from "@/features/posts/repository";
import { loadPublishedJournal, loadSnapshots } from "@/features/journal/repository";
import { loadPublishedHoldings } from "@/features/portfolio/repository";
import { loadMacroStatus } from "@/features/macro/service";
import { loadReadings } from "@/features/bubble/repository";
import { findBubbleIndicator } from "@/lib/bubble/catalog";
import { toPlainText } from "@/lib/markdown";
import { FUNCTION_LABEL_KO } from "@/lib/ai/labels";
import type { KnowledgeDoc } from "@/lib/ai/retrieval";

/** 사이트 전체 기록을 문서로. */
export async function loadKnowledgeDocs(): Promise<KnowledgeDoc[]> {
  const [posts, journal, holdings, macro, bubble, snapshots] = await Promise.all([
    loadPublishedPosts(100),
    loadPublishedJournal(100),
    loadPublishedHoldings(),
    loadMacroStatus(),
    loadReadings(),
    loadSnapshots(24),
  ]);

  const docs: KnowledgeDoc[] = [];

  for (const post of posts) {
    docs.push({
      id: `post:${post.id}`,
      kind: "post",
      title: post.title,
      text: [post.excerpt, post.bodyHtml ? toPlainText(post.bodyHtml, 1500) : "", post.tags]
        .filter(Boolean)
        .join(" "),
      href: `/insights/${post.slug}`,
      date: post.publishedAt,
    });
  }

  for (const entry of journal) {
    docs.push({
      id: `journal:${entry.id}`,
      kind: "journal",
      title: entry.title,
      text: [entry.body, entry.name, entry.ticker].filter(Boolean).join(" "),
      href: "/journal",
      date: entry.date,
    });
  }

  for (const holding of holdings) {
    docs.push({
      id: `holding:${holding.id}`,
      kind: "holding",
      title: `${holding.name}${holding.ticker ? ` (${holding.ticker})` : ""}`,
      text: [
        FUNCTION_LABEL_KO[holding.functionType],
        holding.targetWeight != null ? `목표 비중 ${holding.targetWeight}%` : "",
        holding.thesis,
      ]
        .filter(Boolean)
        .join(" · "),
      href: "/portfolio",
      date: holding.priceAsOf,
    });
  }

  // 거시 지표는 "지금 값 + 읽는 법"을 한 문서로. 값이 없는 지표는 넣지 않는다.
  for (const view of macro) {
    if (!view.asOf) continue;
    docs.push({
      id: `macro:${view.indicator.key}`,
      kind: "macro",
      title: `${view.indicator.name} ${view.display}`,
      text: [view.indicator.what, view.indicator.why, view.indicator.read].join(" "),
      href: `/macro/${view.indicator.group}`,
      date: view.asOf,
    });
  }

  for (const [key, reading] of bubble) {
    const found = findBubbleIndicator(key);
    if (!found) continue;
    docs.push({
      id: `bubble:${key}`,
      kind: "bubble",
      title: `${found.indicator.label} ${reading.points}점`,
      text: [found.layer.name, found.indicator.rule, reading.value, reading.note]
        .filter(Boolean)
        .join(" · "),
      href: "/macro/bubble",
      date: reading.asOf,
    });
  }

  // 계좌는 비율만. ⚠ 절대금액은 넣지 않는다.
  const latest = snapshots[snapshots.length - 1];
  if (latest && latest.principal > 0) {
    const returnPct = ((latest.value - latest.principal) / latest.principal) * 100;
    docs.push({
      id: "snapshot:latest",
      kind: "snapshot",
      title: `계좌 수익률 ${returnPct.toFixed(1)}%`,
      text: `${latest.date} 기준 납입원금 대비 평가액 ${returnPct.toFixed(1)}%. ${snapshots.length}개월 기록. ${latest.memo ?? ""}`,
      href: "/portfolio",
      date: latest.date,
    });
  }

  return docs;
}

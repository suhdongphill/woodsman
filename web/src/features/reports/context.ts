/**
 * **사이트가 이미 아는 것**을 지금 값으로 읽어 온다 — 거시 · 버블 · 대표 포트폴리오.
 *
 * ## 왜 여기 모으나
 * 보고서 화면이 거시 서비스·버블 저장소·포트폴리오 저장소를 각각 부르면,
 * 나중에 시세(계획서 C단계)가 붙을 때 화면 세 곳을 고쳐야 한다.
 * **한 곳에서 모아** 순수 모듈(`lib/report/context.ts`)이 아는 모양으로 내려보낸다.
 *
 * ⚠ 판정·서식은 하지 않는다. 판정은 이미 각 도메인이 했고(침체 종합·버블 점수),
 *    서식은 순수 모듈이 한다. 여기는 **옮겨 담기**만 한다.
 * ⚠ 무료 등급은 Worker 호출당 D1 쿼리 50개다. 여기서 나가는 것은 **4번**이고
 *    전부 병렬로 보낸다.
 */
import { loadMacroOverview } from "@/features/macro/service";
import { loadReadings, loadTriggerStates } from "@/features/bubble/repository";
import { findPublishedHoldingByTicker } from "@/features/portfolio/repository";
import { scoreBubble } from "@/lib/bubble/score";
import { BIAS_LABEL } from "@/lib/macro/fedhike";
import type { SiteContext } from "@/lib/report/context";

/**
 * 지금 시점의 사이트 자료.
 *
 * ⚠ 값이 없으면 **없는 채로** 내려보낸다. `level: "unknown"`·`score: undefined`가
 *    "아직 안 가져왔다"는 뜻이고, 화면이 그렇게 말한다. 0이나 "안정"으로 메우지 않는다.
 */
export async function captureSiteContext(ticker: string): Promise<SiteContext> {
  const [overview, readings, triggers, holding] = await Promise.all([
    loadMacroOverview(),
    loadReadings(),
    loadTriggerStates(),
    findPublishedHoldingByTicker(ticker),
  ]);

  const bubble = scoreBubble(readings);
  const fed = overview.fedHike;

  return {
    macro: {
      level: overview.summary.level,
      label: overview.summary.label,
      line: overview.summary.line,
      alerts: overview.summary.alerts,
      watches: overview.summary.watches,
      unknowns: overview.summary.unknowns,
      total: overview.summary.total,
      asOf: overview.asOf,
      fed: fed
        ? {
            bias: fed.bias,
            biasLabel: BIAS_LABEL[fed.bias],
            hike: fed.hike,
            hold: fed.hold,
            cut: fed.cut,
            // ⚠ 가장 최근이 아니라 **가장 오래된** 기준일이다(`loadMacroOverview`가 그렇게 낸다).
            asOf: overview.fedHikeAsOf,
          }
        : undefined,
    },
    bubble: {
      score: bubble.score,
      regime: bubble.band?.regime,
      stance: bubble.band?.stance,
      scored: bubble.coverage.scored,
      total: bubble.coverage.total,
      priorityFired: bubble.priorityFired,
      firedTriggerKeys: [...triggers.values()].filter((t) => t.fired).map((t) => t.key),
    },
    holding: {
      inPortfolio: !!holding,
      functionType: holding?.functionType,
      targetWeight: holding?.targetWeight,
      thesis: holding?.thesis,
    },
  };
}

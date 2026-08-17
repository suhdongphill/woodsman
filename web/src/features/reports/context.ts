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
 * ⚠ 무료 등급은 Worker 호출당 D1 쿼리 50개다. 여기서 나가는 것은 **5번**이고
 *    전부 병렬로 보낸다.
 */
import { loadMacroOverview } from "@/features/macro/service";
import { loadQuotes } from "@/features/stocks/repository";
import { buildQuoteKpi } from "@/lib/quote/kpi";
import { buildEnvelope } from "@/lib/quote/envelope";
import { currencyForMarket, planSymbol } from "@/lib/quote/parse";
import type { QuoteContext } from "@/lib/report/context";
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
export async function captureSiteContext(
  ticker: string,
  /**
   * 종목의 시장. `StockReport`가 이미 갖고 있는 값을 **넘겨받는다** —
   * 여기서 보고서를 다시 읽으면 부르는 쪽이 방금 읽은 것을 한 번 더 읽는다.
   * ⚠ 통화는 받지 않는다. 시세 통화는 **상장 시장이 정한다**(`currencyForMarket`).
   * ⚠ 시장이 없으면 통화·단서 없이 숫자만 낸다. 그렇다고 주입 전체를 막지 않는다.
   */
  stock?: { market?: string },
): Promise<SiteContext> {
  const [overview, readings, triggers, holding, quotes] = await Promise.all([
    loadMacroOverview(),
    loadReadings(),
    loadTriggerStates(),
    findPublishedHoldingByTicker(ticker),
    loadQuotes(ticker),
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
    quote: buildQuoteContext(quotes, ticker, stock),
  };
}

/**
 * 시세 시계열 → 보고서가 아는 모양.
 *
 * ⚠ **계산은 `lib/quote/*`가 한다.** 여기는 옮겨 담기만 한다.
 * ⚠ 점이 하나도 없으면 **빈 객체**를 낸다. `price: undefined`가 "아직 안 가져왔다"는
 *    뜻이고, 화면이 그렇게 말한다. 0으로 메우지 않는다.
 */
function buildQuoteContext(
  quotes: Awaited<ReturnType<typeof loadQuotes>>,
  ticker: string,
  stock?: { market?: string },
): QuoteContext {
  const kpi = buildQuoteKpi(quotes);
  if (!kpi) return {};

  const envelope = buildEnvelope(quotes);

  // ⚠ 국내 종목은 Yahoo 경유라 지연·결측이 있다. 그 사실을 값과 함께 들고 간다(설계서 §5-2).
  const caveat = stock?.market ? planSymbol(ticker, stock.market)?.caveat : undefined;
  const currency = stock?.market ? currencyForMarket(stock.market) : undefined;

  return {
    price: kpi.price,
    asOf: kpi.asOf,
    currency,
    changePercent: kpi.change?.percent,
    low52: kpi.range?.low,
    high52: kpi.range?.high,
    position52: kpi.range?.position,
    rangeSamples: kpi.range?.samples,
    volumeMultiple: kpi.volume?.multiple,
    caveat,
    envelope: envelope
      ? {
          middle: envelope.middle,
          upper: envelope.upper,
          lower: envelope.lower,
          position: envelope.position,
          deviation: envelope.deviation,
          weeks: envelope.weeks,
        }
      : undefined,
  };
}

/**
 * AI에 넘길 컨텍스트 조립 — 순수 함수.
 *
 * ## 왜 종목 데이터만 던지면 안 되나
 * "TSMC 분석해줘"는 어떤 모델이든 일반론을 뱉는다. 검색하면 나오는 이야기다.
 * 이 사이트가 낼 수 있는 값은 **운영자의 계좌 맥락 안에서 본 그 종목**이다:
 * 지금 어느 버킷이 몇 %인지, 이 종목이 그 안에서 무슨 일을 맡고 있는지,
 * 이미 적어 둔 편입 논리가 무엇인지, 최근에 무슨 판단을 했는지.
 * 그걸 같이 넣어야 페르소나가 제 역할을 한다.
 *
 * ## 넣지 않는 것
 * - 개인 식별 정보, 계좌번호, 실제 잔고의 절대금액 → 비율과 논리만 넘긴다.
 * - 자료에 없는 값을 채워 넣지 않는다. 없으면 "자료 없음"으로 명시한다 —
 *   빈칸을 두면 모델이 지어낸다.
 */
import type { FunctionType, JournalEntry, ModelHolding, StockSummary } from "../types";
import { FUNCTION_LABEL_KO } from "./labels";

export type PortfolioContext = {
  /** 기능별 목표 비중(%) */
  allocation: Record<FunctionType, number>;
  /** 공개 보유 종목 (금액 아님 — 비중과 논리만) */
  holdings: Pick<ModelHolding, "name" | "ticker" | "functionType" | "targetWeight" | "thesis">[];
  /** 최근 판단 기록 */
  recentJournal: Pick<JournalEntry, "date" | "action" | "title" | "body">[];
};

function fmtAllocation(alloc: Record<FunctionType, number>): string {
  return (Object.keys(alloc) as FunctionType[])
    .map((f) => `${FUNCTION_LABEL_KO[f]} ${alloc[f]}%`)
    .join(" / ");
}

function fmtOrNone(value: string | number | null | undefined, suffix = ""): string {
  if (value === null || value === undefined || value === "") return "자료 없음";
  return `${value}${suffix}`;
}

/** 계좌 전체 맥락 — 모든 작업에 공통으로 붙인다. */
export function renderPortfolioContext(ctx: PortfolioContext): string {
  const holdings = ctx.holdings
    .map(
      (h) =>
        `- ${h.name}${h.ticker ? ` (${h.ticker})` : ""} · ${FUNCTION_LABEL_KO[h.functionType]} · 목표 ${fmtOrNone(h.targetWeight, "%")}\n` +
        `  편입 논리: ${fmtOrNone(h.thesis)}`,
    )
    .join("\n");

  const journal = ctx.recentJournal
    .map((j) => `- ${j.date} [${j.action}] ${j.title}\n  ${j.body}`)
    .join("\n");

  return `## 이 계좌의 현재 상태

기능별 목표 배분: ${fmtAllocation(ctx.allocation)}

보유 종목과 편입 논리
${holdings || "자료 없음"}

최근 판단 기록
${journal || "자료 없음"}`;
}

/** 기업분석 — 종목 자료 + 계좌 맥락 + 이미 적어 둔 논리 */
export function renderCompanyAnalysisInput(input: {
  stock: StockSummary;
  holding?: Pick<ModelHolding, "functionType" | "targetWeight" | "thesis">;
  portfolio: PortfolioContext;
}): string {
  const { stock, holding, portfolio } = input;

  return `${renderPortfolioContext(portfolio)}

## 분석 대상

종목: ${stock.name} (${stock.ticker}) · ${stock.market} · ${stock.industry}
현재가: ${stock.price} ${stock.currency} (전일 대비 ${stock.changePct}%)
CANSLIM 종합: ${fmtOrNone(stock.canslim)}
최근 종가 흐름(오래된 순): ${stock.spark.join(", ")}

${
  holding
    ? `이 종목은 이미 편입돼 있습니다.
- 맡은 기능: ${FUNCTION_LABEL_KO[holding.functionType]}
- 목표 비중: ${fmtOrNone(holding.targetWeight, "%")}
- 기존 편입 논리: ${fmtOrNone(holding.thesis)}

기존 논리를 다시 쓰지 말고, **여전히 유효한지**와 **무엇이 달라졌는지**를 중심으로 쓰세요.`
    : `이 종목은 아직 편입돼 있지 않습니다. 편입한다면 어느 기능을 맡을 수 있는지부터 판단하세요.`
}

위 자료에 없는 수치는 쓰지 마세요. 필요한데 없으면 "자료에 없음"으로 표시하세요.`;
}

/** 차트 분석 — 시계열만. 계좌 맥락은 넣지 않는다(관찰에 편향을 주지 않기 위해). */
export function renderChartReadInput(stock: StockSummary): string {
  return `종목: ${stock.name} (${stock.ticker}) · ${stock.currency}
종가 시계열(오래된 순, 총 ${stock.spark.length}개): ${stock.spark.join(", ")}
현재가: ${stock.price}

이 숫자들만으로 관측 가능한 것을 기술하세요.`;
}

/** CANSLIM 채점 — 채점 기준을 함께 넣어야 규칙대로 채점한다. */
export function renderCanslimInput(input: { stock: StockSummary; rubric: string }): string {
  return `## 채점 기준
${input.rubric}

## 대상 자료
종목: ${input.stock.name} (${input.stock.ticker}) · ${input.stock.industry}
현재가: ${input.stock.price} ${input.stock.currency}
종가 시계열: ${input.stock.spark.join(", ")}

자료에 없어 채점할 수 없는 지표는 score를 null로 두고 note에 이유를 쓰세요.`;
}

/** 투자일지 초안 — 운영자 메모가 원본이다. 내용을 늘리지 않는다. */
export function renderJournalDraftInput(input: {
  memo: string;
  entry?: Pick<JournalEntry, "action" | "ticker" | "name" | "shares" | "price" | "currency">;
  portfolio: PortfolioContext;
}): string {
  const e = input.entry;
  return `${renderPortfolioContext(input.portfolio)}

## 운영자가 쓴 메모 (원본 — 이 안의 판단만 사용하세요)
${input.memo}

## 체결 정보
${
  e
    ? `- 구분: ${e.action}
- 종목: ${fmtOrNone(e.name)}${e.ticker ? ` (${e.ticker})` : ""}
- 수량: ${fmtOrNone(e.shares)}
- 단가: ${fmtOrNone(e.price)} ${e.currency ?? ""}`
    : "자료 없음"
}

메모에 없는 근거를 추가하지 마세요. 메모가 인정한 실수는 그대로 남기세요.`;
}

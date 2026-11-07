import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ModelHolding } from "@/lib/types";
import { HoldingCard } from "./HoldingCard";

const holding = {
  id: "bk_000660",
  name: "SK하이닉스",
  ticker: "000660",
  market: "KOSPI",
  functionType: "GROWTH",
  currency: "KRW",
  price: 500000,
  priceAsOf: "2026-11-07",
  avgCost: 400000,
  shares: 1234,
} as unknown as ModelHolding;

describe("HoldingCard", () => {
  it("보고서와 블로그를 함께 잇되 링크 안에 링크를 넣지 않는다", () => {
    const html = renderToStaticMarkup(
      <HoldingCard holding={holding} reportHref="/stocks/000660" blogHref="/go/stock-000660" weightPct={3.21} />,
    );
    expect(html).toContain('href="/stocks/000660"');
    expect(html).toContain('href="/go/stock-000660"');
    expect(html).not.toMatch(/<a[^>]*>(?:(?!<\/a>)[\s\S])*<a/);
  });

  it("⚠ 연결이 없으면 링크를 만들지 않는다 — 404로 보내지 않는다", () => {
    expect(renderToStaticMarkup(<HoldingCard holding={holding} />)).not.toContain("<a");
  });

  it("⚠ 비중을 내고 수량·평단은 내지 않는다", () => {
    const html = renderToStaticMarkup(<HoldingCard holding={holding} weightPct={3.21} />);
    expect(html).toContain("3.2%");
    expect(html).not.toContain("1,234");
    expect(html).not.toContain("400,000");
  });
});

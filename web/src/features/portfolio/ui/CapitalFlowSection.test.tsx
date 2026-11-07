/**
 * 자금 흐름 섹션 — **스냅숏이 없을 때 사라지지 않는가**.
 *
 * ⚠ 이 규칙은 소스를 훑어서는 못 지킨다. 조건이 어디에 붙었든 결과가 같아야 하므로
 *    **실제로 그려 보고** 문장이 남아 있는지 본다(2026-08-31, 홈 재편 Step 4).
 *    전에는 `perf`가 `null`이면 섹션이 통째로 빠져, 계좌 페이지의 첫 화면이 비어 있었다.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CapitalFlowSection } from "./CapitalFlowSection";
import { summarizePerformance } from "@/lib/performance";
import type { AccountSnapshot } from "@/lib/types";

const SNAPSHOTS: AccountSnapshot[] = [
  { date: "2026-01-31", principal: 5_000_000, value: 5_100_000, income: 10_000 },
  { date: "2026-02-28", principal: 5_500_000, value: 5_900_000, income: 20_000 },
];

describe("CapitalFlowSection", () => {
  it("⚠ 스냅숏이 없어도 섹션과 제목이 남고, 0원으로 만들지 않는다", () => {
    const html = renderToStaticMarkup(<CapitalFlowSection perf={null} />);
    expect(html).toContain("수익률 기록");
    expect(html).toContain("금액은 공개하지 않고");
    expect(html).not.toMatch(/0원|₩0/);
  });

  it("⚠ 스냅숏이 있어도 금액을 내지 않는다 — 수익률과 기준일만", () => {
    const perf = summarizePerformance(SNAPSHOTS);
    const html = renderToStaticMarkup(<CapitalFlowSection perf={perf} />);
    expect(html).toContain("기준");
    expect(html).toContain("수익률");
    // 평가액 5,900,000 · 납입원금 5,500,000 · 손익 400,000이 어떤 꼴로도 나가면 안 된다.
    expect(html).not.toMatch(/5,900,000|5,500,000|400,000|590만|550만|40만/);
    expect(html).not.toContain("평가액");
  });
});

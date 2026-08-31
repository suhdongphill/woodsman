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
  it("⚠ 스냅숏이 없어도 섹션과 제목이 남고, 「없다」고 적는다 — 0원으로 만들지 않는다", () => {
    const html = renderToStaticMarkup(
      <CapitalFlowSection snapshots={[]} rebalances={[]} perf={null} />,
    );

    expect(html).toContain("넣은 돈과 불어난 돈");
    expect(html).toContain("아직 계좌 스냅숏이 없습니다");
    // 없는 숫자를 0으로 그리지 않는다.
    expect(html).not.toMatch(/0원|₩0/);
  });

  it("스냅숏이 있으면 평가액·수익률과 기준일을 함께 낸다", () => {
    const perf = summarizePerformance(SNAPSHOTS);
    const html = renderToStaticMarkup(
      <CapitalFlowSection snapshots={SNAPSHOTS} rebalances={[]} perf={perf} />,
    );

    expect(html).not.toContain("아직 계좌 스냅숏이 없습니다");
    // ⚠ 날짜 없는 숫자는 실시간 시세로 읽힌다(운영지침 §5).
    expect(html).toContain("기준");
    expect(html).toContain("납입원금");
  });
});

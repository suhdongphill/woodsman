import { describe, expect, it } from "vitest";
import { baseTicker, buildLeadersView, divergingWidth, formatFlowMillions, supplyText, type GroupRow, type MemberRow } from "./view";

const group = (groupId: string, name: string, ord: number, rs: number | null): GroupRow => ({
  groupId, ord, name, why: null, src: null, rsMedianM3: rs, breadthHigh: 0, leaders: 0, prime: 0,
  supply: JSON.stringify({ basis: "proxy", label: "프록시" }), etf: "[]",
});
const member = (groupId: string, ticker: string, cls: string, extra: Partial<MemberRow> = {}): MemberRow => ({
  groupId, ticker, ord: 0, name: ticker, role: null, mkt: "us", cls, tier: null, why: null, flag: null,
  rs3m: null, offHigh: null, revYoy: null, accel: null, detail: "{}", ...extra,
});
const run = { id: "2026-09-25", collectedAt: "2026-09-25 17:11", meta: "{}", fit: null };

describe("주도주 화면", () => {
  it("판정 수를 세고, 가장 앞선·뒤처진 레이어로 한 문장을 만든다", () => {
    const v = buildLeadersView({
      run,
      groups: [group("semi", "반도체", 0, -7), group("model", "모델·플랫폼", 1, 51.2)],
      members: [
        member("semi", "AMD", "leader", { tier: "prime" }),
        member("model", "PLTR", "leader"),
        member("semi", "MU", "watch", { detail: JSON.stringify({ fund: { price_driven: true } }) }),
      ],
      today: "2026-09-25",
    });
    expect(v.counts.leader).toBe(2);
    expect(v.headline).toContain("가장 앞선 칸은 모델·플랫폼(중앙값 +51.2%p)");
    expect(v.headline).toContain("★★는 AMD");
    expect(v.priceDriven).toEqual(["MU"]);
    expect(v.stale).toBe(false);
  });

  it("⚠ 지난 실행과 비교해 판정 변화를 낸다 — 새 주도주가 맨 앞", () => {
    const v = buildLeadersView({
      run,
      groups: [group("semi", "반도체", 0, 1)],
      members: [member("semi", "A", "leader"), member("semi", "B", "candidate"), member("semi", "C", "out"), member("semi", "NEW", "leader")],
      prev: { id: "2026-09-18", members: [
        { groupId: "semi", ticker: "A", cls: "candidate" },
        { groupId: "semi", ticker: "B", cls: "leader" },
        { groupId: "semi", ticker: "C", cls: "out" },
      ] },
      today: "2026-09-25",
    });
    expect(v.changes.map((c) => [c.ticker, c.kind])).toEqual([["A", "new_leader"], ["B", "dropped_leader"]]);
    // 지난번에 없던 종목은 변화가 아니라 편입이다
    expect(v.changes.find((c) => c.ticker === "NEW")).toBeUndefined();
  });

  it("운영 포트폴리오 보유 종목을 잇는다 — 한국 티커 접미사를 떼고 맞춘다", () => {
    const v = buildLeadersView({
      run,
      groups: [group("kr", "한국 축", 0, 1)],
      members: [member("kr", "005930.KS", "leader"), member("kr", "000660.KS", "leader")],
      heldTickers: ["005930"],
      today: "2026-09-25",
    });
    expect(v.groups[0].members.map((m) => m.held)).toEqual([true, false]);
    expect(baseTicker("240810.KQ")).toBe("240810");
  });

  it("⚠ JSON 칸을 못 읽으면 그 부분만 비우고 사유를 남긴다", () => {
    const v = buildLeadersView({
      run: { ...run, fit: "{깨짐" },
      groups: [{ ...group("semi", "반도체", 0, 1), etf: "not json" }],
      members: [],
      today: "2026-09-25",
    });
    expect(v.fit).toBeUndefined();
    expect(v.groups[0].etf).toEqual([]);
    expect(v.problems).toEqual(["반도체 ETF", "실증 적합도"]);
  });

  it("⚠ 수집일이 한 주보다 오래되면 「오래됨」", () => {
    expect(buildLeadersView({ run, groups: [], members: [], today: "2026-10-03" }).stale).toBe(false);
    expect(buildLeadersView({ run, groups: [], members: [], today: "2026-10-04" }).stale).toBe(true);
  });

  it("실증 적합도는 판정 순서대로, 강조 표시(**)를 걷어 낸다", () => {
    const fit = { by_class: { out: { m3: { n: 1, mean: 1, win: 50, t: 1 } }, leader: { m3: { n: 2, mean: 13, win: 65, t: 9 } } }, caveats: ["**오늘의 눈으로** 골랐다"] };
    const v = buildLeadersView({ run: { ...run, fit: JSON.stringify(fit) }, groups: [], members: [], today: "2026-09-25" });
    expect(v.fit?.byClass.map((r) => r.cls)).toEqual(["leader", "out"]);
    expect(v.fit?.caveats[0]).toBe("오늘의 눈으로 골랐다");
    expect(v.fit?.spread).toBe(12);
  });

  it("막대 폭은 0을 가운데 두고 절반까지", () => {
    expect(divergingWidth(51.2, 51.2)).toBe(50);
    expect(divergingWidth(-12.6, 51.2)).toBeCloseTo(12.3, 1);
    expect(divergingWidth(1, 0)).toBe(0);
  });
});

describe("수급 표기", () => {
  it("⚠ 단위는 백만원 — 조·억으로 바꾼다", () => {
    expect(formatFlowMillions(1096914)).toBe("+1.10조");
    expect(formatFlowMillions(-10720000)).toBe("−10.72조");
    expect(formatFlowMillions(4500)).toBe("+45억");
    expect(formatFlowMillions(null)).toBeNull();
  });
  it("설명의 「프록시 — 」 머리를 뗀다(칩과 겹치지 않게)", () => {
    expect(supplyText("프록시 — ETF 거래대금 20일÷60일 (실제 순유입 아님)")).toBe("ETF 거래대금 20일÷60일 (실제 순유입 아님)");
    expect(supplyText("KIS 실측")).toBe("KIS 실측");
  });
});

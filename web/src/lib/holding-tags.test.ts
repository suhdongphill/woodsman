import { describe, expect, it } from "vitest";
import { describeTags, toHoldingTags } from "./holding-tags";

const EMPTY = {
  layer: null,
  layerName: null,
  leaderClass: null,
  leaderTier: null,
  assetKind: null,
  leverage: null,
  verdictFlag: null,
  verdictAsOf: null,
};

describe("DB 행 → 태그", () => {
  it("전부 비었으면 태그가 없다 — 수기 종목은 판정을 싣지 않았다", () => {
    expect(toHoldingTags(EMPTY)).toBeUndefined();
  });

  it("판정일은 날짜만 남긴다", () => {
    const t = toHoldingTags({ ...EMPTY, leaderClass: "leader", verdictAsOf: "2026-09-25T12:00:00.000Z" });
    expect(t?.asOf).toBe("2026-09-25");
  });
});

describe("태그 → 화면", () => {
  const today = "2026-09-25";

  it("주도주는 등급 별을 붙인다", () => {
    const v = describeTags({ leaderClass: "leader", leaderTier: "prime", layerName: "반도체", asOf: today }, today);
    expect(v.verdict).toMatchObject({ label: "주도주", stars: "★★", tone: "emerald" });
    expect(v.layer).toBe("반도체");
    expect(v.stale).toBe(false);
  });

  it("⚠ 별은 주도주에만 — 다른 판정에 등급이 새어 들어와도 그리지 않는다", () => {
    const v = describeTags({ leaderClass: "watch", leaderTier: "core", asOf: today }, today);
    expect(v.verdict?.label).toBe("추격 주의");
    expect(v.verdict?.stars).toBe("");
  });

  it("⚠ 모르는 판정 값은 그리지 않는다 — 이름을 지어내지 않는다", () => {
    expect(describeTags({ leaderClass: "new_class", asOf: today }, today).verdict).toBeUndefined();
  });

  it("레이어가 없으면 「레이어 밖」이라고 말한다", () => {
    expect(describeTags({ leaderClass: "out", asOf: today }, today).layer).toBe("레이어 밖");
  });

  it("종류는 ETF·ADR·레버리지만 칩으로 — 개별주는 칩이 없다", () => {
    expect(describeTags({ assetKind: "STOCK", asOf: today }, today).kind).toBeUndefined();
    expect(describeTags({ assetKind: "DEPOSITARY_RECEIPT", asOf: today }, today).kind).toBe("ADR");
    expect(describeTags({ assetKind: "ETF", leverage: 3, asOf: today }, today).kind).toBe("ETF · 레버리지 3배");
  });

  it("경고는 문장 단위로 편다", () => {
    const v = describeTags({ flag: "탈락 경계 · 비대칭 유리 — 상방 203", asOf: today }, today);
    expect(v.flags).toEqual(["탈락 경계", "비대칭 유리 — 상방 203"]);
  });

  it("⚠ 판정일이 없거나 한 주보다 오래되면 「오래됨」", () => {
    expect(describeTags({ leaderClass: "leader" }, today).stale).toBe(true);
    expect(describeTags({ leaderClass: "leader", asOf: "2026-09-17" }, today).stale).toBe(false);
    expect(describeTags({ leaderClass: "leader", asOf: "2026-09-16" }, today).stale).toBe(true);
  });
});

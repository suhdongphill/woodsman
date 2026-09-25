import { describe, expect, it } from "vitest";
import { verdictMix } from "./verdict-mix";

const t = (leaderClass: string, layerName?: string, leaderTier?: string) => ({ leaderClass, layerName, leaderTier });

describe("주도주 칸 안/밖 비중", () => {
  it("판정별 평가액 비중과 안·★·밖을 낸다", () => {
    const m = verdictMix([
      { valueKrw: 40, tags: t("leader", "반도체", "core") },
      { valueKrw: 10, tags: t("leader", "전력·인프라", "wide") },
      { valueKrw: 20, tags: t("candidate", "반도체") },
      { valueKrw: 20, tags: t("watch") },
      { valueKrw: 10, tags: t("out") },
    ]);
    expect(m.insidePct).toBe(50);
    expect(m.starPct).toBe(40);
    expect(m.outsidePct).toBe(30);
    expect(m.byClass.map((r) => r.key)).toEqual(["leader", "candidate", "watch", "out"]);
  });

  it("레이어는 비중 큰 순, 「레이어 밖」은 맨 끝", () => {
    const m = verdictMix([
      { valueKrw: 10, tags: t("leader", "전력·인프라") },
      { valueKrw: 50, tags: t("out") },
      { valueKrw: 40, tags: t("leader", "반도체") },
    ]);
    expect(m.byLayer.map((r) => r.label)).toEqual(["반도체", "전력·인프라", "레이어 밖"]);
  });

  it("⚠ 판정을 싣지 않은 종목은 「판정 없음」 — 「판정 불가」·「레이어 밖」과 섞지 않는다", () => {
    const m = verdictMix([
      { valueKrw: 50, tags: t("unknown") },
      { valueKrw: 50 },
    ]);
    expect(m.byClass.map((r) => r.label)).toEqual(["판정 불가", "판정 없음"]);
    expect(m.byLayer.map((r) => r.label)).toEqual(["레이어 밖", "판정 없음"]);
  });

  it("⚠ 모르는 판정 값도 「판정 없음」으로 — 다른 칸에 지어 넣지 않는다", () => {
    expect(verdictMix([{ valueKrw: 1, tags: t("brand_new") }]).byClass[0].key).toBe("none");
  });

  it("⚠ 평가액을 모르는 종목은 빼고 뺐다고 센다", () => {
    const m = verdictMix([{ valueKrw: 10, tags: t("leader") }, { valueKrw: undefined, tags: t("out") }]);
    expect(m.insidePct).toBe(100);
    expect(m.unvalued).toBe(1);
    expect(m.valued).toBe(1);
  });

  it("값이 하나도 없으면 전부 0 — 나누기 오류가 없다", () => {
    const m = verdictMix([]);
    expect(m.insidePct).toBe(0);
    expect(m.byClass).toEqual([]);
  });
});

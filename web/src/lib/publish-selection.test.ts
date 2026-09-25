import { describe, expect, it } from "vitest";
import { planPublishSelection, publishCoverage } from "./publish-selection";

const state = (entries: [string, boolean][]) => new Map(entries);

describe("공개 종목 고르기", () => {
  it("체크한 것은 공개로, 체크를 뺀 것은 비공개로 — 바뀌는 것만 돌려준다", () => {
    const plan = planPublishSelection(
      ["a", "b", "c", "d"],
      ["a", "c"],
      state([["a", false], ["b", true], ["c", true], ["d", false]]),
    );
    expect(plan).toEqual({ publish: ["a"], unpublish: ["b"] });
  });

  it("⚠ 표에 보이지 않았던 종목은 건드리지 않는다 — 화면을 연 뒤 들어온 종목일 수 있다", () => {
    const plan = planPublishSelection(
      ["a"],
      [],
      state([["a", true], ["new", true]]),
    );
    expect(plan.unpublish).toEqual(["a"]);
    expect(plan.unpublish).not.toContain("new");
  });

  it("⚠ 목록 밖 id를 체크값으로 보내도 공개되지 않는다", () => {
    const plan = planPublishSelection(["a"], ["a", "x"], state([["a", false], ["x", false]]));
    expect(plan.publish).toEqual(["a"]);
  });

  it("그사이 지워진 종목은 무시한다", () => {
    const plan = planPublishSelection(["gone"], ["gone"], state([]));
    expect(plan).toEqual({ publish: [], unpublish: [] });
  });
});

describe("공개 종목이 계좌에서 차지하는 몫", () => {
  it("원화 평가액 기준 비율을 낸다", () => {
    const c = publishCoverage([
      { published: true, valueKrw: 300 },
      { published: false, valueKrw: 700 },
    ]);
    expect(c.publishedValuePct).toBe(30);
    expect(c.publishedCount).toBe(1);
    expect(c.totalCount).toBe(2);
  });

  it("⚠ 평가액을 모르는 종목은 비율에서 빼고, 뺐다고 센다", () => {
    const c = publishCoverage([
      { published: true, valueKrw: 100 },
      { published: true, valueKrw: undefined },
    ]);
    expect(c.publishedValuePct).toBe(100);
    expect(c.unvalued).toBe(1);
  });

  it("⚠ 아는 값이 없으면 0%가 아니라 null — 지어내지 않는다", () => {
    expect(publishCoverage([{ published: false, valueKrw: undefined }]).publishedValuePct).toBeNull();
    expect(publishCoverage([]).publishedValuePct).toBeNull();
  });
});

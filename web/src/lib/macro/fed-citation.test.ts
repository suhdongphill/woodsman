import { describe, expect, it } from "vitest";
import { fedFuturesCitation } from "./fed-citation";

const base = {
  observedOn: "2026-11-13",
  contractMonth: "2026-12",
  meeting: "2026-12-09",
  singleMeeting: true,
  dir: "인상" as const,
  sharePct: 110,
  currentRate: 3.88,
  rateAfter: 4.15,
  fetchedAt: "2026-11-14T21:00:33.990Z",
};

describe("금리 방향 인용 문구(2026-11-15)", () => {
  it("⚠ 선물 관측일·계약월·수집 시각이 문장에 붙는다 — 날짜 없는 확률을 옮기지 않게", () => {
    const t = fedFuturesCitation(base);
    expect(t).toContain("연방기금 선물 2026-11-13 관측(2026-12 계약)");
    expect(t).toContain("2026-12-09 회의에서 25bp 인상 한 번을 110% 반영");
    expect(t).toContain("현재 3.88% → 회의 뒤 4.15%");
    expect(t).toContain("수집 2026-11-15 06:00 KST");
  });

  it("수집 시각을 모르면 지어내지 않고 뺀다", () => {
    const t = fedFuturesCitation({ ...base, fetchedAt: undefined });
    expect(t).not.toContain("수집");
    expect(t).toContain("출처: Woodsman");
  });

  it("회의가 여럿이면 누적이라고 말한다", () => {
    expect(fedFuturesCitation({ ...base, singleMeeting: false, rateAfter: undefined })).toContain("누적");
  });
});

import { describe, expect, it } from "vitest";
import {
  EFFECT_WINDOW_DAYS,
  MIN_TOTAL_SAMPLE,
  changePct,
  daysSince,
  judgeEffect,
  shiftDay,
  sumAround,
} from "./release-effect";

const base = {
  before: 100,
  after: 130,
  daysSinceRelease: EFFECT_WINDOW_DAYS,
  overlappingReleases: 0,
};

describe("판정 — 말할 수 있을 때만 말한다", () => {
  it("조건이 다 차면 변화율을 낸다", () => {
    const v = judgeEffect(base);
    expect(v.kind).toBe("measured");
    expect(v.kind === "measured" && Math.round(v.changePct)).toBe(30);
  });

  it("⚠ 후 기간이 안 찼으면 판정하지 않는다", () => {
    const v = judgeEffect({ ...base, daysSinceRelease: 3 });
    expect(v.kind).toBe("too-early");
    expect(v.message).toContain("11일");
  });

  it("⚠ 표본이 적으면 판정하지 않는다 — 적은 표본의 결론이 가장 위험하다", () => {
    const v = judgeEffect({ ...base, before: 5, after: 6 });
    expect(v.kind).toBe("too-few");
    expect(v.message).toContain(String(MIN_TOTAL_SAMPLE));
  });

  it("⚠ 같은 기간에 다른 변경이 있었으면 하나로 지목하지 않는다", () => {
    const v = judgeEffect({ ...base, overlappingReleases: 2 });
    expect(v.kind).toBe("overlapping");
    expect(v.message).toContain("가릴 수 없습니다");
  });

  it("⚠ 못 말하는 이유를 먼저 거른다 — 표본 부족이 겹침보다 앞선다", () => {
    const v = judgeEffect({ ...base, before: 2, after: 3, overlappingReleases: 5 });
    expect(v.kind).toBe("too-few");
  });

  it("⚠ 이전이 0이면 비율을 만들지 않는다 — 0에서 늘어난 것은 배율로 말할 수 없다", () => {
    expect(changePct(0, 10)).toBeNull();
    expect(judgeEffect({ ...base, before: 0, after: 40 }).kind).toBe("too-few");
  });

  it("⚠ 인과로 적지 않는다 — '덕분에'가 문구에 없다", () => {
    const v = judgeEffect(base);
    expect(v.message).not.toContain("덕분");
    expect(v.message).toContain("그 기간에");
  });
});

describe("전후 합계", () => {
  const daily = [
    { date: "2026-08-20", count: 5 }, // 전
    { date: "2026-08-29", count: 7 }, // 전
    { date: "2026-08-30", count: 9 }, // ⚠ 릴리스 당일 → 후
    { date: "2026-09-02", count: 4 }, // 후
    { date: "2026-07-01", count: 99 }, // 창 밖
  ];

  it("⚠ 릴리스 당일은 후 기간이다 — 그날 배포됐으므로 그날의 반응은 새 화면의 것이다", () => {
    expect(sumAround(daily, "2026-08-30")).toEqual({ before: 12, after: 13 });
  });

  it("창 밖은 세지 않는다", () => {
    const { before, after } = sumAround(daily, "2026-08-30", 3);
    expect(before).toBe(7);
    expect(after).toBe(9);
  });
});

describe("날짜 계산", () => {
  it("일 단위로 민다", () => {
    expect(shiftDay("2026-08-30", -14)).toBe("2026-08-16");
    expect(shiftDay("2026-08-30", 1)).toBe("2026-08-31");
  });

  it("망가진 값에도 죽지 않는다", () => {
    expect(shiftDay("(없음)", 1)).toBe("(없음)");
    expect(daysSince("(없음)", "2026-08-30")).toBe(0);
  });

  it("지난 일수는 당일이 0이고 음수가 되지 않는다", () => {
    expect(daysSince("2026-08-30", "2026-08-30")).toBe(0);
    expect(daysSince("2026-08-16", "2026-08-30")).toBe(14);
    expect(daysSince("2026-09-30", "2026-08-30")).toBe(0);
  });
});

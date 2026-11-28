import { describe, expect, it } from "vitest";
import { firstSentence, homeBriefingDigest, HOME_BRIEFING_COUNT } from "./home-digest";

const b = (date: string, headline = `${date} 첫 문장입니다. 둘째 문장입니다.`) => ({ date, headline });
const days = (n: number) => Array.from({ length: n }, (_, i) => b(`2026-11-${String(24 - i).padStart(2, "0")}`));

describe("firstSentence", () => {
  it("두 문장짜리 리드에서 첫 문장만", () => {
    expect(
      firstSentence("엔비디아가 젠슨 황을 다시 CEO로 세우자 미국 기술주가 하루 만에 크게 되돌렸습니다. 다만 같은 날 유가는 내려갔습니다."),
    ).toBe("엔비디아가 젠슨 황을 다시 CEO로 세우자 미국 기술주가 하루 만에 크게 되돌렸습니다.");
  });
  it("⚠ 숫자 안의 점(3.59%)에서 자르지 않는다", () => {
    expect(firstSentence("코스피는 3.59% 급락했습니다. 유가는 올랐습니다.")).toBe("코스피는 3.59% 급락했습니다.");
  });
  it("문장 끝이 없으면 전체 · 한 문장이면 그대로", () => {
    expect(firstSentence("  마침표 없는 제목 ")).toBe("마침표 없는 제목");
    expect(firstSentence("한 문장뿐입니다.")).toBe("한 문장뿐입니다.");
    expect(firstSentence("물었나? 답했다.")).toBe("물었나?");
  });
});

describe("homeBriefingDigest", () => {
  it("최신이 싱싱하면 큰 카드 1편 + 목록 6편", () => {
    const d = homeBriefingDigest(days(10), "2026-11-25")!;
    expect(d.featured?.date).toBe("2026-11-24");
    expect(d.list.map((x) => x.date)).toEqual(["2026-11-23", "2026-11-22", "2026-11-21", "2026-11-20", "2026-11-19", "2026-11-18"]);
    expect(d.list[0].title).toBe("2026-11-23 첫 문장입니다.");
  });

  it("⭐ 최신이 오래됐으면 큰 카드는 빼고 최근 7편 목록은 남긴다(운영자 11/28)", () => {
    const d = homeBriefingDigest(days(10), "2026-11-28")!;
    expect(d.featured).toBeUndefined();
    expect(d.list).toHaveLength(HOME_BRIEFING_COUNT);
    expect(d.list[0].date).toBe("2026-11-24");
  });

  it("편수가 적으면 있는 만큼 · 없으면 null(블록 없음)", () => {
    expect(homeBriefingDigest([b("2026-11-24")], "2026-11-24")).toEqual({ featured: b("2026-11-24"), list: [] });
    expect(homeBriefingDigest([], "2026-11-24")).toBeNull();
  });
});

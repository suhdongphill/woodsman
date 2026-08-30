import { describe, expect, it } from "vitest";
import { ADMIN_ACTIONS, actionLabel, groupByDay, postSummary, seoulDay, seoulTime } from "./admin-log";

describe("actionLabel", () => {
  it("아는 행위는 한국어로 보여준다", () => {
    expect(actionLabel("post.create")).toBe("글 작성");
    expect(actionLabel("macro.ingest")).toBe("거시 자료 가져오기");
  });

  it("⚠ 모르는 키를 감추지 않는다 — 빈칸이면 '기록 없음'과 구분이 안 된다", () => {
    expect(actionLabel("journal.snapshot")).toBe("journal.snapshot");
    expect(actionLabel("")).toBe("");
  });

  it("행위 키는 점으로 나뉜 안정된 값이다", () => {
    for (const key of Object.keys(ADMIN_ACTIONS)) {
      expect(key, key).toMatch(/^[a-z]+\.[a-z]+$/);
    }
  });
});

describe("postSummary", () => {
  it("발행 여부를 함께 적는다", () => {
    expect(postSummary("금리 인하", true)).toBe("금리 인하 · 발행");
    expect(postSummary("금리 인하", false)).toBe("금리 인하 · 작성중");
  });

  it("긴 제목은 자른다", () => {
    const long = "가".repeat(80);
    expect(postSummary(long, true).startsWith("가".repeat(60) + "…")).toBe(true);
  });
});

describe("⚠ 한국 시간으로 읽는다", () => {
  it("UTC 밤 기록이 다음날 아침(KST)으로 보인다", () => {
    expect(seoulDay("2026-08-30T23:00:00.000Z")).toBe("2026-08-31");
    expect(seoulTime("2026-08-30T23:00:00.000Z")).toBe("08:00");
  });

  it("낮 기록은 같은 날", () => {
    expect(seoulDay("2026-08-30T01:00:00.000Z")).toBe("2026-08-30");
    expect(seoulTime("2026-08-30T01:00:00.000Z")).toBe("10:00");
  });

  it("망가진 값에도 화면을 비우지 않는다", () => {
    expect(seoulDay("(없음)")).toBe("(없음)");
    expect(seoulTime("(없음)")).toBe("");
  });
});

describe("groupByDay", () => {
  const e = (id: string, at: string) => ({ id, at, actor: "a@b.c", action: "post.update" });

  it("KST 날짜로 묶는다 — UTC로 묶으면 밤에 한 일이 어제 일로 보인다", () => {
    const days = groupByDay([
      e("1", "2026-08-30T23:00:00.000Z"),
      e("2", "2026-08-30T05:00:00.000Z"),
      e("3", "2026-08-29T05:00:00.000Z"),
    ]);
    expect(days.map((d) => d.day)).toEqual(["2026-08-31", "2026-08-30", "2026-08-29"]);
  });

  it("빈 목록은 빈 묶음", () => {
    expect(groupByDay([])).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { leaderAgeDays, refreshView, type RefreshRequest } from "./refresh";

const NOW = new Date("2026-11-07T10:00:00.000Z");
const req = (over: Partial<RefreshRequest>): RefreshRequest => ({
  id: "a",
  requestedAt: "2026-11-07T09:30:00.000Z",
  status: "REQUESTED",
  ...over,
});

describe("refreshView", () => {
  it("요청이 없으면 받을 수 있다", () => {
    expect(refreshView(null, NOW).canRequest).toBe(true);
  });

  it("⚠ 기다리는 중·도는 중이면 겹쳐 받지 않는다", () => {
    expect(refreshView(req({}), NOW).canRequest).toBe(false);
    expect(refreshView(req({ status: "RUNNING", startedAt: "2026-11-07T09:55:00.000Z" }), NOW).canRequest).toBe(false);
  });

  it("⚠ PC가 꺼져 시작 못 했으면 그렇게 말하고 다시 받는다", () => {
    const v = refreshView(req({ requestedAt: "2026-11-07T07:00:00.000Z" }), NOW);
    expect(v.canRequest).toBe(true);
    expect(v.tone).toBe("warn");
    expect(v.line).toContain("PC");
  });

  it("멈춘 실행은 경고하고 다시 받는다", () => {
    const v = refreshView(req({ status: "RUNNING", startedAt: "2026-11-07T08:00:00.000Z" }), NOW);
    expect(v.canRequest).toBe(true);
    expect(v.tone).toBe("warn");
  });

  it("실패는 이유를 함께 적는다", () => {
    const v = refreshView(req({ status: "FAILED", note: "시세 수집 실패" }), NOW);
    expect(v.line).toContain("시세 수집 실패");
    expect(v.canRequest).toBe(true);
  });
});

describe("leaderAgeDays", () => {
  it("KST 시각으로 경과일을 잰다", () => {
    expect(leaderAgeDays("2026-10-26 21:15", NOW)).toBe(11);
    expect(leaderAgeDays("2026-11-07 15:18", NOW)).toBe(0);
  });

  it("⚠ 못 읽으면 0일이 아니라 null이다", () => {
    expect(leaderAgeDays("", NOW)).toBeNull();
    expect(leaderAgeDays(null, NOW)).toBeNull();
    expect(leaderAgeDays("어제", NOW)).toBeNull();
  });
});

/**
 * ⚠ 축 점수 저장이 **자동으로 도는가.**
 *
 * 2026-09-20까지 저장 경로는 `/api/gcrm/run`뿐이었고 **아무도 부르지 않았다.**
 * 종합 점수는 나오는데 레짐은 영원히 R0였다 — 자료가 아니라 **시간이 안 쌓여서**다.
 * 이 파일은 그 사실이 다시 조용히 생기지 않게 막는다.
 */
import { describe, it, expect } from "vitest";
import { ALL_CRON_JOBS, CRON_PLAN, planForCron } from "./cron";

describe("GCRM 축 점수 저장 스케줄", () => {
  it("★ 매일 수집에 gcrm이 들어 있다 — 안 들어 있으면 축 이력이 하루도 안 쌓인다", () => {
    const daily = CRON_PLAN.find((p) => p.expr === "0 21 * * *");
    expect(daily).toBeDefined();
    expect(daily!.jobs).toContain("gcrm");
  });

  it("⚠ gcrm은 macro **뒤**다 — 앞에 두면 어제 값으로 오늘 점수를 낸다", () => {
    const daily = CRON_PLAN.find((p) => p.expr === "0 21 * * *")!;
    const jobs = [...daily.jobs];
    expect(jobs.indexOf("gcrm")).toBeGreaterThan(jobs.indexOf("macro"));
  });

  it("⚠ 평일 22:00에는 gcrm이 **없다** — 축 이력은 하루 한 점이어야 한다", () => {
    const evening = CRON_PLAN.find((p) => p.expr === "0 13 * * MON-FRI");
    expect(evening).toBeDefined();
    expect(evening!.jobs).not.toContain("gcrm");
  });

  it("⚠ 모르는 스케줄이어도 gcrm은 돈다 — 전부 돌리는 목록에 들어 있다", () => {
    expect(ALL_CRON_JOBS).toContain("gcrm");
    expect(planForCron("0 5 * * *").jobs).toContain("gcrm");
  });

  it("⚠ gcrm을 하루에 두 번 돌리는 일정이 없다", () => {
    const withGcrm = CRON_PLAN.filter((p) => p.jobs.includes("gcrm"));
    expect(withGcrm).toHaveLength(1);
  });
});

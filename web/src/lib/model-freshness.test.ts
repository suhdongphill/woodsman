import { describe, expect, it } from "vitest";
import {
  businessDaysSince,
  elapsedText,
  judgeModelFreshness,
  lastExpectedMacroRun,
  previousScheduledRun,
  type ModelFreshnessInput,
} from "./model-freshness";
import { CRON_PLAN } from "./cron";

const at = (iso: string) => new Date(iso);

describe("예정 시각", () => {
  it("매일 21:00 UTC — 지나기 전이면 어제", () => {
    expect(previousScheduledRun("0 21 * * *", at("2026-09-14T20:00:00Z"))?.toISOString()).toBe("2026-09-13T21:00:00.000Z");
    expect(previousScheduledRun("0 21 * * *", at("2026-09-14T21:30:00Z"))?.toISOString()).toBe("2026-09-14T21:00:00.000Z");
  });

  it("⭐ 평일 13:00 UTC — 월요일 아침이면 지난 금요일", () => {
    // 2026-09-14는 월요일
    expect(previousScheduledRun("0 13 * * MON-FRI", at("2026-09-14T05:00:00Z"))?.toISOString()).toBe("2026-09-11T13:00:00.000Z");
  });

  it("⚠ 모르는 표현식은 null — 예정 시각을 지어내지 않는다", () => {
    expect(previousScheduledRun("*/5 * * * *", at("2026-09-14T05:00:00Z"))).toBeNull();
  });

  it("거시 수집이 들어간 일정 중 가장 최근", () => {
    // 월 14:00 UTC → 13:00(평일) 이 21:00(일요일)보다 늦다
    expect(lastExpectedMacroRun(CRON_PLAN, at("2026-09-14T14:00:00Z"))?.toISOString()).toBe("2026-09-14T13:00:00.000Z");
  });
});

describe("경과 · 영업일", () => {
  it("분 · 시간 · 일", () => {
    const now = at("2026-09-14T12:00:00Z");
    expect(elapsedText("2026-09-14T11:30:00Z", now)).toBe("30분 전");
    expect(elapsedText("2026-09-13T12:00:00Z", now)).toBe("24시간 전");
    expect(elapsedText("2026-09-10T12:00:00Z", now)).toBe("4일 전");
  });

  it("⚠ 미래 시각을 「방금」으로 뭉개지 않는다", () => {
    expect(elapsedText("2026-09-15T12:00:00Z", at("2026-09-14T12:00:00Z"))).toMatch(/미래/);
  });

  it("영업일은 주말을 세지 않는다", () => {
    expect(businessDaysSince("2026-09-11", "2026-09-14")).toBe(1); // 금 → 월
    expect(businessDaysSince("2026-09-10", "2026-09-14")).toBe(2);
  });
});

function base(over: Partial<ModelFreshnessInput> = {}): ModelFreshnessInput {
  return {
    now: at("2026-09-14T22:00:00Z"),
    todayKst: "2026-09-15",
    plan: CRON_PLAN,
    lastCronStartedAt: "2026-09-14T21:00:30Z",
    lastRun: { startedAt: "2026-09-14T21:00:30Z", finishedAt: "2026-09-14T21:01:10Z", failCount: 0, trigger: "CRON" },
    lastScoreComputedAt: "2026-09-14T21:01:20Z",
    ratesInputs: [{ key: "zq_front", label: "선물", asOf: "2026-09-14" }],
    bubbleReadingDates: ["2026-08-31", "2026-07-20"],
    bubbleTotal: 2,
    triggerDates: ["2026-09-10"],
    triggerTotal: 1,
    ...over,
  };
}
const row = (rows: ReturnType<typeof judgeModelFreshness>, key: string) => rows.find((r) => r.key === key)!;

describe("모델 최신성 판정", () => {
  it("모두 제때면 전부 정상 — ⚠ 정상일 때도 줄은 남는다", () => {
    const rows = judgeModelFreshness(base());
    expect(rows.every((r) => r.state === "ok")).toBe(true);
    expect(rows.map((r) => r.key)).toEqual(["cron", "ingest", "scores", "rates:zq_front", "bubble", "triggers"]);
  });

  it("⭐ 예정 시각 + 2시간이 지났는데 자동 실행이 없으면 늦음 → 수동 수집", () => {
    const rows = judgeModelFreshness(base({ now: at("2026-09-15T00:00:00Z"), lastCronStartedAt: "2026-09-13T21:00:00Z" }));
    expect(row(rows, "cron")).toMatchObject({ state: "late", action: "ingest" });
  });

  it("⚠ 한 번도 안 돈 것은 늦음이 아니라 없음이다", () => {
    expect(row(judgeModelFreshness(base({ lastCronStartedAt: undefined })), "cron").state).toBe("missing");
  });

  it("⚠ 수집은 끝났는데 점수가 그보다 이르면 — 수집 뒤 계산이 실패한 것", () => {
    const rows = judgeModelFreshness(base({ lastScoreComputedAt: "2026-09-13T21:01:00Z" }));
    expect(row(rows, "scores").state).toBe("late");
  });

  it("수집 실패가 있으면 늦음 → 관리자 거시 화면", () => {
    const rows = judgeModelFreshness(base({ lastRun: { startedAt: "2026-09-14T21:00:30Z", finishedAt: "2026-09-14T21:01:10Z", failCount: 3, trigger: "CRON" } }));
    expect(row(rows, "ingest")).toMatchObject({ state: "late", action: "macro" });
  });

  it("금리 입력이 영업일 3일 넘게 묵으면 늦음 · 없으면 없음", () => {
    expect(row(judgeModelFreshness(base({ ratesInputs: [{ key: "dff", label: "DFF", asOf: "2026-09-08" }] })), "rates:dff").state).toBe("late");
    expect(row(judgeModelFreshness(base({ ratesInputs: [{ key: "dff", label: "DFF" }] })), "rates:dff").state).toBe("missing");
  });

  it("버블: 가장 오래된 판정이 100일을 넘으면 늦음 · 90일 넘은 개수와 미채점을 말한다", () => {
    const r = row(judgeModelFreshness(base({ bubbleReadingDates: ["2026-05-01", "2026-08-31"], bubbleTotal: 3 })), "bubble");
    expect(r.state).toBe("late");
    expect(r.reason).toMatch(/90일 넘은 판정 1개/);
    expect(r.reason).toMatch(/미채점 1개/);
  });

  it("트리거: 14일 넘게 갱신 안 된 상태가 있으면 늦음", () => {
    expect(row(judgeModelFreshness(base({ triggerDates: ["2026-08-20"] })), "triggers").state).toBe("late");
  });
});

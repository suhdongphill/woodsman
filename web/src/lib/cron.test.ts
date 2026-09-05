/**
 * 자동 수집 스케줄 회귀 테스트.
 *
 * 지켜야 하는 것은 셋이다.
 *  1) **설정과 코드가 같은 표현식을 말한다** — 어긋나면 "돌긴 도는데 아무 일도 안 하는"
 *     스케줄이 된다. wrangler.jsonc를 직접 읽어 대조한다(CLAUDE.md 2-1장).
 *  2) **모르는 표현식에서 조용히 넘어가지 않는다** — 빈 목록을 주면 실패가 성공처럼 보인다.
 *  3) **시크릿이 없으면 문이 안 열린다** — 설정 누락이 "누구나 통과"가 되면 안 된다.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ALL_CRON_JOBS,
  CRON_PLAN,
  CRON_SECRET_MIN_LENGTH,
  allSucceeded,
  cronSecretState,
  cronSummary,
  isAuthorizedCron,
  nextDailyRun,
  planForCron,
  type CronJobResult,
} from "./cron";

const SECRET = "x".repeat(CRON_SECRET_MIN_LENGTH);

describe("planForCron", () => {
  it("아는 표현식이면 계획대로 준다", () => {
    const plan = CRON_PLAN[0];
    expect(planForCron(plan.expr)).toEqual({ jobs: plan.jobs, known: true });
  });

  it("⚠ 모르는 표현식이면 빈 목록이 아니라 전부를 준다", () => {
    const result = planForCron("13 4 * * *");
    expect(result.known).toBe(false);
    expect(result.jobs).toEqual(ALL_CRON_JOBS);
    expect(result.jobs.length).toBeGreaterThan(0);
  });

  it("표현식이 없어도 마찬가지다(수동 호출·설정 누락)", () => {
    expect(planForCron(undefined).known).toBe(false);
    expect(planForCron(null).jobs).toEqual(ALL_CRON_JOBS);
  });
});

describe("isAuthorizedCron", () => {
  it("헤더와 시크릿이 같으면 통과한다", () => {
    expect(isAuthorizedCron(SECRET, SECRET)).toBe(true);
  });

  it("앞뒤 공백은 무시한다(시크릿 저장 시 개행이 섞이는 사고가 잦다)", () => {
    expect(isAuthorizedCron(` ${SECRET}\n`, `${SECRET} `)).toBe(true);
  });

  it("⚠ 시크릿이 없으면 헤더가 무엇이든 거부한다", () => {
    expect(isAuthorizedCron(SECRET, undefined)).toBe(false);
    expect(isAuthorizedCron(SECRET, "")).toBe(false);
    expect(isAuthorizedCron("", "")).toBe(false);
  });

  it(`⚠ 시크릿이 ${CRON_SECRET_MIN_LENGTH}자 미만이면 거부한다`, () => {
    const short = "x".repeat(CRON_SECRET_MIN_LENGTH - 1);
    expect(isAuthorizedCron(short, short)).toBe(false);
  });

  it("헤더가 없거나 다르면 거부한다", () => {
    expect(isAuthorizedCron(undefined, SECRET)).toBe(false);
    expect(isAuthorizedCron("y".repeat(CRON_SECRET_MIN_LENGTH), SECRET)).toBe(false);
    expect(isAuthorizedCron(SECRET.slice(0, -1), SECRET)).toBe(false);
  });
});

describe("cronSummary · allSucceeded", () => {
  const ok: CronJobResult = { job: "macro", ok: true, okCount: 59, failCount: 0, addedPoints: 12 };
  const bad: CronJobResult = { job: "quotes", ok: false, error: "보고서가 없습니다" };

  it("성공한 작업의 숫자를 그대로 말한다", () => {
    expect(cronSummary([ok])).toContain("성공 59");
  });

  it("⚠ 실패를 감추지 않는다 — 사유가 요약에 남는다", () => {
    const line = cronSummary([ok, bad]);
    expect(line).toContain("보고서가 없습니다");
    expect(line).toContain("⚠");
  });

  it("하나라도 실패하면 전체 성공이 아니다", () => {
    expect(allSucceeded([ok])).toBe(true);
    expect(allSucceeded([ok, bad])).toBe(false);
    expect(allSucceeded([])).toBe(false);
  });
});

/**
 * ⚠ Worker 런타임은 wrangler.jsonc를 읽을 수 없어 스케줄을 코드에도 적게 된다.
 *    주석으로 "같이 고치세요"라고 쓰지 않는다 — 사람은 잊는다. 여기서 대조한다.
 */
describe("⚠ wrangler.jsonc의 스케줄과 어긋나면 여기서 깨진다", () => {
  const raw = readFileSync(fileURLToPath(new URL("../../wrangler.jsonc", import.meta.url)), "utf8");
  // JSONC → JSON. 블록 주석을 먼저 지우고, 줄 시작의 `//` 주석만 지운다
  // (문자열 안의 `https://`를 건드리지 않기 위해서다).
  const config = JSON.parse(raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")) as {
    main?: string;
    triggers?: { crons?: string[] };
  };

  it("설정에 스케줄이 있다", () => {
    expect(config.triggers?.crons, "wrangler.jsonc에 triggers.crons가 없습니다").toBeDefined();
  });

  it("설정의 스케줄과 코드의 CRON_PLAN이 정확히 같다", () => {
    expect([...(config.triggers?.crons ?? [])].sort()).toEqual(
      CRON_PLAN.map((p) => p.expr).sort(),
    );
  });

  it("⚠ main이 커스텀 진입점이다 — 아니면 scheduled 핸들러가 배포에 안 실린다", () => {
    expect(config.main).toBe("worker.js");
  });
});

describe("화면이 보는 자동 수집 상태", () => {
  /**
   * ⚠ 시크릿이 없으면 스케줄은 아무 일도 하지 않고 조용히 끝난다. 그 상태를 볼 자리가
   *    없으면 "도는 줄 알았는데 몇 달째 안 돌고 있었다"가 된다 — 실제로 9월 1일부터
   *    나흘간 그랬다.
   */
  it("⚠ 시크릿 상태를 세 가지로 구분한다 — 값은 담지 않는다", () => {
    expect(cronSecretState(undefined)).toBe("missing");
    expect(cronSecretState("   ")).toBe("missing");
    expect(cronSecretState("짧은값")).toBe("short");
    expect(cronSecretState("a".repeat(CRON_SECRET_MIN_LENGTH))).toBe("ok");
  });

  it("설정된 스케줄의 다음 실행 시각을 낸다", () => {
    // 2026-09-05 12:00 UTC → 같은 날 21:00 UTC(= 9/6 06:00 KST)
    const next = nextDailyRun("0 21 * * *", new Date("2026-09-05T12:00:00.000Z"));
    expect(next?.toISOString()).toBe("2026-09-05T21:00:00.000Z");
  });

  it("이미 지난 시각이면 다음 날로 넘긴다", () => {
    const next = nextDailyRun("0 21 * * *", new Date("2026-09-05T21:00:00.000Z"));
    expect(next?.toISOString()).toBe("2026-09-06T21:00:00.000Z");
  });

  /** ⚠ 모르는 표현식에 그럴듯한 시각을 지어내지 않는다. */
  it("⚠ 계산할 수 없는 표현식이면 null이다", () => {
    expect(nextDailyRun("*/5 * * * *", new Date())).toBeNull();
    expect(nextDailyRun("0 21 * * 1", new Date())).toBeNull();
    expect(nextDailyRun("99 99 * * *", new Date())).toBeNull();
  });

  it("설정에 적힌 스케줄로 계산이 된다 — 화면이 빈칸이 되지 않게", () => {
    for (const plan of CRON_PLAN) {
      expect(nextDailyRun(plan.expr, new Date()), plan.expr).not.toBeNull();
    }
  });
});

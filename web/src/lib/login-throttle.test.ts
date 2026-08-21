import { describe, expect, it } from "vitest";
import {
  ATTEMPT_WINDOW_SECONDS,
  FREE_ATTEMPTS,
  MAX_LOCK_SECONDS,
  checkAttempt,
  decayRecord,
  lockSecondsFor,
  maskEmail,
  recordFailure,
  type AttemptRecord,
} from "./login-throttle";

const T0 = new Date("2026-08-21T10:00:00.000Z");
const after = (seconds: number) => new Date(T0.getTime() + seconds * 1000);

const none: AttemptRecord = { failures: 0, lastFailedAt: null };
const failedAt = (failures: number, at: Date): AttemptRecord => ({
  failures,
  lastFailedAt: at.toISOString(),
});

describe("여유 횟수", () => {
  it("사람은 오타를 낸다 — 네 번까지는 막지 않는다", () => {
    for (let n = 0; n <= FREE_ATTEMPTS; n += 1) {
      expect(lockSecondsFor(n)).toBe(0);
    }
  });

  it("여유를 넘기면 잠금이 시작된다", () => {
    expect(lockSecondsFor(FREE_ATTEMPTS + 1)).toBe(60);
    expect(lockSecondsFor(FREE_ATTEMPTS + 2)).toBe(120);
    expect(lockSecondsFor(FREE_ATTEMPTS + 3)).toBe(300);
  });

  it("⚠ 아무리 틀려도 상한을 넘지 않는다 — 영구 잠금은 계정 잠금 DoS가 된다", () => {
    expect(lockSecondsFor(FREE_ATTEMPTS + 5)).toBe(MAX_LOCK_SECONDS);
    expect(lockSecondsFor(FREE_ATTEMPTS + 500)).toBe(MAX_LOCK_SECONDS);
  });
});

describe("판정", () => {
  it("기록이 없으면 통과", () => {
    expect(checkAttempt(none, T0)).toEqual({ kind: "allow", failures: 0 });
  });

  it("막 잠긴 계정은 남은 시간을 돌려준다", () => {
    const v = checkAttempt(failedAt(FREE_ATTEMPTS + 1, T0), after(10));
    expect(v.kind).toBe("locked");
    if (v.kind === "locked") expect(v.retryAfterSeconds).toBe(50);
  });

  it("⚠ 창이 지나면 스스로 풀린다 — 사람이 풀어 줘야 하는 잠금을 만들지 않는다", () => {
    expect(checkAttempt(failedAt(FREE_ATTEMPTS + 1, T0), after(61)).kind).toBe("allow");
  });

  it("오래된 실패는 없던 일로 본다", () => {
    const old = failedAt(20, T0);
    expect(decayRecord(old, after(ATTEMPT_WINDOW_SECONDS))).toEqual({
      failures: 0,
      lastFailedAt: null,
    });
    expect(checkAttempt(old, after(ATTEMPT_WINDOW_SECONDS)).kind).toBe("allow");
  });

  it("창 안이면 실패 횟수를 유지한다", () => {
    const rec = failedAt(3, T0);
    expect(decayRecord(rec, after(ATTEMPT_WINDOW_SECONDS - 1))).toEqual(rec);
  });

  it("깨진 시각은 없는 것으로 읽는다 — 파싱 실패로 로그인이 막히면 안 된다", () => {
    expect(checkAttempt({ failures: 99, lastFailedAt: "어제" }, T0).kind).toBe("allow");
  });
});

describe("실패 기록", () => {
  it("한 번 더 세고 시각을 새로 찍는다", () => {
    expect(recordFailure(failedAt(2, T0), after(5))).toEqual({
      failures: 3,
      lastFailedAt: after(5).toISOString(),
    });
  });

  it("창을 벗어난 뒤의 실패는 1부터 다시 센다", () => {
    const at = after(ATTEMPT_WINDOW_SECONDS + 1);
    expect(recordFailure(failedAt(9, T0), at)).toEqual({
      failures: 1,
      lastFailedAt: at.toISOString(),
    });
  });

  it("다섯 번 연속 틀리면 잠긴다", () => {
    let rec = none;
    for (let i = 0; i < FREE_ATTEMPTS; i += 1) {
      rec = recordFailure(rec, after(i));
      expect(checkAttempt(rec, after(i)).kind).toBe("allow");
    }
    rec = recordFailure(rec, after(FREE_ATTEMPTS));
    expect(checkAttempt(rec, after(FREE_ATTEMPTS)).kind).toBe("locked");
  });
});

describe("로그용 가리기", () => {
  it("⚠ 이메일 전체를 로그에 남기지 않는다 — 실패 기록은 계정 존재 신호다", () => {
    expect(maskEmail("suhdp71@gmail.com")).toBe("su***@gmail.com");
    expect(maskEmail("a@b.com")).toBe("a***@b.com");
  });

  it("모양이 아니면 통째로 가린다", () => {
    expect(maskEmail("이메일아님")).toBe("***");
    expect(maskEmail("@only")).toBe("***");
  });
});

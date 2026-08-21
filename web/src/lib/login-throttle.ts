/**
 * 로그인 시도 제한 — 순수 함수.
 *
 * ## 왜
 * 2026-08-17 점검: **로그인 시도 제한이 0층**이었다. 횟수·지연·잠금 어느 것도 없어
 * 관리자 비밀번호를 초당 수십 번 시도해도 사이트가 아무 반응을 하지 않았다.
 * 게다가 실패를 `authorize()`에서 `return null`로만 처리해 **로그조차 남지 않았다**
 * (CLAUDE.md §3 "조용한 실패를 만들지 않는다" 위반).
 *
 * ## ⚠ 계정 잠금은 그 자체가 공격 수단이다
 * 이메일 기준으로 세고 있으므로, 남이 관리자 이메일로 일부러 틀리면 **관리자를 밖에
 * 세워 둘 수 있다**(계정 잠금 DoS). 그래서 다음 세 가지를 지킨다.
 *
 * - **영구 잠금을 만들지 않는다.** 창이 지나면 자동으로 풀린다.
 * - **상한을 둔다.** 아무리 틀려도 {@link MAX_LOCK_SECONDS}를 넘지 않는다.
 * - **성공 한 번이면 초기화한다.** 비밀번호를 아는 사람은 언제나 바로 들어온다
 *   — 잠금 중이 아니라면. 잠금 중이면 맞는 비밀번호도 막힌다(그래야 방어다).
 *
 * ## 왜 지연이 아니라 잠금인가
 * "틀릴수록 응답을 느리게" 방식은 Workers에서 **CPU 시간을 그대로 태운다**(무료 등급
 * 10ms). 공격자가 느려지는 만큼 우리도 비용을 낸다. 그래서 기다리게 하지 않고
 * **즉시 거절하고 남은 시간을 돌려준다.**
 */

/** 이만큼까지는 그냥 틀릴 수 있다. 사람은 오타를 낸다. */
export const FREE_ATTEMPTS = 4;

/** 잠금 상한. ⚠ 이 값을 키우면 계정 잠금 DoS의 값어치가 같이 커진다. */
export const MAX_LOCK_SECONDS = 30 * 60;

/**
 * 마지막 실패로부터 이만큼 지나면 **없던 일로 본다.**
 * 한 달 전에 세 번 틀린 것이 오늘의 판단에 끼어들면 안 된다.
 */
export const ATTEMPT_WINDOW_SECONDS = 60 * 60;

/** `FREE_ATTEMPTS`를 넘긴 뒤 n번째 실패의 잠금 길이(초). */
const LOCK_LADDER = [60, 120, 300, 600, MAX_LOCK_SECONDS];

export type AttemptRecord = {
  /** 연속 실패 횟수. 성공하면 0으로 되돌린다. */
  failures: number;
  /** 마지막 실패 시각(ISO). 한 번도 없으면 null. */
  lastFailedAt: string | null;
};

export type ThrottleVerdict =
  | { kind: "allow"; failures: number }
  | { kind: "locked"; retryAfterSeconds: number; failures: number };

/** 실패가 오래돼 창을 벗어났으면 없던 것으로 본다. */
export function decayRecord(record: AttemptRecord, now: Date): AttemptRecord {
  const last = parseTime(record.lastFailedAt);
  if (last === null) return { failures: 0, lastFailedAt: null };
  const elapsed = (now.getTime() - last) / 1000;
  if (elapsed >= ATTEMPT_WINDOW_SECONDS) return { failures: 0, lastFailedAt: null };
  return record;
}

/** 실패 n회일 때의 잠금 길이(초). 여유 횟수 안이면 0. */
export function lockSecondsFor(failures: number): number {
  const over = failures - FREE_ATTEMPTS;
  if (over <= 0) return 0;
  return LOCK_LADDER[Math.min(over, LOCK_LADDER.length) - 1];
}

/**
 * 지금 이 계정이 시도해도 되는가.
 *
 * ⚠ **비밀번호를 대조하기 전에** 부른다. 잠긴 계정은 해시 비교(bcrypt)까지 가지 않는다 —
 *    bcrypt가 이 워커에서 가장 비싼 연산이고, 그걸 태우게 두면 잠금이 방어가 아니라
 *    공격자의 도구가 된다.
 */
export function checkAttempt(record: AttemptRecord, now: Date): ThrottleVerdict {
  const fresh = decayRecord(record, now);
  const lock = lockSecondsFor(fresh.failures);
  if (lock === 0) return { kind: "allow", failures: fresh.failures };

  const last = parseTime(fresh.lastFailedAt);
  if (last === null) return { kind: "allow", failures: fresh.failures };

  const remaining = Math.ceil(lock - (now.getTime() - last) / 1000);
  if (remaining <= 0) return { kind: "allow", failures: fresh.failures };
  return { kind: "locked", retryAfterSeconds: remaining, failures: fresh.failures };
}

/** 실패 한 번을 더한 결과. 저장할 값을 그대로 돌려준다. */
export function recordFailure(record: AttemptRecord, now: Date): AttemptRecord {
  const fresh = decayRecord(record, now);
  return { failures: fresh.failures + 1, lastFailedAt: now.toISOString() };
}

/**
 * 로그에 남길 한 줄.
 *
 * ⚠ **이메일 전체를 남기지 않는다.** 서버 로그도 새어 나갈 수 있고, 로그인 실패 기록은
 *    "이 주소에 계정이 있다"는 신호가 된다. 앞 두 글자와 도메인만 남겨도 추적에는 충분하다.
 */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  const head = email.slice(0, Math.min(2, at));
  return `${head}***${email.slice(at)}`;
}

function parseTime(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

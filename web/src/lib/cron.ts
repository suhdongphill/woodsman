/**
 * 자동 수집 스케줄 — 판단만 하는 순수 모듈.
 *
 * ## 왜 만들었나
 * ⚠ 2026-09-01까지 **모든 지표 수집이 관리자 버튼 하나뿐**이었다. 사람이 안 누르면 모든
 *    지표가 조용히 낡는다. 실제로 8월 31일에 환율이 **열흘 뒤처진 값**으로 화면에 떠 있었고,
 *    그걸 봐주려고 달아 둔 `staleDays: 14`가 경고까지 덮고 있었다. 수집을 **사람의 기억에
 *    걸어 두지 않는다** — 이 모듈은 그 결정의 자리다.
 *
 * ## 규칙
 * - ⚠ **시크릿이 없으면 문을 아예 열지 않는다.** "설정 안 했으니 그냥 통과"는 이 경로를
 *   누구나 두드릴 수 있는 문으로 만든다. 바깥 서버(FRED·Yahoo)를 대신 두드리는 버튼이라
 *   열려 있으면 그대로 남의 서버를 치는 도구가 된다(`features/macro/actions.ts`와 같은 이유).
 * - ⚠ **모르는 cron 표현식을 조용히 넘기지 않는다.** 설정만 고치고 코드를 안 고치면
 *   "돌긴 도는데 아무 일도 안 하는" 스케줄이 된다 — 이 프로젝트가 반복해서 데인
 *   **조용한 실패**의 전형이다. 모르면 **전부 돌리고 큰 소리로 남긴다**(CLAUDE.md 3장).
 * - ⚠ 여기 적은 `CRON_PLAN`의 표현식은 `wrangler.jsonc`의 `triggers.crons`와 **같아야 한다.**
 *   런타임이 wrangler 설정을 읽을 수 없어 같은 값을 두 번 적게 되는 자리라,
 *   `cron.test.ts`가 설정 파일을 직접 읽어 대조한다(CLAUDE.md 2-1장).
 */

/** 스케줄 실행이 자기 자신임을 밝히는 헤더. 값은 `CRON_SECRET`. */
export const CRON_HEADER = "x-woodsman-cron";

/**
 * 시크릿의 최소 길이.
 * ⚠ 짧은 값을 허용하면 "설정은 했다"는 안심만 주고 실제로는 추측 가능한 문이 된다.
 */
export const CRON_SECRET_MIN_LENGTH = 32;

/** 자동으로 돌리는 수집 작업. */
export type CronJob = "macro" | "quotes";

/** ⚠ 새 작업을 더하면 여기에도 넣는다 — 모르는 스케줄일 때 돌아가는 목록이다. */
export const ALL_CRON_JOBS: readonly CronJob[] = ["macro", "quotes"];

export type CronPlanEntry = {
  /** Cloudflare cron 표현식(UTC). */
  expr: string;
  jobs: readonly CronJob[];
  /** 사람이 읽는 설명 — 화면·로그에 그대로 쓴다. */
  note: string;
};

/**
 * 언제 무엇을 돌리는가.
 *
 * ⚠ **매일 한 번**이다. 처음에는 주 1회로 잡았다가 바꿨다 — 낡음 경고를 붙여 둔 지표
 *    (환율·달러인덱스·금·주가지수)는 발표 주기가 **일간**이라, 주 1회로 받으면 최대 엿새치가
 *    밀린 채로 "기한초과"를 띄운다. **판정을 붙였으면 입력 주기도 맞춘다.**
 * 시각은 21:00 UTC = **06:00 KST**. 미국 장 마감(다음날 05:00 KST 전후) 뒤라
 * 전날 종가까지 들어온다.
 */
export const CRON_PLAN: readonly CronPlanEntry[] = [
  { expr: "0 21 * * *", jobs: ALL_CRON_JOBS, note: "매일 06:00(KST) 전체 수집" },
];

/**
 * 이 표현식으로 무엇을 돌릴 것인가.
 *
 * ⚠ 모르는 표현식이면 **빈 목록을 주지 않는다.** 아무것도 안 하고 성공으로 끝나면
 *    "수집이 도는 줄 알았는데 몇 달째 아무것도 안 받고 있었다"가 된다.
 *    전부 돌리고 `known: false`로 알린다 — 호출부가 이걸 로그로 남긴다.
 */
export function planForCron(expr: string | undefined | null): {
  jobs: readonly CronJob[];
  known: boolean;
} {
  const found = CRON_PLAN.find((p) => p.expr === expr);
  return found ? { jobs: found.jobs, known: true } : { jobs: ALL_CRON_JOBS, known: false };
}

/**
 * 길이를 먼저 보고, 같으면 전부 비교한다.
 * ⚠ 길이는 새어 나간다(감수한다). 한 글자씩 끊어 맞히는 것만 막으면 된다.
 */
function equalsInConstantTime(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * 이 요청을 스케줄 실행으로 인정할 것인가.
 *
 * ⚠ **시크릿이 비었거나 짧으면 무조건 거부**한다. 설정 누락이 "누구나 통과"가 되면 안 된다.
 */
export function isAuthorizedCron(
  header: string | null | undefined,
  secret: string | null | undefined,
): boolean {
  const key = typeof secret === "string" ? secret.trim() : "";
  if (key.length < CRON_SECRET_MIN_LENGTH) return false;

  const given = typeof header === "string" ? header.trim() : "";
  if (given.length === 0) return false;

  return equalsInConstantTime(given, key);
}

export type CronJobResult = {
  job: CronJob;
  ok: boolean;
  okCount?: number;
  failCount?: number;
  addedPoints?: number;
  error?: string;
};

/**
 * 실행 결과 한 줄 요약.
 * ⚠ 실패를 **끝에 몰아 감추지 않는다.** 실패한 작업이 있으면 문장 앞쪽에서 보이게 한다.
 */
export function cronSummary(results: readonly CronJobResult[]): string {
  if (results.length === 0) return "돌린 작업이 없습니다";

  return results
    .map((r) =>
      r.ok
        ? `${r.job} 성공 ${r.okCount ?? 0}·실패 ${r.failCount ?? 0}·새 값 ${r.addedPoints ?? 0}`
        : `${r.job} ⚠ 실행 실패 — ${r.error ?? "이유 불명"}`,
    )
    .join(" · ");
}

/** 전부 성공했는가 — 하나라도 실패하면 응답 상태가 달라져야 한다. */
export function allSucceeded(results: readonly CronJobResult[]): boolean {
  return results.length > 0 && results.every((r) => r.ok);
}

/**
 * 시크릿이 쓸 만한 상태인가 — **화면에 보여주기 위한 판정**이다.
 *
 * ⚠ 값을 담지 않는다. 길이만 본다.
 * ⚠ 왜 화면에 내보이나: 시크릿이 없으면 스케줄은 **아무 일도 하지 않고 조용히 끝난다.**
 *    그 상태를 볼 수 있는 자리가 어디에도 없으면 "도는 줄 알았는데 몇 달째"가 된다
 *    (이 프로젝트가 반복해서 데인 조용한 실패다).
 */
export type CronSecretState = "ok" | "short" | "missing";

export function cronSecretState(secret: string | undefined | null): CronSecretState {
  const value = typeof secret === "string" ? secret.trim() : "";
  if (value.length === 0) return "missing";
  return value.length >= CRON_SECRET_MIN_LENGTH ? "ok" : "short";
}

export const CRON_SECRET_LABEL: Record<CronSecretState, string> = {
  ok: "등록됨",
  short: `⚠ 너무 짧습니다(${CRON_SECRET_MIN_LENGTH}자 이상)`,
  missing: "⚠ 없습니다 — 스케줄이 돌아도 아무것도 하지 않습니다",
};

/**
 * 다음 실행 시각(UTC).
 *
 * ⚠ **`분 시 * * *` 꼴만** 계산한다. 그 밖의 표현식은 `null`이다 —
 *    범용 cron 파서를 흉내 내다가 틀린 시각을 단언하느니, 모른다고 하는 편이 낫다
 *    (사이트맵 lastmod에서 이미 배운 규칙이다).
 */
export function nextDailyRun(expr: string, from: Date): Date | null {
  const match = /^(\d{1,2}) (\d{1,2}) \* \* \*$/.exec(expr.trim());
  if (!match) return null;

  const minute = Number(match[1]);
  const hour = Number(match[2]);
  if (minute > 59 || hour > 23) return null;

  const next = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), hour, minute, 0, 0),
  );
  if (next.getTime() <= from.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

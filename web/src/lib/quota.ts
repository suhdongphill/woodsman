/**
 * Cloudflare 무료 등급 한도와 **한도 때문에 난 에러인지 판정** — 순수 함수.
 *
 * ## 왜 필요한가
 * 무료 등급에서 한도에 닿으면 화면은 그냥 "불러오지 못했습니다"가 된다. 코드 버그와
 * 구분이 안 되므로 **몇 시간을 엉뚱한 데서 찾게 된다.** 요금제만 올리면 끝나는 문제인데도.
 *
 * 그래서 두 가지를 만든다.
 * 1. **사용량 계기** — 닿기 전에 보이게. D1은 쿼리 결과의 `meta.size_after`로 실제 크기를 준다.
 * 2. **에러 분류기** — 에러 문자열을 보고 "이건 한도 문제다"라고 말해 준다.
 *    ⚠ 확신할 수 없으면 **아니라고 하지 않고 '모름'이라고 한다** — 없는 확신을 팔지 않는다.
 *
 * ## ⚠ 숫자는 확인 시점이 있는 값이다
 * 아래 한도는 **2026-08-11에 확인**한 값이다(`docs/종목분석_보고서_설계서_v1.md` §7-2에
 * 같은 표가 있다). Cloudflare가 바꾸면 여기도 바뀐다 — 화면에 **확인 날짜를 함께 적는다.**
 * 공식 문서: https://developers.cloudflare.com/d1/platform/limits
 */

/** 한도표를 마지막으로 확인한 날. ⚠ 화면에 그대로 적는다 — 오래된 숫자를 확정처럼 보이지 않게. */
export const LIMITS_CHECKED_AT = "2026-08-11";

export type Plan = "free" | "paid";

export type LimitRow = {
  key: string;
  label: string;
  free: string;
  paid: string;
  /** 이 한도에 닿으면 어떤 증상이 나오나 */
  symptom: string;
};

/** 우리가 실제로 쓰는 자원의 한도만 적는다. 안 쓰는 것을 적으면 표가 거짓말을 한다. */
export const CLOUDFLARE_LIMITS: LimitRow[] = [
  {
    key: "d1-db-size",
    label: "D1 데이터베이스 크기",
    free: "500 MB",
    paid: "10 GB",
    symptom: "쓰기가 실패한다. 읽기는 되므로 화면은 멀쩡해 보이고 저장만 안 된다.",
  },
  {
    key: "d1-queries-per-invocation",
    label: "Worker 호출당 D1 쿼리 수",
    free: "50개",
    paid: "1,000개",
    symptom: "화면 하나가 통째로 실패한다. 섹션마다 왕복하는 코드에서 먼저 터진다.",
  },
  {
    key: "d1-rows-written",
    label: "D1 하루 쓰기 행 수",
    free: "100,000행",
    paid: "월 5,000만 행(이후 종량)",
    symptom: "집계 비콘·보고서 저장이 하루 중간부터 실패한다.",
  },
  {
    key: "d1-rows-read",
    label: "D1 하루 읽기 행 수",
    free: "5,000,000행",
    paid: "월 250억 행(이후 종량)",
    symptom: "읽기가 실패해 화면이 빈다.",
  },
  {
    key: "worker-requests",
    label: "Worker 하루 요청 수",
    free: "100,000건",
    paid: "월 1,000만 건 포함(이후 종량)",
    symptom: "사이트 전체가 오류 1027로 막힌다.",
  },
  {
    key: "worker-cpu",
    label: "Worker 호출당 CPU 시간",
    free: "10 ms",
    paid: "30초(설정 가능)",
    symptom: "무거운 화면만 간헐적으로 죽는다. 재현이 어렵다.",
  },
];

/** D1 한 데이터베이스의 크기 한도(바이트). */
export const D1_SIZE_LIMIT: Record<Plan, number> = {
  free: 500 * 1024 * 1024,
  paid: 10 * 1024 * 1024 * 1024,
};

/**
 * Cloudflare 대시보드 링크.
 * ⚠ 계정 ID를 코드에 박지 않는다 — `?to=/:account/…` 형식을 대시보드가 알아서 풀어 준다.
 *    계정이 바뀌어도 링크가 살아 있고, 저장소에 계정 식별자를 남기지 않는다.
 */
export const CLOUDFLARE_LINKS = {
  billing: "https://dash.cloudflare.com/?to=/:account/billing",
  workersPlans: "https://dash.cloudflare.com/?to=/:account/workers/plans",
  d1: "https://dash.cloudflare.com/?to=/:account/workers/d1",
  observability: "https://dash.cloudflare.com/?to=/:account/workers/services/view/woodsman/production/observability",
  limitsDoc: "https://developers.cloudflare.com/d1/platform/limits",
} as const;

export type UsageLevel = "ok" | "warn" | "critical";

export type UsageGauge = {
  usedBytes: number;
  limitBytes: number;
  pct: number;
  level: UsageLevel;
  text: string;
};

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/**
 * D1 사용량을 계기판 값으로.
 * ⚠ 70%에서 경고하고 90%에서 위험이다. 100%에서 알려 주면 **이미 쓰기가 실패한 뒤**다.
 */
export function gaugeD1(usedBytes: number, plan: Plan = "free"): UsageGauge {
  const limitBytes = D1_SIZE_LIMIT[plan];
  const pct = limitBytes > 0 ? Math.round((usedBytes / limitBytes) * 1000) / 10 : 0;
  const level: UsageLevel = pct >= 90 ? "critical" : pct >= 70 ? "warn" : "ok";

  const head = `${formatBytes(usedBytes)} / ${formatBytes(limitBytes)} (${pct}%)`;
  if (level === "critical") {
    return { usedBytes, limitBytes, pct, level, text: `${head} — ⚠ 곧 쓰기가 실패합니다. 요금제를 올리거나 오래된 데이터를 줄이세요.` };
  }
  if (level === "warn") {
    return { usedBytes, limitBytes, pct, level, text: `${head} — 여유가 줄고 있습니다. 지금 결정해 두면 급하게 옮기지 않아도 됩니다.` };
  }
  return { usedBytes, limitBytes, pct, level, text: `${head} — 여유가 있습니다.` };
}

export type QuotaVerdict = {
  /** yes 한도 문제 · no 한도 문제가 아니다 · unknown 판단할 수 없다 */
  kind: "yes" | "no" | "unknown";
  /** 어느 자원인가 (`CLOUDFLARE_LIMITS`의 key) */
  resource?: string;
  title: string;
  detail: string;
  /** 무엇을 하면 되나 */
  action: string;
};

/** 에러에서 사람이 읽을 문자열을 뽑는다. */
function textOf(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (typeof error === "string") return error;
  try {
    // ⚠ JSON.stringify(undefined)는 문자열이 아니라 undefined를 준다. 그대로 쓰면 여기서 죽는다.
    return JSON.stringify(error) ?? String(error);
  } catch {
    return String(error);
  }
}

/**
 * 이 에러가 **비용·한도 때문인가**를 판정한다.
 *
 * ⚠ 확신할 수 없으면 `unknown`이다. "한도 문제가 아니다"라고 단정하면 진짜 한도 문제일 때
 *    엉뚱한 데를 뒤지게 된다. 판정 못 하는 것과 아닌 것은 다르다.
 */
export function classifyQuotaError(error: unknown): QuotaVerdict {
  const raw = textOf(error);
  const text = raw.toLowerCase();

  const upgrade = "Cloudflare 대시보드에서 Workers 유료 요금제로 올리면 풀립니다.";

  if (/storage limit|database is full|database or disk is full|sqlite_full/.test(text)) {
    return {
      kind: "yes",
      resource: "d1-db-size",
      title: "D1 저장 용량 한도에 닿았습니다",
      detail: `무료 등급은 데이터베이스 하나에 500 MB입니다. (원문: ${raw})`,
      action: upgrade,
    };
  }
  if (/too many sql statements|exceeded.*(queries|statements)|query limit/.test(text)) {
    return {
      kind: "yes",
      resource: "d1-queries-per-invocation",
      title: "한 요청에서 D1 쿼리를 너무 많이 보냈습니다",
      detail: `무료 등급은 Worker 호출당 50개입니다. (원문: ${raw})`,
      action: `${upgrade} 코드로 줄이려면 여러 행을 한 문장에 담아 batch()로 보내세요.`,
    };
  }
  if (/rows? (read|written).*(limit|exceeded)|daily (read|write) limit/.test(text)) {
    return {
      kind: "yes",
      resource: "d1-rows-written",
      title: "D1 하루 행 한도에 닿았습니다",
      detail: `무료 등급은 하루 쓰기 10만 행 · 읽기 500만 행입니다. 자정(UTC)에 초기화됩니다. (원문: ${raw})`,
      action: upgrade,
    };
  }
  if (/\b1027\b|daily request limit|exceeded the daily/.test(text)) {
    return {
      kind: "yes",
      resource: "worker-requests",
      title: "Worker 하루 요청 한도에 닿았습니다",
      detail: `무료 등급은 하루 10만 건입니다. 이 상태에서는 사이트 전체가 막힙니다. (원문: ${raw})`,
      action: upgrade,
    };
  }
  if (/exceeded resource limits|cpu time limit|script exceeded time/.test(text)) {
    return {
      kind: "yes",
      resource: "worker-cpu",
      title: "Worker CPU 시간 한도를 넘었습니다",
      detail: `무료 등급은 호출당 10 ms입니다. 무거운 화면만 간헐적으로 죽어 재현이 어렵습니다. (원문: ${raw})`,
      action: `${upgrade} 유료는 30초까지 설정할 수 있습니다.`,
    };
  }

  // ⚠ "한도/초과"라는 말은 있는데 어느 자원인지 모르는 경우 — 아니라고 하지 않는다.
  if (/limit|exceeded|quota|too many|429|1015/.test(text)) {
    return {
      kind: "unknown",
      title: "한도 문제일 수 있습니다",
      detail: `에러에 한도를 뜻하는 말이 들어 있지만 어느 자원인지 특정하지 못했습니다. (원문: ${raw})`,
      action: "Cloudflare 대시보드의 사용량 화면에서 어느 자원이 찼는지 확인하세요.",
    };
  }

  return {
    kind: "no",
    title: "한도 문제로 보이지 않습니다",
    detail: raw,
    action: "코드 쪽 원인을 먼저 보세요. 서버 로그의 [d1] 항목에 원문이 남습니다.",
  };
}

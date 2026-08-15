/**
 * 속도 제한 자가 진단의 **판정 규칙** — 순수 함수.
 *
 * ## 왜 이 파일이 따로 있나
 * 2026-08-11에 "속도 제한을 걸었다"고 적었다가 배포 후 **447건 중 0건 차단**이라는
 * 실측에 뒤집혔다. 그때 얻은 교훈이 이것이다:
 *
 * > 방어 장치는 붙였다고 끝이 아니라 **"실제로 막히는지"를 재야 한다.**
 *
 * 그 측정을 한 번 하고 마는 CLI 작업이 아니라 **언제든 다시 누를 수 있는 화면**으로 남긴다
 * (`/admin/diagnostics`). 그리고 "무엇을 보고 막힌다고 판정하는가"는 **판단**이지 질의가
 * 아니므로 여기 순수 함수로 두고 테스트로 고정한다.
 *
 * ## ⚠ 이 측정이 답하지 않는 것 (2026-08-15 실측으로 알게 된 것)
 * 여기서 재는 것은 **워커 하나 안에서 연달아 부른 경우**다. 그건 속도 제한에 **가장 유리한
 * 조건**이다. 같은 날 운영본 실측에서 이런 차이가 나왔다:
 *
 * - 순차 100건 / 29초 → **32건 차단** (막는다)
 * - 병렬 120건 / 18초 → **0건 차단**, 그 직후 순차 30건도 **0건 차단**
 *
 * ⚠ 그러므로 이 화면이 "막습니다"라고 해도 **동시 폭주까지 막는다는 뜻이 아니다.**
 * 판정 문구에 그 사실을 함께 적는다 — 없는 안전을 팔지 않는다.
 *
 * ⚠ 측정 자체(바인딩을 꺼내 `limit()`을 부르는 일)는 `lib/beacon-guard.ts`에 있다.
 *   이 파일은 그 결과를 **읽기만** 한다.
 */

/**
 * 자가 진단이 부르는 횟수. ⚠ 상한보다 **커야** 판정이 된다.
 * 한 요청 안에서 끝나야 하므로 크게 잡지 않는다.
 */
export const SELFTEST_CALLS = 20;

/**
 * 진단 전용 바인딩의 상한.
 * ⚠ `wrangler.jsonc`의 `SELFTEST_LIMITER`와 **같아야 한다.** 숫자를 두 곳에 적는 것이
 * 마음에 걸리지만 Worker 런타임에서는 wrangler 설정을 읽을 수 없다. 대신
 * `beacon-selftest.test.ts`가 **설정 파일을 직접 읽어 대조**한다 — 어긋나면 빌드가 깨진다.
 * (2026-08-11 "개수를 코드에 하드코딩하지 않는다" 교훈의 적용.)
 */
export const SELFTEST_LIMIT = 10;

/** 자가 진단 한 번의 측정 결과. `lib/beacon-guard.probeLimiter()`가 만든다. */
export type LimiterProbe = {
  binding: string;
  /** 바인딩을 찾은 결과. `ready`가 아니면 측정 자체가 이뤄지지 않았다. */
  state: "ready" | "absent" | "malformed" | "unavailable";
  /** 바인딩 객체의 실제 타입 이름. 스텁이 왔는지 여기서 드러난다. */
  typeName?: string;
  detail?: string;
  /** 실제로 성공한 `limit()` 호출 수. */
  calls: number;
  /** 그중 `success: false`를 받은 수. */
  blocked: number;
  /** `limit()`이 돌려준 첫 값의 모양. `{"success":true}`가 정상이다. */
  firstResult?: string;
  error?: string;
};

export type ProbeVerdict = {
  /** `ok` 막는다 · `fail` 안 막는다 · `unknown` 판정할 수 없다 */
  level: "ok" | "fail" | "unknown";
  headline: string;
  /** 화면에 그대로 적는 설명. ⚠ 없는 확신을 팔지 않는다. */
  detail: string;
};

/**
 * 측정 결과를 판정한다.
 *
 * `expectedLimit`은 wrangler 설정의 상한이다. **호출 수가 상한을 넘지 않으면 판정하지 않는다** —
 * 상한 10에 5번 불러 놓고 "안 막혔다"고 적으면 그게 바로 거짓 경보다.
 */
export function judgeProbe(probe: LimiterProbe, expectedLimit: number): ProbeVerdict {
  if (probe.state === "absent") {
    return {
      level: "unknown",
      headline: "바인딩이 없습니다",
      detail: `env.${probe.binding}가 없습니다. 로컬 개발이거나 wrangler.jsonc의 ratelimits가 배포에 반영되지 않았습니다.`,
    };
  }
  if (probe.state === "unavailable") {
    return {
      level: "unknown",
      headline: "Cloudflare context를 읽지 못했습니다",
      detail: probe.detail ?? "원인은 서버 로그의 [beacon] 항목에 있습니다.",
    };
  }
  if (probe.state === "malformed") {
    return {
      level: "fail",
      headline: "바인딩 모양이 다릅니다",
      detail: `타입은 ${probe.typeName ?? "알 수 없음"}인데 limit()이 함수가 아닙니다. ${probe.detail ?? ""}`.trim(),
    };
  }
  if (probe.error) {
    return {
      level: "fail",
      headline: "limit() 호출이 실패했습니다",
      detail: probe.error,
    };
  }
  if (probe.calls <= expectedLimit) {
    return {
      level: "unknown",
      headline: "판정할 수 없습니다",
      detail: `상한(${expectedLimit}회)보다 적게(${probe.calls}회) 불렀습니다. 상한을 넘겨야 막히는지 알 수 있습니다.`,
    };
  }
  if (probe.blocked === 0) {
    return {
      level: "fail",
      headline: "⚠ 막지 못합니다",
      detail:
        `${probe.calls}회를 연속으로 불렀는데 한 번도 차단되지 않았습니다(상한 ${expectedLimit}회). ` +
        `첫 반환값은 ${probe.firstResult ?? "확인 불가"}였습니다. ` +
        `이 조건은 속도 제한에 가장 유리한 조건인데도 막지 못했다는 뜻이라, 이 바인딩은 방어로 쓸 수 없습니다.`,
    };
  }
  return {
    level: "ok",
    headline: "여기서는 막습니다",
    detail:
      `${probe.calls}회 중 ${probe.blocked}회가 차단됐습니다(상한 ${expectedLimit}회, 기대치 약 ${probe.calls - expectedLimit}회). ` +
      `⚠ 다만 이건 워커 하나 안에서 연달아 부른 결과입니다 — 속도 제한에 가장 유리한 조건입니다. ` +
      `2026-08-15 운영 실측에서 병렬 120건은 한 건도 막히지 않았습니다. 동시 폭주까지 막는다는 뜻이 아닙니다.`,
  };
}

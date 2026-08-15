/**
 * 집계 비콘의 문지기.
 *
 * ## 왜 필요한가
 * `/api/view`·`/api/engagement`는 **로그인 없이 누구나 DB에 쓰게 하는 유일한 경로**다.
 * 2026-08-07 점검이 "`/api/view` 무제한 쓰기"로 잡았다.
 *
 * ## ⚠ 2026-08-11 실측 — 속도 제한은 막지 못했다
 * 처음에는 Cloudflare Rate Limiting 바인딩(`BEACON_LIMITER`, 60회/분)을 **"실제 방어선"**
 * 이라고 적었다. **틀렸다.** 운영본에 배포한 뒤 재 보니 **447건을 연속으로 보내도 한 건도
 * 차단되지 않았다**(병렬 120건 7초 × 2회 포함). 바인딩은 붙어 있었고 `cf-connecting-ip`도
 * 정상 수신됐다. 즉 `limit()`이 매번 `success: true`를 준다.
 *
 * 2026-08-15에 원인을 한 겹 더 좁혔다 — **OpenNext의 env 프록시 탓이 아니다.**
 * 운영에서 `runWithCloudflareRequestContext()`가 워커의 **실제 env를 그대로** AsyncLocalStorage에
 * 넣고(`@opennextjs/cloudflare/dist/cli/templates/init.js`), `lib/d1.ts`도 **같은 경로로**
 * 바인딩을 꺼내 잘 동작한다. 그러므로 여기 오는 객체는 진짜 바인딩이다.
 * ⚠ 따라서 "미들웨어로 옮겨 프록시를 건너뛴다"는 대안은 **의미가 없다**(같은 env를 본다).
 * 남은 설명은 Cloudflare 문서가 스스로 밝힌 성질뿐이다 — *permissive · eventually consistent ·
 * 정확한 계수 시스템으로 쓰지 말 것*.
 *
 * ## 그래서 방어를 어떻게 나눴나
 * | 층 | 무엇을 막나 | 어디에 있나 | 검증 |
 * |---|---|---|---|
 * | 1 | **없는 경로를 만들어 내는 것** | `lib/beacon-path.ts` | 테스트로 고정 |
 * | 2 | 본문 크기·타 사이트에서 부르기 | 이 파일 | 테스트로 고정 |
 * | 3 | **볼륨(같은 경로 부풀리기)** | `BEACON_LIMITER` | ⚠ **실측에서 실패. 미해결** |
 *
 * ⚠ 3층이 뚫려 있는 동안 초기 통계는 **덜 믿어야 한다.** 볼륨 상한의 후속안은
 * `docs/계획_2026-08-15.md` A3에 적었다.
 *
 * ## ⚠ 조용히 실패하지 않는다
 * 바인딩이 없거나 모양이 다르면 **막지 않고 통과시키되 반드시 로그를 남긴다.**
 * 이전 판에서는 `getCloudflareContext()`의 예외를 `catch {}`로 **삼켰다** — 그래서
 * "바인딩이 없는 것"과 "context를 못 읽은 것"이 화면에서 똑같이 보였다. 그 구멍을 메웠다.
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { LimiterProbe } from "./beacon-selftest";

/** 비콘 본문 상한(바이트). 실제 본문은 200바이트 안쪽이다. */
export const MAX_BEACON_BODY = 1024;

/** 운영 비콘이 쓰는 바인딩. */
export const BEACON_LIMITER_BINDING = "BEACON_LIMITER";

/**
 * 자가 진단 전용 바인딩(작은 상한). ⚠ 운영 카운터를 건드리지 않으려고 따로 둔다 —
 * 진단하겠다고 실제 방문자의 집계를 막으면 안 된다.
 */
export const SELFTEST_LIMITER_BINDING = "SELFTEST_LIMITER";

export type BeaconVerdict =
  | { ok: true }
  | { ok: false; reason: "too-large" | "cross-site" | "rate-limited" };

type RateLimiter = { limit: (input: { key: string }) => Promise<{ success: boolean }> };

/**
 * 바인딩을 찾은 결과. ⚠ "없다"와 "있는데 이상하다"와 "못 읽었다"를 **구분해서** 돌려준다.
 * 셋을 뭉개면 운영에서 무엇이 잘못됐는지 알 수 없다(3장에서 크게 데인 부분이다).
 */
export type LimiterState =
  | { kind: "ready"; limiter: RateLimiter; typeName: string }
  | { kind: "absent" }
  | { kind: "malformed"; typeName: string; detail: string }
  | { kind: "unavailable"; detail: string };

/** 바인딩을 찾아 **모양까지 확인**한다. 캐스팅만 하고 믿지 않는다. */
export async function resolveLimiter(bindingName: string): Promise<LimiterState> {
  let env: Record<string, unknown>;
  try {
    const context = await getCloudflareContext({ async: true });
    env = context.env as unknown as Record<string, unknown>;
  } catch (error) {
    // ⚠ 이전 판은 여기서 조용히 undefined를 돌려줬다. 그러면 "바인딩 없음"과 구분이 안 된다.
    console.error("[beacon] Cloudflare context를 읽지 못했습니다", error);
    return { kind: "unavailable", detail: String(error) };
  }

  const binding = env[bindingName];
  if (binding === undefined || binding === null) return { kind: "absent" };

  const typeName = (binding as { constructor?: { name?: string } })?.constructor?.name ?? typeof binding;
  if (typeof (binding as RateLimiter).limit !== "function") {
    return { kind: "malformed", typeName, detail: "limit()이 함수가 아닙니다" };
  }
  return { kind: "ready", limiter: binding as RateLimiter, typeName };
}

/**
 * 브라우저가 보낸 같은 출처 요청인가.
 * `same-origin`·`same-site`만 통과시킨다. 헤더가 아예 없으면(구형 브라우저) 통과시킨다 —
 * ⚠ 여기서 막으면 정상 사용자의 집계가 조용히 사라진다.
 * ⚠ 위조 가능한 헤더다. **이것만으로 보호라고 부르지 않는다** — 스크립트 키디만 걸러 낸다.
 */
function isSameSite(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (!site) return true;
  return site === "same-origin" || site === "same-site" || site === "none";
}

/** 본문 크기 상한을 넘었나. 비콘 본문은 몇백 바이트다 — 큰 본문은 읽지도 않는다. */
function isTooLarge(request: Request): boolean {
  const length = Number(request.headers.get("content-length") ?? "0");
  return Number.isFinite(length) && length > MAX_BEACON_BODY;
}

/**
 * 비콘 요청을 받아도 되는지 판정한다.
 * `bucket`은 속도 제한 키의 접두사다(경로별로 나눠 한 경로의 폭주가 다른 경로를 막지 않게).
 */
export async function guardBeacon(request: Request, bucket: string): Promise<BeaconVerdict> {
  if (isTooLarge(request)) return { ok: false, reason: "too-large" };
  if (!isSameSite(request)) return { ok: false, reason: "cross-site" };

  const state = await resolveLimiter(BEACON_LIMITER_BINDING);
  if (state.kind !== "ready") {
    // ⚠ 조용한 실패 금지. 운영에서 이 줄이 보이면 wrangler.jsonc나 배포를 확인해야 한다.
    console.warn(`[beacon] ${BEACON_LIMITER_BINDING} 사용 불가(${state.kind}) — 속도 제한 없이 통과시킵니다`);
    return { ok: true };
  }

  // Cloudflare가 붙이는 접속 IP. ⚠ 카운터 키로만 쓰고 **어디에도 저장하지 않는다.**
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";

  let result: { success: boolean };
  try {
    result = await state.limiter.limit({ key: `${bucket}:${ip}` });
  } catch (error) {
    console.error("[beacon] limit() 호출이 실패했습니다", error);
    return { ok: true };
  }

  // ⚠ 반환 모양까지 확인한다. `{success: undefined}`가 오면 `success ? …`가 **전부 차단**으로
  //    떨어져 집계가 통째로 사라진다. 그 사고를 로그 없이 겪지 않는다.
  if (typeof result?.success !== "boolean") {
    console.error("[beacon] limit()이 예상과 다른 값을 돌려줬습니다", JSON.stringify(result));
    return { ok: true };
  }

  return result.success ? { ok: true } : { ok: false, reason: "rate-limited" };
}

/**
 * **바인딩이 실제로 막는지 재 본다.**
 *
 * 2026-08-11의 교훈이 여기 들어 있다 — *방어 장치는 붙였다고 끝이 아니라 "실제로 막히는지"를
 * 재야 한다.* 그 측정을 CLI가 아니라 **관리자 화면 버튼 하나**로 언제든 다시 할 수 있게 남긴다.
 *
 * ⚠ 운영 카운터를 오염시키지 않도록 **호출부가 진단 전용 바인딩과 고유 키**를 넘긴다.
 */
export async function probeLimiter(
  bindingName: string,
  key: string,
  calls: number,
): Promise<LimiterProbe> {
  const state = await resolveLimiter(bindingName);
  const base: LimiterProbe = { binding: bindingName, state: state.kind, calls: 0, blocked: 0 };

  if (state.kind === "malformed") return { ...base, typeName: state.typeName, detail: state.detail };
  if (state.kind === "unavailable") return { ...base, detail: state.detail };
  if (state.kind === "absent") return base;

  let firstResult: string | undefined;
  let blocked = 0;
  let made = 0;

  for (let i = 0; i < calls; i++) {
    try {
      const result = await state.limiter.limit({ key });
      made++;
      firstResult ??= JSON.stringify(result);
      if (result?.success === false) blocked++;
    } catch (error) {
      return {
        ...base,
        typeName: state.typeName,
        calls: made,
        blocked,
        firstResult,
        error: String(error),
      };
    }
  }

  return { ...base, typeName: state.typeName, calls: made, blocked, firstResult };
}

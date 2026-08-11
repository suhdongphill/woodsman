/**
 * 집계 비콘의 문지기.
 *
 * ## 왜 필요한가
 * `/api/view`·`/api/engagement`는 **로그인 없이 누구나 DB에 쓰게 하는 유일한 경로**다.
 * 2026-08-07 점검이 "`/api/view` 무제한 쓰기"로 잡았고, 체류시간 비콘을 더하면서 문이 하나
 * 더 생겼다. 막지 않으면 통계는 낙서가 되고 D1 쓰기 비용은 그대로 나간다.
 *
 * ## 세 겹으로 막는다
 * 1. **본문 크기** — 비콘 본문은 몇백 바이트다. 큰 본문은 읽지도 않는다.
 * 2. **동일 출처** — 브라우저가 붙이는 `Sec-Fetch-Site`를 본다. `sendBeacon`·`fetch` 모두 붙인다.
 *    ⚠ 이건 위조 가능한 헤더다(브라우저 밖에서는 마음대로 붙일 수 있다). **속도 제한을
 *    보조할 뿐 그것만으로 보호라고 부르지 않는다** — 스크립트 키디만 걸러 낸다.
 * 3. **속도 제한** — Cloudflare Rate Limiting 바인딩(`BEACON_LIMITER`). 실제 방어선이다.
 *
 * ## ⚠ 조용히 실패하지 않는다
 * 바인딩이 없으면(로컬 개발·바인딩 미설정) **막지 않고 통과시키되 경고를 남긴다.**
 * 여기서 조용히 통과시키면 운영에서 바인딩이 빠진 것을 아무도 모른다.
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";

/** 비콘 본문 상한(바이트). 실제 본문은 200바이트 안쪽이다. */
export const MAX_BEACON_BODY = 1024;

export type BeaconVerdict =
  | { ok: true }
  | { ok: false; reason: "too-large" | "cross-site" | "rate-limited" };

type RateLimiter = { limit: (input: { key: string }) => Promise<{ success: boolean }> };

/** 바인딩이 없으면 undefined. ⚠ 그 사실을 호출부가 알 수 있어야 한다. */
async function getLimiter(): Promise<RateLimiter | undefined> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const binding = (env as unknown as Record<string, unknown>).BEACON_LIMITER;
    return binding as RateLimiter | undefined;
  } catch {
    return undefined;
  }
}

/**
 * 브라우저가 보낸 같은 출처 요청인가.
 * `same-origin`·`same-site`만 통과시킨다. 헤더가 아예 없으면(구형 브라우저) 통과시킨다 —
 * ⚠ 여기서 막으면 정상 사용자의 집계가 조용히 사라진다. 속도 제한이 뒤를 받친다.
 */
function isSameSite(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (!site) return true;
  return site === "same-origin" || site === "same-site" || site === "none";
}

/**
 * 비콘 요청을 받아도 되는지 판정한다.
 * `bucket`은 속도 제한 키의 접두사다(경로별로 나눠 한 경로의 폭주가 다른 경로를 막지 않게).
 */
export async function guardBeacon(request: Request, bucket: string): Promise<BeaconVerdict> {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(length) && length > MAX_BEACON_BODY) {
    return { ok: false, reason: "too-large" };
  }

  if (!isSameSite(request)) return { ok: false, reason: "cross-site" };

  const limiter = await getLimiter();
  if (!limiter) {
    // ⚠ 조용한 실패 금지. 운영에서 이 줄이 보이면 wrangler.jsonc의 ratelimits가 빠진 것이다.
    console.warn("[beacon] BEACON_LIMITER 바인딩이 없어 속도 제한 없이 통과시킵니다");
    return { ok: true };
  }

  // Cloudflare가 붙이는 접속 IP. ⚠ 카운터 키로만 쓰고 **어디에도 저장하지 않는다.**
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  const { success } = await limiter.limit({ key: `${bucket}:${ip}` });

  return success ? { ok: true } : { ok: false, reason: "rate-limited" };
}

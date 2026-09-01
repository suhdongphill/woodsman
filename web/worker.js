/**
 * Worker 진입점 — OpenNext가 만든 핸들러에 **스케줄 실행**을 얹는다.
 *
 * ## 왜 이 파일이 필요한가
 * `.open-next/worker.js`에는 `fetch`만 있다. Cron Trigger를 받으려면 `scheduled` 핸들러가
 * 있어야 하는데, 그 파일은 빌드마다 새로 만들어지므로 손대면 다음 빌드에 지워진다.
 * 그래서 **감싸는 파일**을 따로 두고 `wrangler.jsonc`의 `main`을 여기로 돌린다.
 *
 * ⚠ **Durable Object를 다시 export 해야 한다.** OpenNext가 캐시·큐에 쓰는 클래스들이고,
 *    여기서 빠뜨리면 배포가 "class not found"로 죽는다.
 * ⚠ 이 파일은 `.js`다. `tsconfig.json`의 include가 TS 파일만 잡아서 타입 검사 대상이 아니고,
 *    `.open-next/worker.js`는 빌드 전에는 존재하지 않아 타입 검사를 통과할 수가 없다.
 *    번들은 wrangler(esbuild)가 하므로 `./src/lib/cron` 같은 TS import도 그대로 해석된다.
 *
 * ## 스케줄이 하는 일
 * 수집 자체는 **관리자 버튼과 같은 함수**가 한다. 여기서는 `/api/cron`을 한 번 두드릴 뿐이다.
 * Next 번들 바깥이라 D1 바인딩(`getCloudflareContext`)에 직접 붙을 수 없기 때문이고,
 * 같은 판단을 두 번 구현하지 않기 위해서다(운영지침 §1).
 */
import openNextWorker from "./.open-next/worker.js";
import { CRON_HEADER } from "./src/lib/cron";

export { DOQueueHandler } from "./.open-next/worker.js";
export { DOShardedTagCache } from "./.open-next/worker.js";
export { BucketCachePurge } from "./.open-next/worker.js";

/** 요청을 만들 때 쓸 주소. SITE_URL이 비면 요청 라우팅이 아니라 **로그**가 헷갈려진다. */
function baseUrl(env) {
  const configured = typeof env?.SITE_URL === "string" ? env.SITE_URL.trim() : "";
  return configured.replace(/\/+$/, "") || "https://portfolio-solutions.net";
}

export default {
  fetch(request, env, ctx) {
    return openNextWorker.fetch(request, env, ctx);
  },

  /**
   * Cron Trigger 진입점.
   *
   * ⚠ 실패를 삼키지 않는다. 스케줄은 아무도 보고 있지 않는 자리라, 여기서 조용히 끝나면
   *    **몇 달째 안 돌고 있는 것을 아무도 모른다.** 결과를 반드시 로그로 남긴다.
   */
  async scheduled(controller, env, ctx) {
    const secret = typeof env?.CRON_SECRET === "string" ? env.CRON_SECRET.trim() : "";
    if (!secret) {
      console.error(
        "[cron] CRON_SECRET이 없어 자동 수집을 건너뜁니다. `npx wrangler secret put CRON_SECRET`으로 넣으세요.",
      );
      return;
    }

    const cron = controller?.cron ?? "";
    const url = `${baseUrl(env)}/api/cron?cron=${encodeURIComponent(cron)}`;

    try {
      const response = await openNextWorker.fetch(
        new Request(url, { method: "POST", headers: { [CRON_HEADER]: secret } }),
        env,
        ctx,
      );
      const body = await response.text();

      if (response.ok) {
        console.log(`[cron] ${cron} 완료 · ${body}`);
      } else {
        console.error(`[cron] ${cron} 실패(HTTP ${response.status}) · ${body}`);
      }
    } catch (error) {
      console.error(`[cron] ${cron} 실행 중 예외`, error);
    }
  },
};

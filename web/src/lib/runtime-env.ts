/**
 * 실행 중인 환경에서 시크릿을 읽는 **한 곳**.
 *
 * ## 왜 두 군데를 보나
 * 로컬(`next dev`)에서는 `.env`가 `process.env`로 들어온다. 배포본(Workers)에서는
 * OpenNext가 대부분을 `process.env`에 실어 주지만, 바인딩 환경(`getCloudflareContext`)이
 * 정본이다. 둘을 각자 읽으면 "로컬은 되는데 배포만 안 되는" 사고가 난다(CLAUDE.md 3장).
 *
 * ⚠ **예외를 삼키지 않는다.** "값이 비었다"와 "context를 못 읽었다"는 다른 상태다.
 * ⚠ 여기서 읽은 값은 **부르는 자리에서만** 쓴다. 화면·로그·에러 메시지로 내보내지 않는다.
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { EnvSource } from "./env";

async function fromCloudflare(): Promise<Record<string, unknown>> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return (env ?? {}) as unknown as Record<string, unknown>;
  } catch (error) {
    console.error("[runtime-env] Cloudflare 환경을 읽지 못했습니다", error);
    return {};
  }
}

/** 이름 하나. 없으면 빈 문자열. */
export async function readRuntimeEnv(name: string): Promise<string> {
  const local = (process.env[name] ?? "").trim();
  if (local) return local;

  const value = (await fromCloudflare())[name];
  return typeof value === "string" ? value.trim() : "";
}

/** 여러 개를 한 번에 — 이름마다 `getCloudflareContext`를 다시 부르지 않는다. */
export async function readRuntimeEnvMany(names: readonly string[]): Promise<EnvSource> {
  const cloudflare = await fromCloudflare();
  const out: EnvSource = {};

  for (const name of names) {
    const local = (process.env[name] ?? "").trim();
    if (local) {
      out[name] = local;
      continue;
    }
    const value = cloudflare[name];
    if (typeof value === "string" && value.trim().length > 0) out[name] = value.trim();
  }
  return out;
}

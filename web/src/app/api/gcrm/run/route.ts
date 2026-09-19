/**
 * GCRM API (명세 §2-18). ⚠ 라우트는 **조립만** 한다 — 판단은 `features/gcrm/service.ts`에 있다.
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { computeAndSaveGcrm } from "@/features/gcrm/compute";
import { CRON_HEADER, isAuthorizedCron } from "@/lib/cron";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * 계산을 돌려 저장한다.
 *
 * ⚠ **시크릿 헤더 없이는 아무것도 하지 않는다** — 바깥에서 두드릴 수 있는 쓰기 경로다
 * (`/api/cron`과 같은 규율).
 */
/** ⚠ `getCloudflareContext()`는 반드시 `{ async: true }` (CLAUDE.md §4). */
async function readCronSecret(): Promise<string | undefined> {
  const { env } = await getCloudflareContext({ async: true });
  const value = (env as unknown as Record<string, unknown>).CRON_SECRET;
  return typeof value === "string" ? value : undefined;
}

export async function POST(request: Request) {
  const secret = await readCronSecret().catch((error) => {
    // ⚠ 삼키지 않는다 — 「시크릿이 없는 것」과 「못 읽은 것」이 같아 보이면 안 된다
    console.error("[gcrm] CRON_SECRET을 읽지 못했습니다", error);
    return undefined;
  });
  if (!isAuthorizedCron(request.headers.get(CRON_HEADER), secret)) {
    // ⚠ 거부 사유를 응답에 적지 않는다(시크릿 유무를 알려주는 꼴이 된다)
    console.error("[gcrm] 인증되지 않은 호출을 거부했습니다");
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const q = new URL(request.url).searchParams;
  const asOf = q.get("as_of") ?? new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);
  try {
    const s = await computeAndSaveGcrm({ asOf, dryRun: q.get("dry_run") === "1" });
    return NextResponse.json({
      ok: true,
      runId: s.runId,
      asOf: s.asOf,
      configHash: s.configHash,
      saved: s.saved,
      elapsedMs: s.elapsedMs,
      axes: Object.fromEntries(
        (["tide", "wind", "wave"] as const).map((a) => [a, { score: s.result.axes[a].score ?? null, status: s.result.axes[a].status }]),
      ),
      regime: s.result.regime.state.code,
    });
  } catch (error) {
    console.error("[gcrm] run 실패", error);
    return NextResponse.json({ ok: false, reason: String(error instanceof Error ? error.message : error) }, { status: 500 });
  }
}

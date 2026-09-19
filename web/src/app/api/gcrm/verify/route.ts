/**
 * GCRM API (명세 §2-18). ⚠ 라우트는 **조립만** 한다 — 판단은 `features/gcrm/service.ts`에 있다.
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { gcrmVerify } from "@/features/gcrm/service";
import { verdictLine } from "@/lib/gcrm/verify";

/**
 * ★ 재현성 검증. ⚠ 이게 통과하지 못하면 「재현 가능」이라고 말할 수 없다.
 * `CONFIG_CHANGED`는 불일치가 **아니다** — 설정이 달라 검증을 시작하지 못한 것이다.
 */
export async function GET(request: Request) {
  const asOf = new URL(request.url).searchParams.get("as_of") ?? undefined;
  try {
    const v = await gcrmVerify(asOf);
    const status = v.status === "OK" ? 200 : v.status === "NO_RUN" ? 404 : 409;
    return NextResponse.json({ ...v, line: v.status === "NO_RUN" ? v.detail : verdictLine(v) }, { status });
  } catch (error) {
    console.error("[gcrm] verify 실패", error);
    return NextResponse.json({ status: "ERROR", reason: "검증하지 못했다" }, { status: 500 });
  }
}

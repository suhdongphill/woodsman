/**
 * GCRM API (명세 §2-18). ⚠ 라우트는 **조립만** 한다 — 판단은 `features/gcrm/service.ts`에 있다.
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { gcrmExplain } from "@/features/gcrm/service";
import { AXES, type Axis } from "@/lib/gcrm/config/model";

export async function GET(request: Request, ctx: { params: Promise<{ pillar: string }> }) {
  const { pillar } = await ctx.params;
  const q = new URL(request.url).searchParams;
  const axis = (q.get("axis") ?? "tide") as Axis;
  if (!AXES.includes(axis)) {
    return NextResponse.json({ ok: false, reason: `축이 잘못됐다: ${axis}` }, { status: 400 });
  }
  try {
    const data = await gcrmExplain(pillar, axis, q.get("as_of") ?? undefined);
    return NextResponse.json(data, { status: data.ok ? 200 : 404 });
  } catch (error) {
    console.error("[gcrm] explain 실패", error);
    return NextResponse.json({ ok: false, reason: "계산하지 못했다" }, { status: 500 });
  }
}

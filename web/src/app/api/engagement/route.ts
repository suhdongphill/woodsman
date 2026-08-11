/**
 * 체류·읽힘 집계 비콘.
 *
 * 브라우저가 화면을 **떠날 때** 한 번 부른다(`components/analytics/EngagementBeacon`).
 *
 * ⚠ 저장하는 것은 **(경로, 날짜, 구간별 인원)뿐**이다. 쿠키·세션 ID를 만들지 않고,
 *    IP는 속도 제한 키로만 쓰고 저장하지 않는다(`lib/beacon-guard.ts`).
 *    그래서 "이 사람이 어디로 갔나"는 낼 수 없다 — 낼 수 있는 것은 화면 단위 소비 패턴까지다.
 * ⚠ 실패해도 화면에 영향을 주지 않는다. 다만 서버 로그에는 남긴다(조용한 실패 금지).
 */
import { NextResponse } from "next/server";
import { isBotUserAgent, normalizePath, viewDateKey } from "@/lib/analytics";
import { sanitizeEngagement } from "@/lib/engagement";
import { guardBeacon } from "@/lib/beacon-guard";
import { recordEngagement } from "@/features/analytics/engagement-repository";

export const runtime = "nodejs";
/** ⚠ 정적 생성 금지 — 매 요청마다 실행돼야 한다. */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const guard = await guardBeacon(request, "engagement");
    if (!guard.ok) {
      // 429를 주면 브라우저 콘솔이 빨개진다. 비콘은 실패해도 사용자가 알 필요가 없다.
      return NextResponse.json({ ok: true, counted: false, reason: guard.reason });
    }

    if (isBotUserAgent(request.headers.get("user-agent"))) {
      return NextResponse.json({ ok: true, counted: false });
    }

    const body = (await request.json().catch(() => null)) as {
      path?: string;
      dwellSec?: unknown;
      scrollPct?: unknown;
    } | null;

    const path = normalizePath(body?.path ?? "");
    if (!path) return NextResponse.json({ ok: true, counted: false });

    // ⚠ 누구나 부를 수 있는 값이라 여기서 범위를 자른다(`lib/engagement.sanitizeEngagement`).
    const measured = sanitizeEngagement({
      dwellSec: body?.dwellSec,
      scrollPct: body?.scrollPct,
    });
    if (!measured) return NextResponse.json({ ok: true, counted: false });

    await recordEngagement({
      path,
      date: viewDateKey(new Date()),
      dwellSec: measured.dwellSec,
      scrollPct: measured.scrollPct,
    });

    return NextResponse.json({ ok: true, counted: true });
  } catch (error) {
    console.error("[analytics] 체류 기록 실패", error);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}

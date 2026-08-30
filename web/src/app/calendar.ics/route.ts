/**
 * 경제 캘린더 구독 파일(iCalendar).
 *
 * ## ⚠ 구글 캘린더 연동에 회원 가입이 필요하지 않다
 * 구글 캘린더 → 「다른 캘린더 추가」 → 「URL로 추가」에 이 주소를 넣으면 일정이 그대로 들어간다.
 * 회원 기능은 나중에 열리지만 **구독은 지금 바로** 된다.
 *
 * ⚠ 캘린더 앱들은 이 파일을 **주기적으로 다시 받는다.** 그래서 응답이 오래 캐시되면
 *    새 일정이 며칠 뒤에야 보인다 — 캐시를 짧게 준다.
 * ⚠ 형식(CRLF·이스케이프)은 `lib/macro-calendar.ts`가 만든다. 여기서 문자열을 조립하지 않는다.
 */
import { toIcs } from "@/lib/macro-calendar";
import { loadEvents } from "@/features/calendar/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const events = await loadEvents(500);
    const body = toIcs(events, new Date().toISOString());

    return new Response(body, {
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        // 구독 앱이 하루에 몇 번씩 다시 받는다. 30분이면 충분히 신선하고 부담도 적다.
        "cache-control": "public, max-age=1800",
      },
    });
  } catch (error) {
    // ⚠ 조용히 빈 캘린더를 주지 않는다. 빈 캘린더는 "일정이 없다"로 읽힌다.
    console.error("[calendar] ics 생성 실패", error);
    return new Response("Calendar unavailable", { status: 503 });
  }
}

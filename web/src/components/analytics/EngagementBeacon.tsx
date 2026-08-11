"use client";

/**
 * 체류·읽힘 비콘 — 화면을 떠날 때 **한 번** 알린다.
 *
 * ## 무엇을 재나
 * ⚠ **벽시계 시간이 아니라 '보이는 시간'**을 잰다. 탭을 뒤로 넘겨 둔 시간은 세지 않는다.
 *    그걸 세면 "탭 20개 열어 두는 사람"이 통계를 통째로 바꾼다.
 * 스크롤 깊이는 **가장 깊이 내려간 지점**을 %로 기억한다(되돌아 올라와도 줄지 않는다).
 *
 * ## 언제 보내나
 * `visibilitychange`(hidden)와 `pagehide`에서 보낸다. `beforeunload`는 모바일 사파리에서
 * 자주 안 불린다. 두 이벤트가 다 불릴 수 있으므로 **보냈으면 다시 보내지 않는다.**
 *
 * ## ⚠ 개인을 식별하지 않는다
 * 쿠키를 심지 않고 세션 ID를 만들지 않는다. 보내는 것은 `{경로, 초, %}` 뿐이라
 * 서버는 이 값들을 **누가 보냈는지 알 수 없다**(`lib/engagement.ts`와 같은 규칙).
 */
import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** 이보다 짧으면 보내지 않는다 — 링크를 잘못 눌러 스쳐 간 것은 화면 평가에 넣지 않는다. */
const MIN_REPORT_SEC = 1;

function scrollDepthPct(): number {
  if (typeof document === "undefined") return 0;
  const doc = document.documentElement;
  const viewport = window.innerHeight || doc.clientHeight || 0;
  const total = Math.max(doc.scrollHeight, document.body?.scrollHeight ?? 0);

  // 스크롤이 없는 짧은 화면은 "다 봤다"로 친다 — 0%로 두면 짧은 화면이 전부 실패로 보인다.
  if (total <= viewport || total === 0) return 100;

  const seen = (window.scrollY || doc.scrollTop || 0) + viewport;
  return Math.max(0, Math.min(100, (seen / total) * 100));
}

export function EngagementBeacon() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;

    let visibleMs = 0;
    let since = document.visibilityState === "visible" ? Date.now() : 0;
    let maxScroll = scrollDepthPct();
    let sent = false;

    const accumulate = () => {
      if (since > 0) {
        visibleMs += Date.now() - since;
        since = 0;
      }
    };

    const onScroll = () => {
      const depth = scrollDepthPct();
      if (depth > maxScroll) maxScroll = depth;
    };

    const send = () => {
      if (sent) return;
      accumulate();

      const dwellSec = Math.round(visibleMs / 1000);
      if (dwellSec < MIN_REPORT_SEC) return;
      sent = true;

      const body = JSON.stringify({
        path: pathname,
        dwellSec,
        scrollPct: Math.round(maxScroll),
      });

      // ⚠ 떠나는 중이라 fetch는 취소될 수 있다. sendBeacon이 없을 때만 keepalive fetch로.
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        navigator.sendBeacon(
          "/api/engagement",
          new Blob([body], { type: "application/json" }),
        );
        return;
      }
      void fetch("/api/engagement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {
        // 집계 실패가 화면에 영향을 주지 않게 조용히 넘긴다(서버가 로그를 남긴다).
      });
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        since = Date.now();
        return;
      }
      // 숨겨지면 그때까지의 시간을 확정하고 보낸다 — 모바일은 여기서 끝나는 경우가 많다.
      send();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", send);
    window.addEventListener("scroll", onScroll, { passive: true });

    // ⚠ 경로가 바뀌면(SPA 이동) 여기서 정리되며 send()가 불린다 — 이동도 '떠남'이다.
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", send);
      window.removeEventListener("scroll", onScroll);
      send();
    };
  }, [pathname]);

  return null;
}

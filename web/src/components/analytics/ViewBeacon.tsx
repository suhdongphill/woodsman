"use client";

/**
 * 조회 비콘 — 화면이 그려진 뒤 한 번 알린다.
 *
 * ## 왜 서버에서 세지 않나
 * 서버 컴포넌트에서 세면 ① 모든 요청이 DB 쓰기만큼 느려지고 ② RSC 프리페치·크롤러까지
 * 세어 숫자가 부풀려진다. 사람이 화면을 본 시점에 브라우저가 알리는 편이 정확하다.
 *
 * ## 새로고침 중복
 * ⚠ 쿠키를 심지 않으므로 서버는 누가 눌렀는지 모른다. 대신 **같은 세션(탭)에서 같은 경로는
 *    한 번만** 보낸다. `sessionStorage`는 브라우저 안에만 있고 서버로 가지 않는다 —
 *    개인 식별 없이 새로고침 뻥튀기만 줄이는 선택이다.
 */
import { useEffect } from "react";
import { usePathname } from "next/navigation";

const SENT_PREFIX = "wm_v:";

export function ViewBeacon() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;

    try {
      const key = `${SENT_PREFIX}${pathname}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // 사생활 보호 모드 등으로 sessionStorage를 못 쓰면 중복 제거만 포기하고 그대로 보낸다.
    }

    const body = JSON.stringify({ path: pathname });

    // sendBeacon은 페이지를 떠나도 전송이 보장된다. 없으면 fetch로 떨어진다.
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon("/api/view", new Blob([body], { type: "application/json" }));
      return;
    }
    void fetch("/api/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      // 집계 실패가 화면에 영향을 주지 않게 조용히 넘긴다(서버가 로그를 남긴다).
    });
  }, [pathname]);

  return null;
}

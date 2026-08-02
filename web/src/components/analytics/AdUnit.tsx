"use client";

import { useEffect, useRef } from "react";

/**
 * AdSense 광고 유닛.
 *
 * `<ins>`를 그린 뒤 `adsbygoogle.push({})`로 채우라고 알려야 한다.
 * 클라이언트 전용이라 이 파일만 "use client"다 — 배치 판단(서버)과 분리해 둔다.
 *
 * 같은 유닛에 push를 두 번 하면 AdSense가 "already have ads in it" 오류를 낸다.
 * React가 개발 모드에서 effect를 두 번 실행하므로 ref로 한 번만 밀어 넣는다.
 */
declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export function AdUnit({ client, slot }: { client: string; slot: string }) {
  const pushed = useRef(false);

  useEffect(() => {
    if (pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle ?? []).push({});
    } catch {
      // 광고 차단기·네트워크 실패로 스크립트가 없을 수 있다. 화면은 그대로 둔다.
    }
  }, []);

  return (
    <ins
      className="adsbygoogle"
      style={{ display: "block" }}
      data-ad-client={client}
      data-ad-slot={slot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  );
}

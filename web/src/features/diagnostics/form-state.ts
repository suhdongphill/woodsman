/**
 * 자가 진단 화면의 상태 타입.
 *
 * ⚠ `"use server"` 파일은 **async 함수만** export할 수 있다. 상수·타입은 여기 둔다
 * (어기면 액션 호출이 500으로 죽는다 — 이 저장소에서 두 번 겪었다).
 */
import type { LimiterProbe } from "@/lib/beacon-selftest";

export type DiagnosticsState = {
  /** 측정한 시각(ISO). 없으면 아직 안 눌렀다. */
  ranAt?: string;
  probe?: LimiterProbe;
  /**
   * 운영 비콘 바인딩의 상태. ⚠ 여기서는 `limit()`을 **부르지 않는다** —
   * 진단하겠다고 실제 방문자의 카운터를 소모하면 안 된다. 있는지·모양이 맞는지만 본다.
   */
  beaconBinding?: { state: string; typeName?: string };
  error?: string;
};

export const emptyDiagnosticsState: DiagnosticsState = {};

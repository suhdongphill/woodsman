"use server";

/**
 * 자가 진단 서버 액션.
 *
 * ## 왜 있나
 * 2026-08-11에 속도 제한을 걸어 놓고 **막히는지 재지 않은 채** "닫았다"고 적었다.
 * 배포 후 실측에서 447건 중 0건 차단으로 뒤집혔다. 그 측정을 다시 하려면 CLI로 수백 번
 * 두드려야 했다 — 그러니 다시 안 하게 된다. **버튼 하나로 되게 만든다.**
 *
 * ⚠ `requireAdmin`을 먼저 부른다. 아무나 누를 수 있으면 이 버튼 자체가 부하 도구가 된다.
 */
import { requireAdmin } from "@/lib/session";
import {
  BEACON_LIMITER_BINDING,
  SELFTEST_LIMITER_BINDING,
  probeLimiter,
  resolveLimiter,
} from "@/lib/beacon-guard";
import { SELFTEST_CALLS } from "@/lib/beacon-selftest";
import type { DiagnosticsState } from "./form-state";

export async function probeRateLimitAction(
  _prev: DiagnosticsState,
  _formData: FormData,
): Promise<DiagnosticsState> {
  // 이 액션은 입력을 받지 않는다 — 두 인자는 `useActionState`가 요구하는 자리일 뿐이다.
  void _prev;
  void _formData;

  await requireAdmin("/admin/diagnostics");

  try {
    const beacon = await resolveLimiter(BEACON_LIMITER_BINDING);

    // ⚠ 실행마다 **새 키**를 쓴다. 같은 키를 쓰면 앞선 측정의 카운터가 남아
    //    "이미 막힌 상태"에서 시작해 결과를 잘못 읽는다.
    const probe = await probeLimiter(
      SELFTEST_LIMITER_BINDING,
      `selftest:${Date.now()}`,
      SELFTEST_CALLS,
    );

    return {
      ranAt: new Date().toISOString(),
      probe,
      beaconBinding: {
        state: beacon.kind,
        typeName: beacon.kind === "ready" || beacon.kind === "malformed" ? beacon.typeName : undefined,
      },
    };
  } catch (error) {
    console.error("[diagnostics] 속도 제한 측정 실패", error);
    return { error: "측정하지 못했습니다. 서버 로그의 [beacon]·[diagnostics] 항목을 확인하세요." };
  }
}

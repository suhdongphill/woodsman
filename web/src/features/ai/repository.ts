/**
 * AI 제공자·설정의 DB 접근.
 *
 * ## 역할 분담 (헷갈리기 쉬운 지점)
 * - **무엇을 부를 수 있나** (제공자·모델·요금) → `src/lib/ai/catalog.ts` (코드)
 * - **지금 부를 것인가** (활성 여부·월 상한·사용량) → 이 파일 (DB)
 *
 * 카탈로그를 DB에 복사해 두지 않는다. 모델 ID가 바뀌었을 때 코드는 고쳤는데
 * DB에는 옛 값이 남아 조용히 옛 모델을 부르는 사고를 막기 위해서다.
 * 두 세계는 `apiKeyEnv`로 잇는다 — 이름이 아니라 키 변수명이 안정적인 열쇠다.
 */
import { AI_PROVIDERS } from "@/lib/ai/catalog";
import type { ProviderUsage } from "@/lib/ai/routing";
import { execute, queryAll, queryOne, toBool } from "@/lib/d1";

export type AiConfigRow = {
  allowedRole: string;
  cacheTtlHours: number;
  globalMonthlyTokenCap: number;
  tokensUsedThisMonth: number;
};

/** DB를 못 읽었을 때의 안전한 기본값 — 가장 보수적인 쪽(관리자 전용). */
const FALLBACK_CONFIG: AiConfigRow = {
  allowedRole: "ADMIN",
  cacheTtlHours: 24,
  globalMonthlyTokenCap: 1_000_000,
  tokensUsedThisMonth: 0,
};

type ProviderRow = {
  apiKeyEnv: string;
  enabled: number | boolean;
  monthlyTokenCap: number | null;
  tokensUsedThisMonth: number;
};

/**
 * 제공자별 상태. 행이 없는 제공자는 **활성·상한 없음**으로 본다
 * (카탈로그에 새로 추가했는데 시드를 다시 돌리지 않은 경우).
 */
export async function loadProviderUsage(): Promise<ProviderUsage[]> {
  let rows: ProviderRow[] = [];
  try {
    rows = await queryAll<ProviderRow>(
      `SELECT apiKeyEnv, enabled, monthlyTokenCap, tokensUsedThisMonth FROM AiProvider`,
    );
  } catch (error) {
    // ⚠ 조용히 넘어가지 않는다. "설정이 비어 있음"과 "읽지 못함"은 다른 상태다.
    console.error("[ai-repo] AiProvider 조회 실패 — 카탈로그 기본값으로 동작합니다.", error);
  }

  const byEnv = new Map(rows.map((r) => [r.apiKeyEnv, r]));
  return AI_PROVIDERS.map((p) => {
    const row = byEnv.get(p.apiKeyEnv);
    return {
      providerId: p.id,
      enabled: row ? toBool(row.enabled) : true,
      tokensUsedThisMonth: row?.tokensUsedThisMonth ?? 0,
      monthlyTokenCap: row?.monthlyTokenCap ?? null,
    };
  });
}

export async function loadAiConfig(): Promise<AiConfigRow> {
  try {
    const row = await queryOne<AiConfigRow>(
      `SELECT allowedRole, cacheTtlHours, globalMonthlyTokenCap, tokensUsedThisMonth
         FROM AiConfig WHERE id = 'singleton'`,
    );
    if (!row) {
      console.error("[ai-repo] AiConfig 행이 없습니다 — 시드를 실행하세요. 기본값으로 동작합니다.");
      return FALLBACK_CONFIG;
    }
    return row;
  } catch (error) {
    console.error("[ai-repo] AiConfig 조회 실패 — 기본값으로 동작합니다.", error);
    return FALLBACK_CONFIG;
  }
}

/** 제공자 on/off. 행이 없으면 아무것도 하지 않는다(시드가 먼저다). */
export async function setProviderEnabled(apiKeyEnv: string, enabled: boolean): Promise<void> {
  await execute(`UPDATE AiProvider SET enabled = ?, updatedAt = ? WHERE apiKeyEnv = ?`, [
    enabled ? 1 : 0,
    new Date().toISOString(),
    apiKeyEnv,
  ]);
}

/**
 * 쓴 토큰을 누적한다 — **제공자별과 사이트 전체 양쪽**에.
 *
 * ⚠ 한쪽만 세면 상한이 반만 걸린다. 제공자별 상한은 한 곳의 사고를 막고, 전역 상한은
 *    제공자가 다섯일 때 청구서가 다섯 배가 되는 것을 막는다(`lib/ai/routing.ts` §6).
 * ⚠ 실패해도 호출 자체를 되돌리지 않는다. 다만 **조용히 넘어가지는 않는다** — 사용량을
 *    못 센 상태로 계속 도는 것이 상한이 없는 것과 같기 때문이다.
 */
export async function recordAiUsage(apiKeyEnv: string, tokens: number): Promise<void> {
  if (!Number.isFinite(tokens) || tokens <= 0) return;
  const now = new Date().toISOString();

  try {
    await execute(
      `UPDATE AiProvider SET tokensUsedThisMonth = tokensUsedThisMonth + ?, updatedAt = ?
        WHERE apiKeyEnv = ?`,
      [Math.round(tokens), now, apiKeyEnv],
    );
    await execute(
      `UPDATE AiConfig SET tokensUsedThisMonth = tokensUsedThisMonth + ?, updatedAt = ?
        WHERE id = 'singleton'`,
      [Math.round(tokens), now],
    );
  } catch (error) {
    console.error("[ai-repo] 사용량 기록 실패 — 상한이 헐거워집니다.", error);
  }
}

/** 월 토큰 상한. null이면 무제한 — ⚠ 유료 제공자에는 쓰지 않는다. */
export async function setProviderCap(apiKeyEnv: string, cap: number | null): Promise<void> {
  await execute(`UPDATE AiProvider SET monthlyTokenCap = ?, updatedAt = ? WHERE apiKeyEnv = ?`, [
    cap,
    new Date().toISOString(),
    apiKeyEnv,
  ]);
}


/**
 * 작업별 라우팅 정책. 행이 없는 작업은 **기본값 `cheapest`**다.
 *
 * ⚠ 못 읽으면 빈 맵을 돌려주되 로그를 남긴다 — "정책이 없다"와 "못 읽었다"는 다른 상태이고,
 *    조용히 넘어가면 유료로 돌리기로 한 작업이 무료로 돌아가는 것을 아무도 모른다.
 */
export async function loadTaskModes(): Promise<Record<string, "cheapest" | "best">> {
  try {
    const rows = await queryAll<{ task: string; mode: string }>(
      `SELECT task, mode FROM AiTaskPolicy`,
    );
    const out: Record<string, "cheapest" | "best"> = {};
    for (const row of rows) out[row.task] = row.mode === "best" ? "best" : "cheapest";
    return out;
  } catch (error) {
    console.error("[ai-repo] 작업 정책을 읽지 못했습니다 — 전부 기본값(cheapest)으로 돕니다.", error);
    return {};
  }
}

/** 한 작업의 모드를 정한다. */
export async function setTaskMode(task: string, mode: "cheapest" | "best"): Promise<void> {
  const now = new Date().toISOString();
  await execute(
    `INSERT INTO AiTaskPolicy (task, mode, updatedAt) VALUES (?, ?, ?)
     ON CONFLICT(task) DO UPDATE SET mode = excluded.mode, updatedAt = excluded.updatedAt`,
    [task, mode, now],
  );
}

/**
 * D1 접근 계층 — 얇은 타입 래퍼.
 *
 * ## 왜 Prisma를 런타임에서 뺐나
 * OpenNext로 만든 Worker 번들에 Prisma의 WASM 쿼리 엔진이 포함되지 않는다.
 * 배포는 성공하는데 첫 쿼리에서 `no such file or directory ... .wasm` 으로 죽는다.
 * (opennextjs-cloudflare #471 / prisma #23457 — 2026-08 기준 미해결)
 *
 * 우리가 실제로 쓰는 쿼리는 손에 꼽는다. ORM을 억지로 얹는 대신 D1 바인딩을 직접 쓴다.
 * 얻는 것:
 *   - 배포가 실제로 동작한다(가장 중요)
 *   - 번들이 작아지고 콜드 스타트가 빨라진다
 *   - next.config의 WASM·파일트레이싱 우회 같은 땜질이 전부 필요 없어진다
 *
 * Prisma는 **스키마 정의와 마이그레이션 생성**에만 계속 쓴다. 그건 잘하는 일이다.
 * 따라서 `prisma/schema.prisma`가 여전히 스키마의 원본이고,
 * 여기 쿼리의 컬럼명은 그 스키마를 따른다.
 *
 * ## 규칙
 * - ⚠ SQL 문자열에 값을 직접 끼워 넣지 않는다. 반드시 `?` 바인딩을 쓴다.
 * - ⚠ 조용한 폴백을 만들지 않는다. 실패는 던지고, 호출부가 로그를 남기고 판단한다.
 * - 도메인 쿼리는 이 파일이 아니라 각 기능 모듈의 repository에 둔다.
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { classifyQuotaError } from "./quota";

/**
 * D1이 결과에 함께 주는 계측값.
 * ⚠ `size_after`는 **데이터베이스의 실제 바이트 크기**다. 무료 등급 500 MB에 얼마나
 *    가까운지를 이 값으로만 알 수 있어서, `/admin/diagnostics`가 이걸 계기판으로 쓴다.
 */
export type D1Meta = {
  size_after?: number;
  rows_read?: number;
  rows_written?: number;
  duration?: number;
};

/** D1 바인딩의 최소 형태 — @cloudflare/workers-types 없이도 쓰도록 직접 좁게 정의한다. */
export type D1Statement = {
  bind: (...values: unknown[]) => D1Statement;
  first: <T>() => Promise<T | null>;
  all: <T>() => Promise<{ results: T[]; meta?: D1Meta }>;
  run: () => Promise<{ meta?: D1Meta }>;
};

export type D1 = {
  prepare: (query: string) => D1Statement;
  batch: (statements: D1Statement[]) => Promise<unknown>;
};

/**
 * ⚠ **반드시 `{ async: true }`** 로 부른다. 동기 모드는 정적 라우트·모듈 최상단에서
 *    금지돼 있어 빌드의 정적 생성 단계가 통째로 실패한다.
 */
export async function getD1(): Promise<D1> {
  const { env } = await getCloudflareContext({ async: true });
  const binding = (env as unknown as Record<string, unknown>).DB;
  if (!binding) {
    throw new Error(
      "D1 바인딩(env.DB)이 없습니다. wrangler.jsonc의 d1_databases 설정을 확인하세요. " +
        "로컬 개발이라면 npm run db:setup 을 먼저 실행하세요.",
    );
  }
  return binding as D1;
}

/**
 * 질의 실패를 **분류해서** 로그에 남기고 그대로 다시 던진다.
 *
 * ⚠ 삼키지 않는다(3장). 다만 무료 등급 한도에 닿아 죽는 것과 코드 버그로 죽는 것은
 *    증상이 똑같이 "불러오지 못했습니다"라서, 그걸 구분하지 못하면 엉뚱한 데를 뒤지게 된다.
 *    분류 결과는 `/admin/diagnostics`가 화면에서도 읽는다.
 */
function rethrowClassified(error: unknown, sql: string): never {
  const verdict = classifyQuotaError(error);
  const head = sql.trim().slice(0, 120);

  if (verdict.kind === "yes") {
    console.error(`[d1] ⚠ 한도 문제로 보입니다 — ${verdict.title}. ${verdict.action} | SQL: ${head}`, error);
  } else if (verdict.kind === "unknown") {
    console.error(`[d1] 한도 문제일 수 있습니다 — ${verdict.detail} | SQL: ${head}`, error);
  } else {
    console.error(`[d1] 질의 실패 | SQL: ${head}`, error);
  }
  throw error;
}

/** 한 행. 없으면 null. */
export async function queryOne<T>(sql: string, params: unknown[] = []): Promise<T | null> {
  try {
    const db = await getD1();
    return await db.prepare(sql).bind(...params).first<T>();
  } catch (error) {
    rethrowClassified(error, sql);
  }
}

/** 여러 행. */
export async function queryAll<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  try {
    const db = await getD1();
    const { results } = await db.prepare(sql).bind(...params).all<T>();
    return results ?? [];
  } catch (error) {
    rethrowClassified(error, sql);
  }
}

/** INSERT/UPDATE/DELETE. */
export async function execute(sql: string, params: unknown[] = []): Promise<void> {
  try {
    const db = await getD1();
    await db.prepare(sql).bind(...params).run();
  } catch (error) {
    rethrowClassified(error, sql);
  }
}

/**
 * 데이터베이스의 실제 크기(바이트)를 잰다. 재지 못하면 undefined.
 *
 * ⚠ 이 값이 무료 등급 한도(500 MB)에 얼마나 가까운지를 알려 주는 **유일한 실측치**다.
 *    D1은 아무 질의에나 `meta.size_after`를 함께 준다 — 그래서 가장 싼 질의 하나로 잰다.
 */
export async function probeD1SizeBytes(): Promise<number | undefined> {
  const db = await getD1();
  const result = await db.prepare(`SELECT 1`).run();
  return result?.meta?.size_after;
}

/**
 * SQLite는 boolean이 없어 0/1로 저장된다.
 * 스키마의 Boolean 컬럼을 읽을 때 반드시 이걸 거친다 —
 * `Boolean(0)`은 false지만 문자열 `"0"`은 true라서 조용히 뒤집힐 수 있다.
 */
export function toBool(value: unknown): boolean {
  return value === 1 || value === true || value === "1";
}

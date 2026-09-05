/**
 * 인증키 보관함 — 관리자 화면에서 넣고, 부를 때 푼다.
 *
 * ## 왜 바꿨나 (2026-09-05)
 * 키를 로컬 `.env`에만 넣고 `npm run ai:sync`로 올리는 구조였다. 내 PC 앞에 있어야만
 * 등록이 되니, 실제로는 **AI 키가 하나도 등록되지 않은 채** 기능이 놀고 있었다.
 * ⚠ 이전 지침(CLAUDE.md 6장 "AI 키를 DB에 저장하지 않는다")을 **사용자 결정으로 고쳤다.**
 *    대신 두 가지를 조건으로 걸었다 — **평문 저장 금지**, **푼 값은 화면으로 안 나감**.
 *
 * ## 읽는 순서 — DB 우선, 없으면 env
 * 관리자 화면에 넣은 값이 실제로 쓰여야 한다. env는 예비로 남긴다(DB가 비어도 사이트가 돈다).
 * ⚠ **화면이 「지금 어느 쪽을 쓰는지」를 반드시 보여준다.** 안 보이면 "등록했는데 안 먹네"가 된다.
 *
 * ## 규칙
 * - ⚠ **카탈로그에 있는 이름만** 저장한다. 폼 값으로 아무 이름이나 만들지 못하게.
 * - ⚠ 마스터 키가 없으면 **저장을 거부**한다. 평문으로 떨어지는 길을 만들지 않는다.
 * - ⚠ 한 행이 안 풀려도 나머지는 살린다. 다만 **반드시 로그로 남긴다**(CLAUDE.md 3장).
 * - ⚠ 어떤 함수도 키 값을 돌려주지 않는다 — `resolveApiEnv()`만이 값을 담아 나가고,
 *   그건 제공자를 부르는 자리로만 간다.
 */
import { AI_PROVIDERS } from "@/lib/ai/catalog";
import type { EnvSource } from "@/lib/env";
import { execute, queryAll } from "@/lib/d1";
import { readRuntimeEnvMany } from "@/lib/runtime-env";
import { MASTER_MIN_LENGTH, open, seal, sealFingerprint } from "@/lib/secret-box";

/** ECOS는 AI 제공자가 아니지만 성격이 같다 — 바깥 서비스를 부르는 열쇠다. */
export const EXTRA_KEY_NAMES = ["ECOS_API_KEY"] as const;

/** 보관함이 다루는 이름 전부. ⚠ 이 목록 밖의 이름은 저장하지 않는다. */
export function storedKeyNames(): string[] {
  return [...AI_PROVIDERS.map((p) => p.apiKeyEnv), ...EXTRA_KEY_NAMES];
}

export function isStoredKeyName(name: string): boolean {
  return storedKeyNames().includes(name);
}

/**
 * 마스터 키의 출처.
 * ⚠ `AUTH_SECRET`에서 파생하는 것은 **폴백이지 기본이 아니다.** 세션 키를 바꾸면 저장된
 *    인증키를 못 풀게 되므로, 화면이 이 상태를 그대로 표시한다(조용한 폴백 금지).
 */
export type MasterKeyInfo =
  | { ok: true; material: string; source: "KEY_ENCRYPTION_KEY" | "AUTH_SECRET" }
  | { ok: false; reason: string };

/** 순수 판단 — 어떤 값을 마스터로 쓸 것인가. */
export function chooseMasterKey(env: EnvSource): MasterKeyInfo {
  const dedicated = (env.KEY_ENCRYPTION_KEY ?? "").trim();
  if (dedicated.length >= MASTER_MIN_LENGTH) {
    return { ok: true, material: dedicated, source: "KEY_ENCRYPTION_KEY" };
  }
  if (dedicated.length > 0) {
    return { ok: false, reason: `KEY_ENCRYPTION_KEY가 ${MASTER_MIN_LENGTH}자보다 짧습니다` };
  }

  const auth = (env.AUTH_SECRET ?? "").trim();
  if (auth.length >= MASTER_MIN_LENGTH) {
    return { ok: true, material: auth, source: "AUTH_SECRET" };
  }

  return {
    ok: false,
    reason: "마스터 키가 없습니다 — KEY_ENCRYPTION_KEY를 등록하세요(32자 이상)",
  };
}

async function masterKey(): Promise<MasterKeyInfo> {
  const env = await readRuntimeEnvMany(["KEY_ENCRYPTION_KEY", "AUTH_SECRET"]);
  return chooseMasterKey(env);
}

/** 화면이 쓰는 마스터 키 상태. ⚠ 값은 담기지 않는다. */
export async function masterKeyStatus(): Promise<
  { ok: true; source: "KEY_ENCRYPTION_KEY" | "AUTH_SECRET" } | { ok: false; reason: string }
> {
  const info = await masterKey();
  return info.ok ? { ok: true, source: info.source } : info;
}

type Row = { name: string; cipher: string; updatedBy: string; updatedAt: string };

async function loadRows(): Promise<Row[]> {
  try {
    return await queryAll<Row>(
      `SELECT name, cipher, updatedBy, updatedAt FROM ApiCredential ORDER BY name`,
    );
  } catch (error) {
    // ⚠ 조용히 빈 목록으로 넘기지 않는다. "등록된 게 없다"와 "못 읽었다"는 다른 상태다.
    console.error("[credentials] 보관함을 읽지 못했습니다", error);
    return [];
  }
}

/**
 * 저장된 키를 풀어 `{이름: 값}`으로 돌려준다.
 * ⚠ 이 함수의 결과는 **모델·외부 API를 부르는 자리로만** 간다.
 */
export async function loadStoredKeys(): Promise<EnvSource> {
  const rows = await loadRows();
  if (rows.length === 0) return {};

  const info = await masterKey();
  if (!info.ok) {
    console.error(`[credentials] ${rows.length}건이 저장돼 있으나 풀 수 없습니다 — ${info.reason}`);
    return {};
  }

  const out: EnvSource = {};
  for (const row of rows) {
    try {
      out[row.name] = await open(row.cipher, row.name, info.material);
    } catch (error) {
      // ⚠ 하나가 안 풀려도 나머지는 산다. 다만 어떤 이름이 안 풀렸는지는 남긴다.
      console.error(`[credentials] ${row.name}을(를) 풀지 못했습니다`, error);
    }
  }
  return out;
}

/**
 * 지금 이 요청에서 쓸 키 모음 — **DB 우선, 없으면 env.**
 * ⚠ 순서를 바꾸면 관리자 화면에 넣은 값이 조용히 무시된다.
 */
export async function resolveApiEnv(): Promise<EnvSource> {
  const names = storedKeyNames();
  const [fromEnv, fromDb] = await Promise.all([readRuntimeEnvMany(names), loadStoredKeys()]);
  return { ...fromEnv, ...fromDb };
}

/** 화면용 상태 한 줄. ⚠ 키 값은 없다 — 출처·시각·지문뿐이다. */
export type CredentialStatus = {
  name: string;
  source: "DB" | "ENV" | "NONE";
  updatedAt?: string;
  updatedBy?: string;
  /** 암호문의 해시 앞 8자 — 행이 바뀌었는지 눈으로 확인하는 용도 */
  fingerprint?: string;
};

export async function credentialStatuses(): Promise<CredentialStatus[]> {
  const names = storedKeyNames();
  const [rows, fromEnv] = await Promise.all([loadRows(), readRuntimeEnvMany(names)]);
  const byName = new Map(rows.map((r) => [r.name, r]));

  const out: CredentialStatus[] = [];
  for (const name of names) {
    const row = byName.get(name);
    if (row) {
      out.push({
        name,
        source: "DB",
        updatedAt: row.updatedAt,
        updatedBy: row.updatedBy,
        fingerprint: await sealFingerprint(row.cipher),
      });
      continue;
    }
    out.push({ name, source: fromEnv[name] ? "ENV" : "NONE" });
  }
  return out;
}

/** 저장한다. ⚠ 실패 사유에 키 값을 넣지 않는다. */
export async function saveApiKey(
  name: string,
  plain: string,
  actor: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isStoredKeyName(name)) return { ok: false, message: "알 수 없는 항목입니다." };

  const value = plain.trim();
  if (value.length < 8) return { ok: false, message: "키가 너무 짧습니다. 다시 확인하세요." };
  // ⚠ 붙여넣기 사고를 거른다 — 따옴표째, 또는 `NAME=값` 통째로 붙이는 일이 실제로 잦다.
  if (/\s/.test(value)) return { ok: false, message: "키에 공백이 섞여 있습니다." };

  const info = await masterKey();
  if (!info.ok) return { ok: false, message: info.reason };

  try {
    const cipher = await seal(value, name, info.material);
    const now = new Date().toISOString();
    await execute(
      `INSERT INTO ApiCredential (name, cipher, updatedBy, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(name) DO UPDATE SET cipher = excluded.cipher,
                                       updatedBy = excluded.updatedBy,
                                       updatedAt = excluded.updatedAt`,
      [name, cipher, actor, now, now],
    );
    return { ok: true };
  } catch (error) {
    console.error(`[credentials] ${name} 저장 실패`, error);
    return { ok: false, message: "저장하지 못했습니다. 잠시 후 다시 시도하세요." };
  }
}

/** 지운다 — env에 값이 있으면 다시 그쪽을 쓰게 된다. */
export async function deleteApiKey(name: string): Promise<void> {
  if (!isStoredKeyName(name)) return;
  await execute(`DELETE FROM ApiCredential WHERE name = ?`, [name]);
}

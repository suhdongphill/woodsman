/**
 * 관리자 화면에서 입력한 AI 키를 **로컬 `.env` 파일에 직접 써 준다.**
 *
 * ⚠ 서버 전용. 클라이언트 컴포넌트에서 import 하지 않는다(`node:*`를 쓴다).
 *
 * ## 왜 로컬에서만 되나 (제약이 아니라 물리)
 * 배포본은 Cloudflare Workers에서 돈다. 거기엔 **파일 시스템이 없다.**
 * 컨테이너도 아니고 디스크도 없어서 `.env`라는 파일 자체가 존재할 수 없다.
 * 그래서 이 기능은 `next dev`로 내 PC에서 띄웠을 때만 동작한다.
 *
 * 흐름은 이렇게 된다:
 *
 *   내 PC에서 `npm run dev` → /admin/ai 에서 키 입력 → 이 모듈이 `.env`에 기록
 *                                                        ↓
 *                                             `npm run ai:sync` → 배포본에 반영
 *
 * ⚠ 키 값을 로그로 남기지 않는다. 실패해도 값을 에러 메시지에 넣지 않는다.
 * ⚠ DB에 저장하지 않는다. `.env`가 유일한 저장소다.
 */
import { join } from "node:path";
import { allApiKeyEnvNames } from "@/lib/ai/catalog";
import { isPlausibleKey, upsertEnvLine } from "@/lib/env-file";

/** 이 실행 환경이 `.env`를 쓸 수 있는가 — 화면이 입력창을 보일지 결정한다. */
export function canWriteEnvFile(): boolean {
  // Workers에는 process.versions.node가 없거나 파일 접근이 막혀 있다.
  // 개발 모드가 아니면 아예 시도하지 않는다.
  return process.env.NODE_ENV !== "production";
}

export type SaveKeyResult = { ok: true; name: string } | { ok: false; message: string };

export async function saveAiKeyToEnvFile(name: string, value: string): Promise<SaveKeyResult> {
  if (!canWriteEnvFile()) {
    return {
      ok: false,
      message:
        "배포된 사이트에서는 .env 파일을 쓸 수 없습니다(Workers에는 파일 시스템이 없습니다). 내 PC에서 `npm run dev`로 띄운 뒤 등록하고, `npm run ai:sync`로 올리세요.",
    };
  }
  if (!allApiKeyEnvNames().includes(name)) {
    return { ok: false, message: `알 수 없는 제공자입니다: ${name}` };
  }
  if (!isPlausibleKey(value)) {
    // ⚠ 입력값 자체를 메시지에 넣지 않는다.
    return { ok: false, message: "키 형식이 올바르지 않습니다(16자 이상, 공백·줄바꿈 없이)." };
  }

  const envPath = join(process.cwd(), ".env");

  try {
    const { readFile, writeFile } = await import("node:fs/promises");

    let current = "";
    try {
      current = await readFile(envPath, "utf8");
    } catch {
      // .env가 아직 없으면 새로 만든다.
    }

    await writeFile(envPath, upsertEnvLine(current, name, value), "utf8");
    return { ok: true, name };
  } catch (error) {
    // ⚠ 조용히 성공한 척하지 않는다. 다만 값은 절대 남기지 않는다.
    console.error(`[ai-env] ${name} 을(를) .env에 쓰지 못했습니다.`, error);
    return { ok: false, message: `.env 파일에 쓰지 못했습니다. 파일 권한을 확인하세요.` };
  }
}

import { describe, expect, it } from "vitest";
import { chooseMasterKey, isStoredKeyName, storedKeyNames } from "./credentials";
import { MASTER_MIN_LENGTH } from "@/lib/secret-box";

const LONG = "x".repeat(MASTER_MIN_LENGTH);

describe("마스터 키 고르기", () => {
  it("전용 키가 있으면 그것을 쓴다", () => {
    const info = chooseMasterKey({ KEY_ENCRYPTION_KEY: LONG, AUTH_SECRET: LONG });
    expect(info).toEqual({ ok: true, material: LONG, source: "KEY_ENCRYPTION_KEY" });
  });

  /**
   * ⚠ 폴백이지 기본이 아니다. 세션 키를 바꾸면 저장된 인증키를 못 풀게 되므로,
   *    화면이 이 상태(`source`)를 그대로 표시한다 — 조용한 폴백을 만들지 않는다.
   */
  it("⚠ 전용 키가 없으면 AUTH_SECRET에서 파생하고, 그 사실을 밝힌다", () => {
    const info = chooseMasterKey({ AUTH_SECRET: LONG });
    expect(info).toEqual({ ok: true, material: LONG, source: "AUTH_SECRET" });
  });

  /** ⚠ "짧으니까 AUTH_SECRET으로 넘어가자"가 아니다 — 설정이 틀렸다는 사실을 말한다. */
  it("⚠ 전용 키가 짧으면 조용히 넘어가지 않고 거부한다", () => {
    const info = chooseMasterKey({ KEY_ENCRYPTION_KEY: "짧다", AUTH_SECRET: LONG });
    expect(info.ok).toBe(false);
    if (!info.ok) expect(info.reason).toContain("KEY_ENCRYPTION_KEY");
  });

  it("둘 다 없으면 저장할 수 없다고 말한다", () => {
    const info = chooseMasterKey({});
    expect(info.ok).toBe(false);
    if (!info.ok) expect(info.reason).toContain("KEY_ENCRYPTION_KEY");
  });
});

describe("보관함이 다루는 이름", () => {
  /** ⚠ 폼 값으로 아무 이름이나 만들지 못하게 한다. */
  it("카탈로그의 AI 키와 ECOS만 허용한다", () => {
    expect(isStoredKeyName("GROQ_API_KEY")).toBe(true);
    expect(isStoredKeyName("ECOS_API_KEY")).toBe(true);
    expect(isStoredKeyName("AUTH_SECRET")).toBe(false);
    expect(isStoredKeyName("../../etc/passwd")).toBe(false);
  });

  /**
   * ⚠ 세션·수집 시크릿은 보관함에 넣지 않는다. 앱이 자기 자신을 여는 열쇠라
   *    DB에 두면 순환이 되고, 마스터 키를 못 읽는 순간 로그인까지 같이 죽는다.
   */
  it("⚠ AUTH_SECRET·CRON_SECRET은 목록에 없다", () => {
    const names = storedKeyNames();
    expect(names).not.toContain("AUTH_SECRET");
    expect(names).not.toContain("CRON_SECRET");
    expect(names).not.toContain("KEY_ENCRYPTION_KEY");
  });
});

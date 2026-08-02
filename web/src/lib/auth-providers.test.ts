import { describe, expect, it } from "vitest";
import { enabledSocialProviders, isSocialProviderConfigured } from "./auth-providers";

describe("소셜 로그인 가용성", () => {
  it("ID와 SECRET이 둘 다 있어야 사용 가능으로 본다", () => {
    const both = { AUTH_GOOGLE_ID: "id", AUTH_GOOGLE_SECRET: "secret" };
    expect(isSocialProviderConfigured("google", both)).toBe(true);
    expect(isSocialProviderConfigured("google", { AUTH_GOOGLE_ID: "id" })).toBe(false);
    expect(isSocialProviderConfigured("google", { AUTH_GOOGLE_SECRET: "secret" })).toBe(false);
    expect(isSocialProviderConfigured("google", {})).toBe(false);
  });

  it("공백만 있는 값은 없는 것으로 본다", () => {
    expect(
      isSocialProviderConfigured("kakao", { AUTH_KAKAO_ID: "  ", AUTH_KAKAO_SECRET: "s" }),
    ).toBe(false);
  });

  it("키가 없으면 버튼 목록이 비어 있다", () => {
    expect(enabledSocialProviders({})).toEqual([]);
  });

  it("설정된 것만 목록에 담고, 키 값은 절대 포함하지 않는다", () => {
    const list = enabledSocialProviders({
      AUTH_KAKAO_ID: "kid",
      AUTH_KAKAO_SECRET: "ksecret",
    });
    expect(list.map((p) => p.id)).toEqual(["kakao"]);
    expect(JSON.stringify(list)).not.toContain("ksecret");
    expect(JSON.stringify(list)).not.toContain("kid");
  });
});

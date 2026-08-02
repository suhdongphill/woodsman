import { describe, expect, it } from "vitest";
import { hasEnvKey, parseServerEnv } from "./env";

const valid = {
  DATABASE_URL: "file:./dev.db",
  AUTH_SECRET: "a".repeat(48),
  ADMIN_EMAIL: "admin@woodsman.local",
  ADMIN_PASSWORD: "correct-horse-battery",
};

describe("parseServerEnv", () => {
  it("필수 값이 갖춰지면 통과한다", () => {
    const env = parseServerEnv({ ...valid });
    expect(env.ADMIN_EMAIL).toBe("admin@woodsman.local");
  });

  it("AUTH_SECRET이 짧으면 거부한다", () => {
    expect(() =>
      parseServerEnv({ ...valid, AUTH_SECRET: "short" }),
    ).toThrow(/AUTH_SECRET/);
  });

  it("ADMIN_PASSWORD가 8자 미만이면 거부한다", () => {
    expect(() =>
      parseServerEnv({ ...valid, ADMIN_PASSWORD: "1234" }),
    ).toThrow(/ADMIN_PASSWORD/);
  });

  it("ADMIN_EMAIL 형식을 검증한다", () => {
    expect(() =>
      parseServerEnv({ ...valid, ADMIN_EMAIL: "not-an-email" }),
    ).toThrow(/ADMIN_EMAIL/);
  });

  it("선택 키는 없어도 통과하고 빈 문자열은 undefined가 된다", () => {
    const env = parseServerEnv({ ...valid, ANTHROPIC_API_KEY: "" });
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.GROQ_API_KEY).toBeUndefined();
  });
});

describe("hasEnvKey", () => {
  it("값이 있을 때만 true", () => {
    const source = { A: "value", B: "", C: "   " };
    expect(hasEnvKey("A", source)).toBe(true);
    expect(hasEnvKey("B", source)).toBe(false);
    expect(hasEnvKey("C", source)).toBe(false);
    expect(hasEnvKey("MISSING", source)).toBe(false);
  });
});

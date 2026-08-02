import { describe, expect, it } from "vitest";
import { firstIssueMessage, loginSchema, registerSchema } from "./schema";

const validRegister = {
  name: "woodsman",
  email: "Me@Example.com",
  password: "correct-horse",
  agree: true,
};

describe("loginSchema", () => {
  it("이메일을 소문자로 정규화한다", () => {
    const parsed = loginSchema.parse({ email: " Me@Example.COM ", password: "x" });
    expect(parsed.email).toBe("me@example.com");
  });

  it("로그인은 비밀번호 길이를 따지지 않는다(기존 계정 보호)", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "1" }).success).toBe(true);
  });

  it("빈 값은 거부한다", () => {
    expect(loginSchema.safeParse({ email: "", password: "x" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a@b.com", password: "" }).success).toBe(false);
  });
});

describe("registerSchema", () => {
  it("정상 입력을 통과시키고 이메일을 소문자로 만든다", () => {
    const parsed = registerSchema.parse(validRegister);
    expect(parsed.email).toBe("me@example.com");
    expect(parsed.name).toBe("woodsman");
  });

  it("비밀번호 8자 미만을 거부한다", () => {
    const r = registerSchema.safeParse({ ...validRegister, password: "1234567" });
    expect(r.success).toBe(false);
    if (!r.success) expect(firstIssueMessage(r.error)).toMatch(/8자/);
  });

  it("bcrypt가 잘라내는 72자 초과 비밀번호를 미리 막는다", () => {
    const r = registerSchema.safeParse({ ...validRegister, password: "a".repeat(73) });
    expect(r.success).toBe(false);
  });

  it("동의하지 않으면 거부한다", () => {
    const r = registerSchema.safeParse({ ...validRegister, agree: false });
    expect(r.success).toBe(false);
    if (!r.success) expect(firstIssueMessage(r.error)).toMatch(/동의/);
  });

  it("닉네임 길이 범위를 지킨다", () => {
    expect(registerSchema.safeParse({ ...validRegister, name: "a" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...validRegister, name: "가".repeat(21) }).success).toBe(
      false,
    );
  });

  it("role은 스키마에 없어 폼으로 승격할 수 없다", () => {
    const parsed = registerSchema.parse({ ...validRegister, role: "ADMIN" });
    expect(parsed).not.toHaveProperty("role");
  });
});

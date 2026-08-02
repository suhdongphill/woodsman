/**
 * Prisma 스키마 정책 테스트.
 * SQLite(로컬) / Cloudflare D1(운영) 호환성과 요구 모델 존재 여부를 지킨다.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const raw = readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf8");
/** 주석(// · ///)은 실제 스키마 정의가 아니므로 제외하고 검사한다 */
const schema = raw.replace(/^\s*\/\/.*$/gm, "");

const REQUIRED_MODELS = [
  "User",
  "Account",
  "Session",
  "VerificationToken",
  "ModelHolding",
  "Rebalance",
  "Post",
  "Comment",
  "SiteConfig",
  "AiProvider",
  "AiConfig",
  "AiCache",
  "Feed",
  "Portfolio",
  "Holding",
];

describe("Prisma 스키마", () => {
  it("개발요구서의 모델을 모두 정의한다", () => {
    for (const m of REQUIRED_MODELS) {
      expect(schema).toMatch(new RegExp(`^model ${m} \\{`, "m"));
    }
  });

  it("D1 비호환 문법(enum · @db.Text)을 쓰지 않는다", () => {
    expect(schema).not.toMatch(/^enum /m);
    expect(schema).not.toContain("@db.Text");
  });

  it("datasource는 sqlite다", () => {
    expect(schema).toMatch(/provider\s*=\s*"sqlite"/);
  });

  it("AiProvider는 키 값이 아니라 env 변수명을 저장한다", () => {
    const block = schema.split("model AiProvider {")[1].split("}")[0];
    expect(block).toContain("apiKeyEnv");
    expect(block).not.toMatch(/apiKey\s+String/);
  });

  it("댓글 정책 필드가 존재한다", () => {
    expect(schema).toContain("commentsEnabled");
    expect(schema).toContain("commentsGloballyEnabled");
    expect(schema).toContain("requireLoginToComment");
    expect(schema).toContain("moderationOn");
  });

  it("비밀번호는 해시 컬럼으로만 저장한다", () => {
    expect(schema).toContain("passwordHash");
    expect(schema).not.toMatch(/^\s*password\s+String/m);
  });
});

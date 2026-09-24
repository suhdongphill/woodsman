/**
 * ⚠ 워커가 저장하는 run에 **커밋이 남는가.** 없으면 설정을 바꾼 뒤 옛 run을 되살릴 수 없다.
 */
import { describe, it, expect } from "vitest";
import { buildGitSha } from "./build-sha";

describe("빌드 커밋", () => {
  it("CI의 40자리를 CLI와 같은 7자리로 줄인다 — 같은 run을 두 모양으로 적지 않는다", () => {
    expect(buildGitSha("df75d94a1b2c3d4e5f60718293a4b5c6d7e8f901")).toBe("df75d94");
  });

  it("로컬의 짧은 sha는 그대로다", () => {
    expect(buildGitSha("df75d94")).toBe("df75d94");
  });

  it("⚠ 없으면 null이다 — 빈 문자열을 커밋처럼 저장하지 않는다", () => {
    expect(buildGitSha(undefined)).toBeNull();
    expect(buildGitSha("")).toBeNull();
  });

  it("⚠ 커밋 모양이 아니면 null이다 — 엉뚱한 값이 체크아웃 안내에 나가면 안 된다", () => {
    expect(buildGitSha("unknown")).toBeNull();
    expect(buildGitSha("abc")).toBeNull();
  });
});

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  SELFTEST_CALLS,
  SELFTEST_LIMIT,
  judgeProbe,
  type LimiterProbe,
} from "./beacon-selftest";

const ready = (over: Partial<LimiterProbe> = {}): LimiterProbe => ({
  binding: "SELFTEST_LIMITER",
  state: "ready",
  typeName: "RateLimit",
  calls: 20,
  blocked: 10,
  firstResult: '{"success":true}',
  ...over,
});

describe("속도 제한 자가 진단 판정", () => {
  it("상한을 넘겨 불렀고 일부가 차단되면 '막는다'", () => {
    expect(judgeProbe(ready(), 10).level).toBe("ok");
  });

  it("⚠ 상한을 넘겼는데 하나도 안 막히면 실패로 본다 — 8/11에 겪은 그 증상이다", () => {
    const verdict = judgeProbe(ready({ blocked: 0 }), 10);
    expect(verdict.level).toBe("fail");
    expect(verdict.detail).toContain("한 번도 차단되지 않았습니다");
  });

  it("⚠ 상한보다 적게 불렀으면 판정하지 않는다 — 거짓 경보를 만들지 않는다", () => {
    const verdict = judgeProbe(ready({ calls: 8, blocked: 0 }), 10);
    expect(verdict.level).toBe("unknown");
  });

  it("경계: 정확히 상한만큼 부른 것도 판정하지 않는다", () => {
    expect(judgeProbe(ready({ calls: 10, blocked: 0 }), 10).level).toBe("unknown");
  });

  it("바인딩이 없으면 '실패'가 아니라 '모름'이다 — 로컬 개발이 정상 상황이다", () => {
    const verdict = judgeProbe(ready({ state: "absent", calls: 0, blocked: 0 }), 10);
    expect(verdict.level).toBe("unknown");
    expect(verdict.detail).toContain("SELFTEST_LIMITER");
  });

  it("모양이 다른 바인딩은 실패로 본다", () => {
    const verdict = judgeProbe(ready({ state: "malformed", typeName: "Object" }), 10);
    expect(verdict.level).toBe("fail");
    expect(verdict.detail).toContain("Object");
  });

  it("context를 못 읽은 것과 바인딩이 없는 것을 구분한다", () => {
    const verdict = judgeProbe(ready({ state: "unavailable", detail: "boom" }), 10);
    expect(verdict.headline).toContain("context");
  });

  it("호출 중 예외가 났으면 그대로 드러낸다", () => {
    expect(judgeProbe(ready({ error: "TypeError: x" }), 10).level).toBe("fail");
  });
});

/**
 * ⚠ 상수를 코드와 배포 설정 **두 곳**에 적을 수밖에 없는 자리다(Worker 런타임은
 * wrangler 설정을 읽지 못한다). 그래서 사람이 기억하는 대신 여기서 대조한다.
 */
describe("⚠ wrangler.jsonc의 상한과 어긋나면 여기서 깨진다", () => {
  const raw = readFileSync(fileURLToPath(new URL("../../wrangler.jsonc", import.meta.url)), "utf8");
  // JSONC → JSON. 블록 주석을 먼저 지우고, 줄 시작의 `//` 주석만 지운다
  // (문자열 안의 `https://`를 건드리지 않기 위해서다).
  const config = JSON.parse(
    raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, ""),
  ) as { ratelimits?: { name: string; simple: { limit: number; period: number } }[] };

  const selftest = config.ratelimits?.find((r) => r.name === "SELFTEST_LIMITER");

  it("진단 전용 바인딩이 설정에 있다", () => {
    expect(selftest, "wrangler.jsonc에 SELFTEST_LIMITER가 없습니다").toBeDefined();
  });

  it("코드의 SELFTEST_LIMIT이 설정의 상한과 같다", () => {
    expect(selftest?.simple.limit).toBe(SELFTEST_LIMIT);
  });

  it("⚠ 호출 횟수가 상한보다 크다 — 아니면 진단이 영원히 '판정 불가'만 낸다", () => {
    expect(SELFTEST_CALLS).toBeGreaterThan(SELFTEST_LIMIT);
  });

  it("⚠ period는 10 또는 60만 허용된다(Cloudflare 제약)", () => {
    for (const rule of config.ratelimits ?? []) {
      expect([10, 60], rule.name).toContain(rule.simple.period);
    }
  });

  it("운영 비콘 바인딩은 그대로 있다 — 진단용이 운영용을 대체한 게 아니다", () => {
    expect(config.ratelimits?.some((r) => r.name === "BEACON_LIMITER")).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import {
  CLOUDFLARE_LIMITS,
  CLOUDFLARE_LINKS,
  D1_SIZE_LIMIT,
  LIMITS_CHECKED_AT,
  classifyQuotaError,
  formatBytes,
  gaugeD1,
} from "./quota";

describe("한도표", () => {
  it("우리가 실제로 쓰는 자원만 적혀 있고 증상이 붙어 있다", () => {
    expect(CLOUDFLARE_LIMITS.length).toBeGreaterThan(0);
    for (const row of CLOUDFLARE_LIMITS) {
      expect(row.free, row.key).not.toBe("");
      expect(row.paid, row.key).not.toBe("");
      // ⚠ "한도가 얼마다"만 적으면 닿았을 때 무슨 일이 나는지 모른다.
      expect(row.symptom, row.key).not.toBe("");
    }
  });

  it("⚠ 확인 날짜가 있다 — 오래된 숫자를 확정처럼 보이지 않게", () => {
    expect(LIMITS_CHECKED_AT).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("⚠ 대시보드 링크에 계정 ID를 박지 않는다", () => {
    for (const url of Object.values(CLOUDFLARE_LINKS)) {
      expect(url).toMatch(/^https:\/\//);
      // 32자리 hex(계정 ID)가 들어 있으면 안 된다.
      expect(url).not.toMatch(/[0-9a-f]{32}/);
    }
    expect(CLOUDFLARE_LINKS.billing).toContain("/:account/");
  });
});

describe("D1 사용량 계기", () => {
  it("바이트를 사람이 읽는 단위로", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(18_624_512)).toBe("17.8 MB");
    expect(formatBytes(-1)).toBe("—");
  });

  it("무료 한도 대비 비율을 낸다", () => {
    const g = gaugeD1(D1_SIZE_LIMIT.free / 2, "free");
    expect(g.pct).toBe(50);
    expect(g.level).toBe("ok");
  });

  it("⚠ 100%가 아니라 70%에서 경고한다 — 100%면 이미 쓰기가 실패한 뒤다", () => {
    expect(gaugeD1(D1_SIZE_LIMIT.free * 0.71).level).toBe("warn");
    expect(gaugeD1(D1_SIZE_LIMIT.free * 0.69).level).toBe("ok");
    expect(gaugeD1(D1_SIZE_LIMIT.free * 0.95).level).toBe("critical");
  });

  it("유료로 바꾸면 같은 사용량이 여유로워진다", () => {
    const used = D1_SIZE_LIMIT.free * 0.95;
    expect(gaugeD1(used, "free").level).toBe("critical");
    expect(gaugeD1(used, "paid").level).toBe("ok");
  });
});

describe("비용·한도 에러 분류", () => {
  it("D1 저장 용량", () => {
    const v = classifyQuotaError(new Error("D1_ERROR: database or disk is full"));
    expect(v.kind).toBe("yes");
    expect(v.resource).toBe("d1-db-size");
    expect(v.action).toContain("유료");
  });

  it("호출당 쿼리 수", () => {
    const v = classifyQuotaError("Too many SQL statements in one invocation");
    expect(v.resource).toBe("d1-queries-per-invocation");
    expect(v.action).toContain("batch()");
  });

  it("하루 행 한도", () => {
    expect(classifyQuotaError("rows written limit exceeded").resource).toBe("d1-rows-written");
  });

  it("Worker 하루 요청 한도(1027)", () => {
    expect(classifyQuotaError("Error 1027: daily request limit").resource).toBe("worker-requests");
  });

  it("CPU 시간", () => {
    expect(classifyQuotaError("Worker exceeded resource limits").resource).toBe("worker-cpu");
  });

  it("⚠ 한도 같은데 특정 못 하면 '아니다'가 아니라 '모름'이다", () => {
    const v = classifyQuotaError(new Error("429 Too Many Requests"));
    expect(v.kind).toBe("unknown");
    expect(v.kind).not.toBe("no");
  });

  it("한도와 무관한 에러는 그렇다고 말한다", () => {
    const v = classifyQuotaError(new Error("no such column: foo"));
    expect(v.kind).toBe("no");
    expect(v.detail).toContain("no such column");
  });

  it("Error가 아닌 값도 다룬다 — 던져지는 것이 항상 Error는 아니다", () => {
    expect(classifyQuotaError({ code: "boom" }).kind).toBe("no");
    expect(classifyQuotaError(undefined).kind).toBe("no");
  });

  it("원문을 지우지 않는다 — 분류가 틀렸을 때 사람이 원문을 봐야 한다", () => {
    expect(classifyQuotaError(new Error("database is full")).detail).toContain("database is full");
  });
});

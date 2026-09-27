import { describe, expect, it } from "vitest";
import {
  CLOUDFLARE_LIMITS,
  CLOUDFLARE_LINKS,
  CURRENT_PLAN,
  D1_MAX_COMPOUND_SELECT,
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
      // ⚠ 지금 한도를 넘으려면 무엇을 하나 — 없으면 벽 앞에서 멈춘다.
      expect(row.next, row.key).not.toBe("");
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
    expect(gaugeD1(D1_SIZE_LIMIT.free * 0.71, "free").level).toBe("warn");
    expect(gaugeD1(D1_SIZE_LIMIT.free * 0.69, "free").level).toBe("ok");
    expect(gaugeD1(D1_SIZE_LIMIT.free * 0.95, "free").level).toBe("critical");
  });

  it("기본은 지금 요금제(유료 10 GB)로 잰다 — 2026-09-27 전환", () => {
    expect(CURRENT_PLAN).toBe("paid");
    expect(gaugeD1(D1_SIZE_LIMIT.paid * 0.71).level).toBe("warn");
    // ⚠ 유료 위험 문구는 「요금제를 올려라」가 아니다 — 10 GB는 더 못 올린다.
    expect(gaugeD1(D1_SIZE_LIMIT.paid * 0.95).text).toContain("더 올릴 수 없습니다");
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
    // ⚠ 유료 10 GB는 올릴 수 없다 — 요금제를 올리라고 하면 안 된다.
    expect(v.action).toContain("나눈다");
  });

  it("공식 문구 — Exceeded maximum DB size", () => {
    expect(classifyQuotaError("D1_ERROR: Exceeded maximum DB size.").resource).toBe("d1-db-size");
  });

  it("공식 문구 — 무료 하루 행 한도(2026-09-01부터 실제로 막힘)", () => {
    const v = classifyQuotaError(
      "Your account has exceeded D1's free tier daily row read limit. Upgrade to a paid plan or wait until tomorrow (midnight UTC) to continue.",
    );
    expect(v.resource).toBe("d1-rows-written");
    // 유료로 올린 뒤에 이 에러가 나면 전환이 안 먹은 것이다.
    expect(v.action).toContain("Workers Paid");
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

describe("⚠ 한도처럼 들리지만 코드 문제인 것", () => {
  /**
   * 2026-09-08 사고. `/admin/diagnostics`의 사용량 카드가 표 9개를 `UNION ALL`로 세다가
   * D1의 5항 한도에 걸렸는데, 에러 문구의 "too many"가 일반 그물에 잡혀
   * 화면이 **「한도 문제일 수 있습니다 → 대시보드에서 확인하세요」**라고 말했다.
   * ⚠ 요금제를 올려도 안 풀리는 것을 한도라고 부르면 계기가 아니라 소음이 된다.
   */
  const REAL = "Error: D1_ERROR: too many terms in compound SELECT: SQLITE_ERROR";

  it("복합 SELECT 항 초과는 한도 문제가 **아니라고** 말한다", () => {
    const v = classifyQuotaError(new Error(REAL));
    expect(v.kind).toBe("no");
    expect(v.resource).toBeUndefined();
  });

  it("요금제를 올려도 안 풀린다는 것을 말한다", () => {
    const v = classifyQuotaError(REAL);
    expect(v.detail).toContain("요금제를 올려도 풀리지 않습니다");
    expect(v.detail).toContain(String(D1_MAX_COMPOUND_SELECT));
    // ⚠ 대시보드로 보내면 안 된다 — 거기엔 아무것도 없다.
    expect(v.action).not.toContain("대시보드");
  });

  it("⚠ 진짜 한도 에러는 여전히 한도라고 말한다", () => {
    expect(classifyQuotaError("Too many SQL statements in one invocation").kind).toBe("yes");
    expect(classifyQuotaError("D1_ERROR: database or disk is full").kind).toBe("yes");
  });
});

describe("D1 복합 SELECT 상한", () => {
  it("⚠ SQLite 기본값(500)이 아니라 실측한 5다", () => {
    expect(D1_MAX_COMPOUND_SELECT).toBe(5);
  });
});

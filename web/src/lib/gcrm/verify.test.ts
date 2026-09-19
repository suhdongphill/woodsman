/**
 * GCRM v2 — 재현성 검증 테스트 (단계 8).
 *
 * ★ 「이게 통과하지 못하면 **재현 가능**이라고 말할 수 없다」 —
 * 그래서 이 테스트는 **통과하는 경우만큼 실패하는 경우**를 확인한다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { compareRun, verdictLine, STORE_DECIMALS, type StoredForVerify } from "./verify";
import type { PipelineResult } from "./pipeline";

const HASH = "abc123def456";

/** 재계산 결과의 최소 형태. 대조에 쓰는 칸만 채운다. */
function recomputed(over: Partial<PipelineResult> = {}): PipelineResult {
  return {
    asOf: "2026-09-19",
    indicators: [],
    pillars: [
      {
        pillar: "liquidity",
        axis: "tide",
        status: "OK",
        scoreRaw: 61.234567,
        scoreOri: 61.234567,
        coverage: 0.71,
        nUsed: 19,
        nTotal: 19,
        contributions: [],
        excluded: [],
        notApplicable: [],
      },
    ],
    pillarScalars: [],
    axes: {
      tide: { axis: "tide", status: "OK", score: 55.5, coverage: 0.7, depth: 0.5, used: [], dropped: [], notApplicable: [] },
      wind: { axis: "wind", status: "INSUFFICIENT", coverage: 0.6, depth: 0.4, used: [], dropped: [], notApplicable: [] },
      wave: { axis: "wave", status: "OK", score: 38.5, coverage: 0.83, depth: 0.6, used: [], dropped: [], notApplicable: [] },
    },
    directions: { tide: "UP", wind: undefined, wave: "DOWN" },
    confidence: {} as PipelineResult["confidence"],
    overall: undefined,
    rte: 52.5,
    alignment: undefined,
    alignmentState: { state: "UNDETERMINED", rule: 1, reason: "" },
    acute: { watch: false, triggers: [], channels: [], channelCount: 0, regimeChange: false },
    regime: {} as PipelineResult["regime"],
    display: { overall: undefined, axes: { tide: 55, wind: undefined, wave: 40 } },
    ...over,
  };
}

function stored(over: Partial<StoredForVerify> = {}): StoredForVerify {
  return {
    runId: "2026-09-19_abc123def456_LIVE",
    asOf: "2026-09-19",
    configHash: HASH,
    gitSha: "1234abc",
    axes: [
      { axis: "tide", score: 55.5, direction: "UP", coverage: 0.7, status: "OK" },
      { axis: "wind", score: null, direction: null, coverage: 0.6, status: "INSUFFICIENT" },
      { axis: "wave", score: 38.5, direction: "DOWN", coverage: 0.83, status: "OK" },
    ],
    pillars: [
      { pillar: "liquidity", axis: "tide", scoreRaw: 61.234567, scoreOri: 61.234567, coverage: 0.71, status: "OK" },
    ],
    regime: { overall: null, rte: 52.5, alignment: null, alignmentState: "UNDETERMINED", acuteWatch: 0 },
    ...over,
  };
}

// ═════════════════════════════════════════════════════════════════════════
describe("★ 일치하면 통과한다", () => {
  it("모든 항목이 같으면 OK", () => {
    const v = compareRun(stored(), recomputed(), HASH);
    expect(v.status).toBe("OK");
    if (v.status !== "OK") return;
    expect(v.mismatches).toEqual([]);
    expect(v.checked).toBeGreaterThan(0);
    expect(verdictLine(v)).toContain("재현됐다");
  });

  it(`소수 ${STORE_DECIMALS}자리 아래의 차이는 불일치가 아니다`, () => {
    // 부동소수 끝자리 차이로 매번 빨간불이 켜지면 아무도 안 본다
    const r = recomputed();
    r.axes.tide.score = 55.5 + 1e-9;
    const v = compareRun(stored(), r, HASH);
    expect(v.status).toBe("OK");
  });
});

// ═════════════════════════════════════════════════════════════════════════
describe("★ 어긋나면 잡는다 — 어디가 다른지 말한다", () => {
  it("축 점수가 다르면 잡는다", () => {
    const r = recomputed();
    r.axes.tide.score = 55.6;
    const v = compareRun(stored(), r, HASH);
    expect(v.status).toBe("MISMATCH");
    if (v.status !== "MISMATCH") return;
    const m = v.mismatches.find((x) => x.where === "axis.tide.score")!;
    expect(m.stored).toBe(55.5);
    expect(m.recomputed).toBe(55.6);
    expect(m.delta).toBeCloseTo(0.1, 6);
    expect(verdictLine(v)).toContain("재현 가능");
  });

  it("기둥 점수가 소수 6자리에서 달라도 잡는다", () => {
    const r = recomputed();
    r.pillars[0].scoreRaw = 61.234568;
    const v = compareRun(stored(), r, HASH);
    expect(v.status).toBe("MISMATCH");
  });

  it("상태 문자열이 달라도 잡는다", () => {
    const r = recomputed();
    r.axes.wind.status = "OK";
    const v = compareRun(stored(), r, HASH);
    expect(v.status).toBe("MISMATCH");
    if (v.status !== "MISMATCH") return;
    expect(v.mismatches.some((x) => x.where === "axis.wind.status")).toBe(true);
  });

  it("방향이 달라도 잡는다 — 화살표도 결과다", () => {
    const r = recomputed();
    r.directions.tide = "FLAT";
    const v = compareRun(stored(), r, HASH);
    expect(v.status).toBe("MISMATCH");
  });

  it("레짐 상태·급성 경보도 대조한다", () => {
    const r = recomputed();
    r.acute.watch = true;
    const v = compareRun(stored(), r, HASH);
    expect(v.status).toBe("MISMATCH");
    if (v.status !== "MISMATCH") return;
    expect(v.mismatches.some((x) => x.where === "regime.acuteWatch")).toBe(true);
  });

  it("저장에만 있고 재계산에 없는 기둥을 잡는다", () => {
    const v = compareRun(
      stored({ pillars: [{ pillar: "없는기둥", axis: "tide", scoreRaw: 1, scoreOri: 1, coverage: 1, status: "OK" }] }),
      recomputed(),
      HASH,
    );
    expect(v.status).toBe("MISMATCH");
  });
});

// ═════════════════════════════════════════════════════════════════════════
describe("★ ⚠ 설정이 바뀌었으면 **검증하지 않고 멈춘다**", () => {
  it("불일치가 아니라 CONFIG_CHANGED다 — 둘을 섞지 않는다", () => {
    const v = compareRun(stored(), recomputed(), "999999999999");
    expect(v.status).toBe("CONFIG_CHANGED");
    if (v.status !== "CONFIG_CHANGED") return;
    expect(v.storedHash).toBe(HASH);
    expect(v.currentHash).toBe("999999999999");
  });

  it("되돌릴 git_sha를 알려 준다 — 해시는 단방향이다", () => {
    const v = compareRun(stored(), recomputed(), "999999999999");
    if (v.status !== "CONFIG_CHANGED") return;
    expect(v.detail).toContain("단방향");
    expect(v.detail).toContain("1234abc");
  });

  it("⚠ git_sha조차 없으면 재현할 수 없다고 말한다", () => {
    const v = compareRun(stored({ gitSha: null }), recomputed(), "999999999999");
    if (v.status !== "CONFIG_CHANGED") return;
    expect(v.detail).toContain("재현할 수 없다");
  });

  it("설정이 다르면 대조를 시작조차 하지 않는다 — 다른 설정끼리 비교한 불일치는 잡음이다", () => {
    const r = recomputed();
    r.axes.tide.score = 99; // 크게 다르지만
    const v = compareRun(stored(), r, "999999999999");
    expect(v.status).toBe("CONFIG_CHANGED"); // 불일치로 보고하지 않는다
  });
});

// ═════════════════════════════════════════════════════════════════════════
describe("⚠ 저장 정밀도와 대조 정밀도가 같다 (CLAUDE.md §2-1)", () => {
  it("repository의 저장 자릿수와 verify의 대조 자릿수가 같다", () => {
    const repo = readFileSync(
      fileURLToPath(new URL("../../features/gcrm/repository.ts", import.meta.url)),
      "utf8",
    );
    const m = repo.match(/toFixed\((\d+)\)/);
    expect(m, "repository.ts에서 toFixed를 찾지 못했다").toBeTruthy();
    expect(Number(m![1])).toBe(STORE_DECIMALS);
  });
});

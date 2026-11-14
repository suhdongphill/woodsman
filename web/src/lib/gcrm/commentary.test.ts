import { describe, expect, it } from "vitest";
import { buildCommentaryPrompt, buildFacts, compareValue, verifyCommentary, type CommentaryInput } from "./commentary";

const input = (over: Partial<CommentaryInput> = {}): CommentaryInput => ({
  asOf: "2026-11-14",
  computedAt: "2026-11-13T21:01:00Z",
  runId: "run_1",
  modelVersion: "gcrm-2.0",
  regimeLabel: "판정 보류",
  regimeConfirmed: false,
  pillars: [
    {
      pillar: "liquidity",
      nameKo: "유동성",
      axis: "tide",
      score: 47.4,
      coverage: 0.71,
      status: "PUBLISHED",
      prevDay: { kind: "value", asOf: "2026-11-13", score: 48.2 },
      w4: { kind: "value", asOf: "2026-10-17", score: 52 },
    },
    {
      pillar: "engine_heat",
      nameKo: "엔진 온도",
      axis: "tide",
      score: 71,
      coverage: 0.9,
      status: "PUBLISHED",
      prevDay: { kind: "missing", reason: "VERSION_CHANGED", detail: "gcrm-1.9 → gcrm-2.0" },
      w4: { kind: "missing", reason: "NO_RUN", detail: "" },
    },
    {
      pillar: "rate_absorption",
      nameKo: "금리 감내력",
      axis: "tide",
      score: null,
      coverage: 0.4,
      status: "INSUFFICIENT",
      prevDay: { kind: "missing", reason: "NO_RUN", detail: "" },
      w4: { kind: "missing", reason: "NO_RUN", detail: "" },
    },
  ],
  research: [{ id: "R-001", title: "Gold", horizon: "wind", candidate: "금 신호", limit: "워킹페이퍼" }],
  ...over,
});

const good = {
  regimeStatus: "판정 보류",
  summary: "레짐은 판정 보류입니다. 유동성은 4주 전 52점에서 47점으로 내려왔습니다.",
  evidence: [
    { factIds: ["liquidity.tide.w4"], text: "유동성 52점 → 47점(-5)" },
    { factIds: ["engine_heat.tide.score", "engine_heat.tide.coverage"], text: "엔진 온도 71점, 커버리지 90%" },
  ],
  interpretation: "금리 감내력이 미발행이라 정렬을 단정하기 어렵습니다.",
  nextChecks: ["유동성이 다시 오르면 정렬 여부를 다시 본다"],
  researchIds: ["R-001"],
};

describe("buildFacts", () => {
  it("6축 발행과 레짐 확정은 다른 사실로 · 비교값 부재는 이유로 · 미발행은 미발행으로", () => {
    const f = new Map(buildFacts(input()).map((x) => [x.id, x.text]));
    expect(f.get("pillars.published")).toBe("2/3");
    expect(f.get("regime.status")).toBe("판정 보류");
    expect(f.get("regime.confirmed")).toContain("확정 아님");
    expect(f.get("liquidity.tide.w4")).toBe("52점 → 47점(-5)");
    expect(f.get("engine_heat.tide.prev")).toBe("모델 버전이 달라 비교하지 않음");
    expect(f.get("rate_absorption.tide.score")).toBe("미발행(INSUFFICIENT)");
    // ⚠ 결측을 0·보합으로 바꾸지 않는다
    expect([...f.values()].join(" ")).not.toMatch(/보합/);
  });

  it("프롬프트에 사실표와 연구 후보가 들어간다", () => {
    const p = buildCommentaryPrompt(input());
    expect(p).toContain("[liquidity.tide.w4]");
    expect(p).toContain("R-001");
  });
});

describe("verifyCommentary", () => {
  it("사실표 안의 숫자·ID만 쓴 답은 통과", () => {
    const r = verifyCommentary(JSON.stringify(good), input());
    expect(r.ok).toBe(true);
  });

  it("⚠ 입력에 없는 숫자를 지어내면 실패", () => {
    const r = verifyCommentary(JSON.stringify({ ...good, summary: "유동성이 47.4점으로 19주 연속 하락했습니다." }), input());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problems.join(" ")).toMatch(/사실표에 없는 숫자: 47\.4, 19/);
  });

  it("⚠ 판정 보류를 확정처럼 바꾸면 실패 · 없는 근거 ID · 없는 연구 · 권유 표현도 실패", () => {
    const r = verifyCommentary(
      JSON.stringify({
        ...good,
        regimeStatus: "상승 정렬",
        evidence: [{ factIds: ["nope"], text: "x" }],
        researchIds: ["R-999"],
        nextChecks: ["지금 매수할 때"],
      }),
      input(),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const all = r.problems.join(" | ");
      expect(all).toMatch(/regimeStatus/);
      expect(all).toMatch(/근거 ID가 사실표에 없습니다/);
      expect(all).toMatch(/R-999/);
      expect(all).toMatch(/매수/);
    }
  });

  it("사실표에 없는 날짜 · JSON 아님 · 코드 블록으로 감싼 답", () => {
    expect(verifyCommentary(JSON.stringify({ ...good, summary: "2026-11-01 이후 약해졌습니다." }), input()).ok).toBe(false);
    expect(verifyCommentary("모르겠습니다", input()).ok).toBe(false);
    expect(verifyCommentary("```json\n" + JSON.stringify(good) + "\n```", input()).ok).toBe(true);
  });
});

describe("compareValue", () => {
  it("없음 · 버전 다름 · 미발행 · NaN은 숫자로 만들지 않는다", () => {
    expect(compareValue(undefined, "v2").kind).toBe("missing");
    expect(compareValue({ asOf: "d", modelVersion: "v1", score: 50 }, "v2")).toMatchObject({ reason: "VERSION_CHANGED" });
    expect(compareValue({ asOf: "d", modelVersion: "v2", score: null }, "v2")).toMatchObject({ reason: "NOT_PUBLISHED" });
    expect(compareValue({ asOf: "d", modelVersion: "v2", score: Number.NaN }, "v2")).toMatchObject({ reason: "NOT_PUBLISHED" });
    expect(compareValue({ asOf: "d", modelVersion: "v2", score: 50 }, "v2")).toEqual({ kind: "value", asOf: "d", score: 50 });
  });
});

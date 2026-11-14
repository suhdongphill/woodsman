import { describe, expect, it } from "vitest";
import {
  briefLength,
  buildCommentaryPrompt,
  buildRepairPrompt,
  buildFacts,
  compareValue,
  serverNotes,
  verifyCommentary,
  type CommentaryInput,
} from "./commentary";

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
      polarity: "favorable",
      score: 47.4,
      coverage: 0.71,
      status: "PUBLISHED",
      prevDay: { kind: "value", asOf: "2026-11-13", score: 44.2 },
      w4: { kind: "value", asOf: "2026-10-17", score: 52 },
    },
    {
      pillar: "engine_heat",
      nameKo: "엔진 온도",
      axis: "tide",
      polarity: "stress",
      score: 71,
      coverage: 0.9,
      status: "PUBLISHED",
      prevDay: { kind: "missing", reason: "VERSION_CHANGED", detail: "gcrm-1.9 → gcrm-2.0" },
      w4: { kind: "value", asOf: "2026-10-17", score: 64 },
    },
    {
      pillar: "rate_absorption",
      nameKo: "금리 감내력",
      axis: "tide",
      polarity: "favorable",
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

const para1 =
  "유동성은 평소 수준입니다. 4주 전과 비교하면 52점에서 47점으로 소폭 내려왔습니다. 유동성은 점수가 높을수록 자본에 유리한 항목입니다. 한 달 흐름으로는 자금 여건이 조금 빡빡해진 셈입니다.";
const para2 =
  "그래도 아직 국면이 바뀌었다고 보지 않습니다. 엔진 온도는 평소보다 크게 높습니다. 엔진 온도는 경기가 과열 쪽인지 식는 쪽인지를 봅니다. 두 신호가 같은 쪽을 가리키지 않아 판단을 미룹니다.";
const caveat =
  "금리 감내력은 자료가 모자라 점수를 내지 않았습니다. 유동성은 직전 계산과 비교하면 올라왔습니다. 한 달 흐름과 하루 흐름이 엇갈립니다. 이 해석이 틀린다면 유동성의 반등이 일시적이 아니라 추세의 시작이기 때문일 것입니다.";
const good = {
  regimeStatus: "판정 보류",
  verdict: "자금은 조금 빡빡해졌지만 국면은 그대로입니다",
  paragraphs: [para1, para2],
  caveat,
  triggers: [
    "유동성이 4주 전 수준인 52점 위로 돌아오면, 빡빡해졌다는 판단을 거둡니다.",
    "엔진 온도가 평소 수준으로 내려오면, 과열 경계를 낮춥니다.",
  ],
  evidenceFactIds: ["liquidity.tide.w4", "engine_heat.tide.level"],
  card: "자금 여건은 한 달 전보다 조금 빡빡해졌습니다. 유동성이 52점에서 47점으로 내려왔습니다. 엔진 온도는 여전히 높습니다.",
  researchIds: ["R-001"],
};

describe("buildFacts · serverNotes (v2)", () => {
  it("방향(극성)·수준 말·반영률(%)·비교 시점 이름 — 결측은 이유로, 0·보합으로 메우지 않는다", () => {
    const f = new Map(buildFacts(input()).map((x) => [x.id, x.text]));
    expect(f.get("liquidity.tide.polarity")).toContain("우호형");
    expect(f.get("engine_heat.tide.polarity")).toContain("긴장형");
    expect(f.get("engine_heat.tide.level")).toBe("평소보다 크게 높다");
    expect(f.get("liquidity.tide.coverage")).toBe("71%");
    expect(f.get("liquidity.tide.w4")).toBe("52점 → 47점(-5)");
    expect(f.get("engine_heat.tide.prev")).toBe("모델 버전이 달라 비교하지 않음");
    expect(f.get("rate_absorption.tide.score")).toBe("자료가 모자라 점수 없음");
    expect(f.has("rate_absorption.tide.level")).toBe(false);
    expect(f.get("regime.confirmed")).toContain("확정 아님");
    expect([...f.values()].join(" ")).not.toMatch(/커버리지|INSUFFICIENT|보합/);
  });

  it("서버 메모 다섯 가지 — 비교 시점 방향이 다른 항목 · 반영률 최저 · 같은/반대 방향 쌍 · 점수 없음 · 레짐 확정 아님", () => {
    const notes = serverNotes(input()).join("\n");
    expect(notes).toMatch(/유동성: 직전 계산 대비 올라감 · 4주 전 대비 내려감/);
    expect(notes).toMatch(/반영률이 가장 낮은 항목: 유동성/);
    expect(notes).toMatch(/4주 전 대비 반대 방향: 유동성\(내려감\) · 엔진 온도\(올라감\)/);
    expect(notes).toMatch(/금리 감내력: 자료가 모자라/);
    expect(notes).toMatch(/아직 국면이 바뀌었다고 보지 않습니다/);
    // ⚠ 메모는 새 숫자를 만들지 않는다(비교 시점 이름 「4주 전」만)
    expect(notes.replace(/4주 전/g, "")).not.toMatch(/\d/);
  });

  it("프롬프트 — 조류(1~12개월 흐름) 용어 · 사실표 · 메모 · 연구 후보", () => {
    const p = buildCommentaryPrompt(input());
    expect(p).toContain("조류(1~12개월 흐름)");
    expect(p).not.toContain("1년 흐름");
    expect(p).toContain("[liquidity.tide.w4]");
    expect(p).toContain("서버 메모");
    expect(p).toContain("R-001");
  });
});

describe("verifyCommentary (v2)", () => {
  it("사실표 안의 숫자·ID만 쓴 브리핑은 통과", () => {
    expect(briefLength(good)).toBeGreaterThanOrEqual(400);
    const r = verifyCommentary(JSON.stringify(good), input());
    if (!r.ok) throw new Error(r.problems.join(" | "));
    expect(r.body.paragraphs).toHaveLength(2);
  });

  it("⚠ 입력에 없는 숫자 · 반올림 안 한 값 · 분모를 지어낸 분수는 실패", () => {
    const r = verifyCommentary(
      JSON.stringify({ ...good, card: "유동성 47.4점, 열 개 중 7/10이 반영됐고 19주째 약합니다." }),
      input(),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const all = r.problems.join(" | ");
      expect(all).toMatch(/사실표에 없는 숫자: .*47\.4/);
      expect(all).toMatch(/19/);
      expect(all).toMatch(/사실표에 없는 분수: 7\/10/);
    }
  });

  it("⚠ 판정 보류를 바꾸면 · 판정에 숫자 · 「지켜본다」로 끝남 · 권유 · 내부 용어 · 금지 문체 → 실패", () => {
    const r = verifyCommentary(
      JSON.stringify({
        ...good,
        regimeStatus: "상승 정렬",
        verdict: "유동성 47점, 국면 유지",
        triggers: ["유동성을 지켜본다", "지금 매수할 때로 사료된다"],
        caveat: caveat + " 기둥 하나가 빠졌습니다.",
      }),
      input(),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const all = r.problems.join(" | ");
      for (const re of [/regimeStatus/, /판정에는 숫자/, /지켜본다/, /매수/, /내부 용어: 「기둥」/, /사료된다/]) expect(all).toMatch(re);
    }
  });

  it("구조 — 본문 2문단 · 조건 2~3개 · 근거 ID · 없는 연구 · 길이", () => {
    const r = verifyCommentary(
      JSON.stringify({ ...good, paragraphs: [para1], triggers: ["하나뿐이면, 판단을 바꾼다."], evidenceFactIds: ["nope"], researchIds: ["R-9"] }),
      input(),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const all = r.problems.join(" | ");
      for (const re of [/2문단/, /2~3개/, /근거 ID가 사실표에 없습니다/, /R-9/, /브리핑 길이/]) expect(all).toMatch(re);
    }
  });

  it("JSON 아님은 실패 · 코드 블록으로 감싼 답은 읽는다", () => {
    expect(verifyCommentary("모르겠습니다", input()).ok).toBe(false);
    expect(verifyCommentary("```json\n" + JSON.stringify(good) + "\n```", input()).ok).toBe(true);
  });
});

describe("compareValue", () => {
  it("없음 · 버전 다름 · 점수 없음 · NaN은 숫자로 만들지 않는다", () => {
    expect(compareValue(undefined, "v2").kind).toBe("missing");
    expect(compareValue({ asOf: "d", modelVersion: "v1", score: 50 }, "v2")).toMatchObject({ reason: "VERSION_CHANGED" });
    expect(compareValue({ asOf: "d", modelVersion: "v2", score: null }, "v2")).toMatchObject({ reason: "NOT_PUBLISHED" });
    expect(compareValue({ asOf: "d", modelVersion: "v2", score: Number.NaN }, "v2")).toMatchObject({ reason: "NOT_PUBLISHED" });
    expect(compareValue({ asOf: "d", modelVersion: "v2", score: 50 }, "v2")).toEqual({ kind: "value", asOf: "d", score: 50 });
  });
});

describe("v2 서버 관문 보강 (2026-11-14 첫 v2 초안에서 새어 나온 셋)", () => {
  it("⚠ 조건의 기준선이 다른 항목의 숫자면 실패 — 「유동성이 … 64점 아래」(64는 엔진 온도 4주 전 값)", () => {
    const r = verifyCommentary(
      JSON.stringify({ ...good, triggers: [good.triggers[0], "유동성이 64점 아래에 머물면, 우호적 반전으로 보지 않습니다."] }),
      input(),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problems.join(" | ")).toMatch(/조건의 기준선이 그 항목의 사실이 아닙니다: 64/);
  });

  it("⚠ 문단에 데이터 숫자가 너무 많으면 실패 · 「~점 내렸습니다」로 끝나면 실패", () => {
    const crowded = "유동성 47점, 52점, 44점입니다. 엔진 온도 71점, 64점입니다. 반영률 71%와 90%입니다. 셋째 문장입니다.";
    const r = verifyCommentary(JSON.stringify({ ...good, paragraphs: [crowded, para2] }), input());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problems.join(" | ")).toMatch(/1문단에 숫자가 7개/);
    const ending = para1.replace("소폭 내려왔습니다.", "5점 내렸습니다.");
    const r2 = verifyCommentary(JSON.stringify({ ...good, paragraphs: [ending, para2] }), input());
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.problems.join(" | ")).toMatch(/점 올랐\/내렸습니다/);
  });
});

describe("고쳐 쓰기 프롬프트", () => {
  it("첫 프롬프트 + 문제 목록 + 이전 초안을 함께 준다 · 규칙은 그대로", () => {
    const orig = buildCommentaryPrompt(input());
    const p = buildRepairPrompt(orig, '{"verdict":"x"}', ["본문 1문단에 숫자가 6개"]);
    expect(p.startsWith(orig)).toBe(true);
    expect(p).toContain("본문 1문단에 숫자가 6개");
    expect(p).toContain('{"verdict":"x"}');
    expect(orig).toContain("최대 3개");
  });
});

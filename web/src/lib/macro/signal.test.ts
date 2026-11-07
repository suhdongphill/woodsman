import { describe, expect, it } from "vitest";
import type { MacroSignalRule } from "./catalog";
import { chipStatusLabel, judgeSignal } from "./signal";

const rule = { op: "lt", warn: 50, alert: 45 } as MacroSignalRule;

describe("chipStatusLabel", () => {
  it("판정이 있으면 그 판정을 적는다", () => {
    expect(chipStatusLabel(rule, "normal")).toBe("정상");
    expect(chipStatusLabel(rule, "watch")).toBe("주의");
    expect(chipStatusLabel(rule, "alert")).toBe("경고");
  });

  it("⚠ 판정 규칙이 없는 지표는 글자를 붙이지 않는다 — 값이 있어도 정상이 아니다", () => {
    expect(judgeSignal(undefined, 4.9)).toBe("unknown");
    expect(chipStatusLabel(undefined, "unknown")).toBeNull();
  });

  it("⚠ 규칙이 있는데 값이 없으면 자료 미제공이다 — NaN도 같다", () => {
    expect(chipStatusLabel(rule, judgeSignal(rule, undefined))).toBe("자료 미제공");
    expect(chipStatusLabel(rule, judgeSignal(rule, Number.NaN))).toBe("자료 미제공");
  });
});

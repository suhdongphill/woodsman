import { describe, expect, it } from "vitest";
import { MACRO_SECTORS, validateSectors } from "./registry";

const inflation = () => MACRO_SECTORS.find((s) => s.group.key === "inflation")!;

describe("물가 압력 섹션·계기판(⑥)", () => {
  it("현재 카탈로그는 통과 — 32개 지표가 6개 섹션에 한 번씩", () => {
    expect(validateSectors()).toEqual([]);
    const s = inflation();
    const keys = s.group.sections!.flatMap((x) => x.keys);
    expect(keys).toHaveLength(s.indicators.length);
    expect(new Set(keys).size).toBe(keys.length);
    expect(s.group.sections!.map((x) => x.key)).toEqual(["level", "breadth", "items", "oil", "pipeline", "expectations"]);
    expect(s.group.name).toBe("물가 압력");
    expect(s.group.dashboard).toHaveLength(6);
  });

  it("⚠ 새 지표를 넣고 섹션을 잊으면 막는다", () => {
    const bad = MACRO_SECTORS.map((s) =>
      s.group.key === "inflation" ? { ...s, indicators: [...s.indicators, { ...s.indicators[0], key: "new_one" }] } : s,
    );
    expect(validateSectors(bad)).toContain("inflation: 지표 new_one가 어느 섹션에도 없다");
  });

  it("⚠ 같은 지표를 두 섹션에 넣으면 막는다", () => {
    const bad = MACRO_SECTORS.map((s) =>
      s.group.key === "inflation"
        ? {
            ...s,
            group: {
              ...s.group,
              sections: s.group.sections!.map((x, i) => (i === 1 ? { ...x, keys: [...x.keys, "cpi_yoy"] } : x)),
            },
          }
        : s,
    );
    expect(validateSectors(bad)).toContain("inflation: 지표 cpi_yoy가 섹션 2곳에 있다");
  });

  it("계기판 키는 그 묶음 안에 · 6개까지", () => {
    const bad = MACRO_SECTORS.map((s) =>
      s.group.key === "inflation" ? { ...s, group: { ...s.group, dashboard: ["ust10y"] } } : s,
    );
    expect(validateSectors(bad)).toContain("inflation: 계기판에 없는 지표 ust10y");
  });
});

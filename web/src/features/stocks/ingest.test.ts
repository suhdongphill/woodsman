import { describe, expect, it } from "vitest";
import { quotesToWrite } from "./ingest";
import type { QuotePoint } from "@/lib/quote/types";

function p(date: string, close = 100): QuotePoint {
  return { date, close };
}

describe("quotesToWrite", () => {
  it("처음이면 전부 쓴다", () => {
    const points = [p("2026-03-01"), p("2026-03-02")];
    expect(quotesToWrite(points, undefined)).toEqual({ toWrite: points, added: 2 });
  });

  it("이미 있으면 마지막 거래일에서 되감은 구간만 쓴다", () => {
    const points = [p("2026-01-01"), p("2026-03-01"), p("2026-03-20")];
    const { toWrite } = quotesToWrite(points, "2026-03-10");
    // 2026-03-10에서 30일 전 = 2026-02-08 이후만
    expect(toWrite.map((x) => x.date)).toEqual(["2026-03-01", "2026-03-20"]);
  });

  it("새로 생긴 점만 added로 센다 — 되감아 다시 쓴 것은 새 점이 아니다", () => {
    const points = [p("2026-03-01"), p("2026-03-20")];
    const { added } = quotesToWrite(points, "2026-03-10");
    expect(added).toBe(1);
  });

  it("되감기 구간이 종가 수정을 덮는다 — 옛 값이 틀린 채 남지 않게", () => {
    const points = [p("2026-03-05", 999)];
    const { toWrite } = quotesToWrite(points, "2026-03-10");
    // 마지막 거래일보다 앞이지만 되감기 구간 안이므로 다시 쓴다.
    expect(toWrite).toHaveLength(1);
    expect(toWrite[0].close).toBe(999);
  });

  it("기준일이 형식에 안 맞으면 전부 쓴다 — 조용히 아무것도 안 쓰지 않는다", () => {
    const points = [p("2026-03-01"), p("2026-03-02")];
    expect(quotesToWrite(points, "언젠가").toWrite).toHaveLength(2);
  });
});

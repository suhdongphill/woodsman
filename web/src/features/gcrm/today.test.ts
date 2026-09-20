/**
 * ⚠ 「오늘」은 **자정 전후 몇 시간에만** 어긋난다 — 테스트가 없으면 재현이 어렵다.
 */
import { describe, it, expect } from "vitest";
import { gcrmToday } from "./compute";
import { clickDateKey } from "@/lib/outbound";

describe("gcrmToday", () => {
  it("⚠ UTC 밤은 KST로 다음 날이다 — UTC로 자르면 저녁 계산이 어제로 간다", () => {
    // 2026-09-20 21:00 UTC = 2026-09-21 06:00 KST (매일 수집이 도는 바로 그 시각)
    expect(gcrmToday(new Date("2026-09-20T21:00:00.000Z"))).toBe("2026-09-21");
  });

  it("KST 자정 직전은 아직 같은 날이다", () => {
    // 2026-09-20 14:59 UTC = 2026-09-20 23:59 KST
    expect(gcrmToday(new Date("2026-09-20T14:59:00.000Z"))).toBe("2026-09-20");
  });

  it("★ 사이트의 다른 「오늘」과 같은 답을 낸다 — 화면과 점수의 오늘이 갈리면 안 된다", () => {
    for (const iso of ["2026-01-01T00:00:00.000Z", "2026-06-30T14:59:59.000Z", "2026-12-31T15:00:00.000Z"]) {
      const d = new Date(iso);
      expect(gcrmToday(d)).toBe(clickDateKey(d));
    }
  });
});

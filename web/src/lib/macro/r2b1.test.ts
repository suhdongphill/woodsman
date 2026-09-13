import { describe, expect, it } from "vitest";
import { findIndicator } from "./catalog";
import { MACRO_GROUPS, validateSectors } from "./registry";
import { SCORE_INPUTS } from "../scores/inputs";

describe("R2b-1 — 기존 출처로 받는 점수 입력 계열", () => {
  it("정의 검증이 깨끗하다", () => {
    expect(validateSectors()).toEqual([]);
  });

  it("투자·자본형성 묶음은 생산성·공급 바로 뒤에 온다", () => {
    const order = [...MACRO_GROUPS].sort((a, b) => a.order - b.order).map((g) => g.key);
    expect(order.indexOf("capex")).toBe(order.indexOf("supply") + 1);
  });

  it("⚠ 수준·지수 계열은 전년비로 읽는다 — 원값 저장, 변환은 읽을 때", () => {
    for (const key of ["wages_yoy", "corp_profits_yoy", "power_ip_yoy", "semi_ppi_yoy", "output_per_worker_yoy", "total_debt_yoy", "pnfi_yoy", "equipment_inv_yoy", "ip_inv_yoy"]) {
      expect(findIndicator(key)?.transform, key).toBe("yoy");
    }
    expect(findIndicator("mortgage30")?.transform).toBe("level");
  });

  /** ⚠ 선행 EPS가 아닌 것을 선행 EPS처럼 부르지 않는다(설계서 결정 ② — 이름을 바꿔 대체). */
  it("⚠ 기업이익은 「실현」이라고 스스로 말하고, 점수 매핑은 대체라고 적는다", () => {
    expect(findIndicator("corp_profits_yoy")?.name).toContain("실현");
    const eps = SCORE_INPUTS.rate_absorption?.eps_growth;
    expect(eps?.status).toBe("available");
    if (eps?.status === "available") expect(eps.substitute).toMatch(/실현/);
  });

  /** ⚠ 시간당 산출(OPHNFB)과 근로자당 산출(PRS85006163)은 다른 계열이다 — 명세 §7의 중복과 헷갈리지 않게. */
  it("근로자당 산출은 노동생산성과 다른 계열이다", () => {
    expect(findIndicator("output_per_worker_yoy")?.sourceId).toBe("PRS85006163");
    expect(findIndicator("prod_yoy")?.sourceId).toBe("OPHNFB");
  });
});

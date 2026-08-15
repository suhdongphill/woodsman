import { describe, expect, it } from "vitest";
import {
  HONESTY_RULES,
  NUMERIC_SECTIONS,
  REPORT_SECTIONS,
  REQUIRED_SECTIONS,
  findHonestyRule,
  findReportSection,
} from "./catalog";
import {
  canPublish,
  isBlankBody,
  publishBlockers,
  validateReport,
  validationSummary,
} from "./rules";
import type { ReportBlock, ReportDraft, ReportSectionKey } from "./types";

const TODAY = "2026-08-15";

function block(key: ReportSectionKey, over: Partial<ReportBlock> = {}): ReportBlock {
  return {
    sectionKey: key,
    // ⚠ 40자를 넘겨야 '본문이 너무 짧다' 경고에 걸리지 않는다(그 경고 자체는 아래에서 따로 검사한다).
    body: "이 섹션의 본문입니다. 판단의 근거와 그 근거가 어디서 왔는지를 충분한 길이로 적어 두었습니다.",
    ...over,
  };
}

/** 규율을 전부 지킨 초안. 각 테스트는 여기서 하나씩 망가뜨린다. */
function validDraft(over: Partial<ReportDraft> = {}): ReportDraft {
  return {
    ticker: "TSM",
    name: "TSMC",
    market: "US",
    industry: "반도체 파운드리",
    status: "DRAFT",
    headline: "선단 공정 독점이 가격 결정력으로 이어지는 국면",
    verdictStructural: "중장기 구조적 우위 유지",
    verdictShort: "단기 과열 — 조정 대기",
    revokeIf: "월별 매출 성장률이 2개월 연속 마이너스로 꺾이면 이 판정을 철회한다",
    nextCheckAt: "2026-10-16",
    valuationLimitation: "PER은 사이클 고점에서 낮게 보인다. 감가상각 부담이 큰 파운드리는 EV/EBITDA 병행이 필요하다.",
    blocks: [
      block("header"),
      block("summary"),
      block("scenario", { tag: "needsCheck", source: "자체 추정" }),
      block("sizing"),
      block("checklist"),
      block("footer"),
    ],
    checklist: [{ item: "3Q26 가이던스", source: "IR 발표", impact: "A축 재채점" }],
    ...over,
  };
}

describe("섹션 카탈로그", () => {
  it("설계서 §3의 13섹션이 번호 순서대로 있다", () => {
    expect(REPORT_SECTIONS).toHaveLength(13);
    expect(REPORT_SECTIONS.map((s) => s.no)).toEqual(REPORT_SECTIONS.map((s) => s.no).sort());
    expect(REPORT_SECTIONS.map((s) => s.order)).toEqual([...Array(13).keys()]);
  });

  it("섹션 키가 겹치지 않는다 — DB의 sectionKey로 그대로 쓰인다", () => {
    expect(new Set(REPORT_SECTIONS.map((s) => s.key)).size).toBe(13);
  });

  it("설계서가 필수라고 한 섹션이 필수다", () => {
    const required = REQUIRED_SECTIONS.map((s) => s.key).sort();
    // §00 헤더 · §01 요약 · §09 시나리오 · §10 비중 (설계서 §3)
    // + §11 체크리스트 · §12 푸터 (R7과 법적 고지 때문에 우리가 더한 것 — catalog.ts에 이유를 적었다)
    expect(required).toEqual(
      ["checklist", "footer", "header", "scenario", "sizing", "summary"].sort(),
    );
  });

  it("모든 섹션에 질문과 장치가 있다 — 관리자 화면이 그대로 안내로 쓴다", () => {
    for (const s of REPORT_SECTIONS) {
      expect(s.question, s.key).not.toBe("");
      expect(s.devices.length, s.key).toBeGreaterThan(0);
    }
  });

  it("수치 섹션이 지정돼 있다 — 여기에만 데이터 태그를 강제한다", () => {
    expect(NUMERIC_SECTIONS.map((s) => s.key)).toContain("valuation");
    expect(NUMERIC_SECTIONS.map((s) => s.key)).toContain("flow");
    expect(NUMERIC_SECTIONS.map((s) => s.key)).not.toContain("moat");
  });

  it("정직성 규율 7가지가 다 있고 이유가 적혀 있다", () => {
    expect(HONESTY_RULES.map((r) => r.key)).toEqual(["R1", "R2", "R3", "R4", "R5", "R6", "R7"]);
    for (const r of HONESTY_RULES) {
      expect(r.why, r.key).not.toBe("");
      expect(r.enforcedBy, r.key).not.toBe("");
    }
  });

  it("⚠ R1은 여기가 아니라 CANSLIM 채점이 강제한다고 적혀 있다 — 같은 판단을 두 번 구현하지 않는다", () => {
    expect(findHonestyRule("R1")?.enforcedBy).toContain("canslim/score.ts");
  });

  it("섹션에 걸린 규율 키가 실재한다", () => {
    for (const s of REPORT_SECTIONS) {
      for (const key of s.rules) {
        expect(findHonestyRule(key), `${s.key} → ${key}`).toBeDefined();
      }
    }
  });

  it("조회 함수", () => {
    expect(findReportSection("valuation")?.no).toBe("07");
    expect(findReportSection("nope")).toBeUndefined();
  });
});

describe("빈 본문 판정", () => {
  it("⚠ '—'만 있는 표는 빈 것으로 본다 — R2가 겨냥하는 자리다", () => {
    expect(isBlankBody("—")).toBe(true);
    expect(isBlankBody("| — | — |")).toBe(true);
    expect(isBlankBody("   ")).toBe(true);
    expect(isBlankBody(undefined)).toBe(true);
    expect(isBlankBody("외국인 순매수 +1,200억")).toBe(false);
  });
});

describe("규율을 지킨 초안", () => {
  it("발행할 수 있다", () => {
    const problems = validateReport(validDraft(), TODAY);
    expect(publishBlockers(problems), JSON.stringify(publishBlockers(problems))).toEqual([]);
    expect(canPublish(problems)).toBe(true);
  });

  it("요약 문구가 상황을 구분한다", () => {
    expect(validationSummary(validateReport(validDraft(), TODAY))).toContain("통과");
    expect(
      validationSummary(validateReport(validDraft({ verdictShort: "" }), TODAY)),
    ).toContain("경고");
    expect(validationSummary(validateReport(validDraft({ revokeIf: "" }), TODAY))).toContain(
      "발행할 수 없습니다",
    );
  });
});

describe("구조 — 필수 섹션", () => {
  it("필수 섹션이 없으면 발행할 수 없다", () => {
    const draft = validDraft({ blocks: [block("header"), block("summary")] });
    const problems = validateReport(draft, TODAY);
    expect(canPublish(problems)).toBe(false);
    expect(problems.some((p) => p.message.includes("§09"))).toBe(true);
  });

  it("모르는 섹션 키는 거부한다", () => {
    const draft = validDraft();
    draft.blocks.push({ sectionKey: "nope" as ReportSectionKey, body: "본문" });
    expect(canPublish(validateReport(draft, TODAY))).toBe(false);
  });

  it("같은 섹션이 두 번 들어가면 거부한다", () => {
    const draft = validDraft();
    draft.blocks.push(block("summary"));
    expect(
      validateReport(draft, TODAY).some((p) => p.message.includes("두 번")),
    ).toBe(true);
  });

  it("본문이 너무 짧으면 경고한다(차단은 아니다)", () => {
    const draft = validDraft({
      blocks: validDraft().blocks.map((b) => (b.sectionKey === "sizing" ? { ...b, body: "확대." } : b)),
    });
    const problems = validateReport(draft, TODAY);
    expect(canPublish(problems)).toBe(true);
    expect(problems.some((p) => p.severity === "warn" && p.message.includes("짧습니다"))).toBe(true);
  });
});

describe("⚠ 티커는 문자열이다", () => {
  it("국내 티커의 앞자리 0이 잘렸으면 막고, 그 사실을 말해 준다", () => {
    const problems = validateReport(validDraft({ market: "KR", ticker: "5930" }), TODAY);
    expect(canPublish(problems)).toBe(false);
    expect(problems.some((p) => p.message.includes("앞자리 0이 잘린"))).toBe(true);
  });

  it("올바른 6자리 국내 티커는 통과한다", () => {
    expect(canPublish(validateReport(validDraft({ market: "KR", ticker: "005930" }), TODAY))).toBe(
      true,
    );
  });
});

describe("R2 — 모르면 비워 두고 조회처를 적는다", () => {
  it("빈 섹션에 조회처가 없으면 발행할 수 없다", () => {
    const draft = validDraft();
    draft.blocks.push(block("flow", { body: "| — | — |", tag: "na" }));
    const problems = validateReport(draft, TODAY);
    expect(canPublish(problems)).toBe(false);
    expect(problems.some((p) => p.rule === "R2")).toBe(true);
  });

  it("⚠ 빈 프레임 + 조회처는 통과한다 — 설계서에서 가장 중요한 장치다", () => {
    const draft = validDraft();
    draft.blocks.push(
      block("flow", {
        body: "| 외국인 | — |\n| 기관 | — |",
        tag: "na",
        lookupHint: "KRX 정보데이터시스템 → 투자자별 매매동향",
      }),
    );
    expect(canPublish(validateReport(draft, TODAY))).toBe(true);
  });
});

describe("R3 — 판정에는 철회 조건이 붙는다", () => {
  it("철회 조건이 없으면 발행할 수 없다", () => {
    const problems = validateReport(validDraft({ revokeIf: "" }), TODAY);
    expect(canPublish(problems)).toBe(false);
    expect(problems.find((p) => p.rule === "R3")?.fix).toContain("소감");
  });

  it("요약 섹션은 있는데 구조 판정이 없으면 발행할 수 없다", () => {
    const problems = validateReport(validDraft({ verdictStructural: "", revokeIf: "" }), TODAY);
    expect(problems.some((p) => p.rule === "R3" && p.message.includes("구조 판정이 없습니다"))).toBe(
      true,
    );
  });

  it("단기 판정이 없으면 경고만 한다 — 시계 분리는 권장이지 규율은 아니다", () => {
    const problems = validateReport(validDraft({ verdictShort: "" }), TODAY);
    expect(canPublish(problems)).toBe(true);
    expect(problems.some((p) => p.rule === "R3" && p.severity === "warn")).toBe(true);
  });
});

describe("⚠ R4 — 목표주가는 우리가 만들지 않는다", () => {
  const target = {
    value: 118833,
    currency: "KRW",
    source: "18개사 컨센서스 · Investing.com 집계",
    asOf: "2026-03-23",
  };

  it("출처·기준일을 갖춘 제3자 공표치는 인용할 수 있다", () => {
    const draft = validDraft({ consensusTarget: target });
    expect(canPublish(validateReport(draft, TODAY))).toBe(true);
  });

  it("집계처가 없으면 발행할 수 없다 — 우리 의견처럼 읽힌다", () => {
    const draft = validDraft({ consensusTarget: { ...target, source: "" } });
    expect(canPublish(validateReport(draft, TODAY))).toBe(false);
  });

  it("기준일이 없으면 발행할 수 없다", () => {
    const draft = validDraft({ consensusTarget: { ...target, asOf: "" } });
    expect(canPublish(validateReport(draft, TODAY))).toBe(false);
  });

  it("밸류에이션 본문에 '목표주가'가 있는데 인용 출처가 없으면 경고한다", () => {
    const draft = validDraft();
    draft.blocks.push(
      block("valuation", {
        body: "PBR 3.0배를 적용하면 목표주가는 34,200원이다.",
        tag: "needsCheck",
        source: "자체 산출",
      }),
    );
    const problems = validateReport(draft, TODAY);
    expect(problems.some((p) => p.rule === "R4" && p.severity === "warn")).toBe(true);
    expect(problems.find((p) => p.rule === "R4")?.fix).toContain("산출값");
  });
});

describe("R5 — 확정과 추정을 구분한다", () => {
  it("수치 섹션에 태그가 없으면 발행할 수 없다", () => {
    const draft = validDraft();
    draft.blocks.push(block("company", { body: "영업이익 3년 CAGR 24%." }));
    const problems = validateReport(draft, TODAY);
    expect(canPublish(problems)).toBe(false);
    expect(problems.some((p) => p.rule === "R5")).toBe(true);
  });

  it("수치가 없는 섹션에는 태그를 요구하지 않는다", () => {
    const draft = validDraft();
    draft.blocks.push(block("moat", { body: "오필름 퇴출과 샤프 신뢰 상실이 해자의 깊이를 증명한다." }));
    expect(canPublish(validateReport(draft, TODAY))).toBe(true);
  });

  it("'확인'이라 했으면 출처와 기준일이 있어야 한다", () => {
    const draft = validDraft();
    draft.blocks.push(block("company", { body: "지배주주자본 77,857억원.", tag: "confirmed" }));
    const problems = validateReport(draft, TODAY);
    expect(canPublish(problems)).toBe(false);
    expect(problems.filter((p) => p.rule === "R5" && p.severity === "block")).toHaveLength(2);
  });

  it("출처·기준일을 갖춘 '확인'은 통과하고, 링크만 없으면 경고한다", () => {
    const draft = validDraft();
    draft.blocks.push(
      block("company", {
        body: "지배주주자본 77,857억원.",
        tag: "confirmed",
        source: "DART 감사보고서",
        asOf: "2026-03-22",
      }),
    );
    const problems = validateReport(draft, TODAY);
    expect(canPublish(problems)).toBe(true);
    expect(problems.some((p) => p.rule === "R5" && p.message.includes("출처 링크"))).toBe(true);
  });

  it("⚠ N/A로 두면 조회처가 있어야 한다 — N/A는 0이 아니라 '아직 못 봤다'다", () => {
    const draft = validDraft();
    draft.blocks.push(block("company", { body: "기관 보유 비중 자료 미확보.", tag: "na" }));
    expect(canPublish(validateReport(draft, TODAY))).toBe(false);
  });
});

describe("R6 — 방법론의 한계를 같이 쓴다", () => {
  it("밸류에이션이 있는데 한계가 없으면 발행할 수 없다", () => {
    const draft = validDraft({ valuationLimitation: "" });
    draft.blocks.push(block("valuation", { body: "PBR 밴드 상단.", tag: "needsCheck", source: "자체" }));
    const problems = validateReport(draft, TODAY);
    expect(canPublish(problems)).toBe(false);
    expect(problems.find((p) => p.rule === "R6")?.fix).toContain("한계 고백");
  });

  it("밸류에이션 섹션이 없으면 한계도 요구하지 않는다", () => {
    expect(canPublish(validateReport(validDraft({ valuationLimitation: "" }), TODAY))).toBe(true);
  });
});

describe("R7 — 다음 판단 시점을 날짜로", () => {
  it("없으면 발행할 수 없다", () => {
    const problems = validateReport(validDraft({ nextCheckAt: "" }), TODAY);
    expect(canPublish(problems)).toBe(false);
    expect(problems.find((p) => p.rule === "R7")?.fix).toContain("지켜본다");
  });

  it("형식이 틀리면 발행할 수 없다", () => {
    expect(canPublish(validateReport(validDraft({ nextCheckAt: "2026년 10월" }), TODAY))).toBe(false);
  });

  it("지난 날짜면 경고한다 — 갱신하라는 뜻이다", () => {
    const problems = validateReport(validDraft({ nextCheckAt: "2026-01-01" }), TODAY);
    expect(canPublish(problems)).toBe(true);
    expect(problems.some((p) => p.rule === "R7" && p.message.includes("지났습니다"))).toBe(true);
  });

  it("체크리스트가 비면 발행할 수 없다 — 모르는 게 없는 보고서는 없다", () => {
    expect(canPublish(validateReport(validDraft({ checklist: [] }), TODAY))).toBe(false);
  });

  it("체크리스트 줄이 덜 채워지면 발행할 수 없다", () => {
    const draft = validDraft({ checklist: [{ item: "3Q26 가이던스", source: "", impact: "A축" }] });
    expect(canPublish(validateReport(draft, TODAY))).toBe(false);
  });
});

/**
 * 보고서 발행 전 **정직성 규율 검증** — 순수 함수.
 *
 * ## 왜 코드가 강제하나
 * 설계서 §4의 문장이 그대로 이유다 — **형식은 베낄 수 있지만 규율은 코드가 강제해야 유지된다.**
 * "다음에는 조회처를 꼭 적자"는 지켜지지 않는다. 발행이 막혀야 지켜진다.
 *
 * ## 두 단계로 나눈다
 * - `block` — **발행 차단.** 규율 위반이다.
 * - `warn` — 발행은 되지만 품질이 떨어진다. 사람이 읽고 판단한다.
 *
 * ⚠ 경고를 차단으로 올리지 않는다. 전부 차단이면 사람이 규칙을 우회할 방법을 찾는다.
 *
 * ## ⚠ R1은 여기서 검사하지 않는다
 * 결측 제외는 `lib/canslim/score.ts`가 이미 강제한다. **같은 판단을 두 번 구현하지 않는다**
 * (운영지침 §1) — 두 곳에서 판정하면 언젠가 한쪽이 뒤처진다.
 */
import {
  KR_TICKER_PATTERN,
  NUMERIC_SECTIONS,
  REPORT_SECTIONS,
  REQUIRED_SECTIONS,
  US_TICKER_PATTERN,
  findReportSection,
} from "./catalog";
import type { HonestyRuleKey, ReportBlock, ReportDraft, ReportSectionKey } from "./types";

export type ProblemSeverity = "block" | "warn";

export type ReportProblem = {
  severity: ProblemSeverity;
  /** 어느 규율인가. 구조 문제(섹션 누락 등)면 없다. */
  rule?: HonestyRuleKey;
  sectionKey?: ReportSectionKey;
  message: string;
  /** 어떻게 고치나 — 화면에 그대로 띄운다. "틀렸다"만 말하면 고칠 수가 없다. */
  fix: string;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 사실상 빈 본문인가.
 * ⚠ `—`만 있는 표(미조회 프레임)도 **빈 것으로 본다.** 그게 R2가 겨냥하는 자리다 —
 * 빈 프레임 자체는 좋은 장치지만, **조회처가 붙어야** 정직해진다.
 */
export function isBlankBody(body: string | undefined): boolean {
  if (!body) return true;
  return body.replace(/[\s—–\-|:.]/g, "") === "";
}

function blockFor(draft: ReportDraft, key: ReportSectionKey): ReportBlock | undefined {
  return draft.blocks.find((b) => b.sectionKey === key);
}

/** 티커가 숫자로 파싱돼 앞의 0이 날아간 모양인가. */
function looksLikeTruncatedKrTicker(ticker: string): boolean {
  return /^[0-9]{1,5}$/.test(ticker);
}

function checkIdentity(draft: ReportDraft, problems: ReportProblem[]): void {
  if (!draft.ticker.trim()) {
    problems.push({
      severity: "block",
      message: "티커가 비어 있습니다.",
      fix: "종목 코드를 입력하세요.",
    });
  }
  if (!draft.name.trim()) {
    problems.push({ severity: "block", message: "종목명이 비어 있습니다.", fix: "종목명을 입력하세요." });
  }
  if (!draft.headline.trim()) {
    problems.push({
      severity: "block",
      sectionKey: "header",
      message: "한 줄 논지(headline)가 비어 있습니다.",
      fix: "이 보고서가 하는 이야기를 한 문장으로 적으세요. 목록과 헤더에 그대로 쓰입니다.",
    });
  }

  // ⚠ 국장 티커는 6자리 문자열이다. 숫자로 다루면 005930 → 5930이 된다.
  if (draft.market === "KR" && !KR_TICKER_PATTERN.test(draft.ticker)) {
    problems.push({
      severity: "block",
      message: looksLikeTruncatedKrTicker(draft.ticker)
        ? `국내 티커 "${draft.ticker}"의 앞자리 0이 잘린 것으로 보입니다.`
        : `국내 티커 "${draft.ticker}"가 6자리 숫자가 아닙니다.`,
      fix: "티커는 문자열로 다뤄야 합니다. 삼성전자는 5930이 아니라 005930입니다.",
    });
  }
  if (draft.market === "US" && !US_TICKER_PATTERN.test(draft.ticker)) {
    problems.push({
      severity: "warn",
      message: `미국 티커 "${draft.ticker}"가 통상적인 모양(대문자)과 다릅니다.`,
      fix: "대문자 티커인지 확인하세요. 클래스 주식은 BRK.B 형태입니다.",
    });
  }
}

function checkSections(draft: ReportDraft, problems: ReportProblem[]): void {
  const seen = new Set<string>();
  for (const b of draft.blocks) {
    if (!findReportSection(b.sectionKey)) {
      problems.push({
        severity: "block",
        message: `알 수 없는 섹션 키입니다: ${b.sectionKey}`,
        fix: `lib/report/catalog.ts의 REPORT_SECTIONS에 있는 키만 쓸 수 있습니다.`,
      });
      continue;
    }
    if (seen.has(b.sectionKey)) {
      problems.push({
        severity: "block",
        sectionKey: b.sectionKey,
        message: `섹션이 두 번 들어 있습니다: ${b.sectionKey}`,
        fix: "섹션 하나에 본문 하나입니다. 중복을 합치세요.",
      });
    }
    seen.add(b.sectionKey);
  }

  for (const section of REQUIRED_SECTIONS) {
    const block = blockFor(draft, section.key);
    if (!block) {
      problems.push({
        severity: "block",
        sectionKey: section.key,
        message: `필수 섹션이 없습니다: §${section.no} ${section.name}`,
        fix: section.question,
      });
      continue;
    }
    // ⚠ 빈 필수 섹션은 R2로 넘긴다(조회처가 있으면 통과). 여기서 이중으로 막지 않는다.
    if (!isBlankBody(block.body) && block.body.trim().length < 40) {
      problems.push({
        severity: "warn",
        sectionKey: section.key,
        message: `§${section.no} ${section.name}의 본문이 너무 짧습니다.`,
        fix: `이 섹션이 답해야 하는 질문: ${section.question}`,
      });
    }
  }
}

/** R2 — 모르면 비워 두고 **조회처**를 적는다. */
function checkR2(draft: ReportDraft, problems: ReportProblem[]): void {
  for (const b of draft.blocks) {
    const section = findReportSection(b.sectionKey);
    if (!section) continue;

    if (isBlankBody(b.body) && !b.lookupHint?.trim()) {
      problems.push({
        severity: "block",
        rule: "R2",
        sectionKey: b.sectionKey,
        message: `§${section.no} ${section.name}이(가) 비어 있는데 조회처가 없습니다.`,
        fix: "추정치로 채우지 말고, 어디서 그 수치를 구하는지(예: KRX 정보데이터시스템 · DART)를 적으세요.",
      });
    }
  }
}

/** R3 — 판정에는 **철회 조건**이 붙는다. */
function checkR3(draft: ReportDraft, problems: ReportProblem[]): void {
  const summary = blockFor(draft, "summary");

  if (summary && !isBlankBody(summary.body) && !draft.verdictStructural?.trim()) {
    problems.push({
      severity: "block",
      rule: "R3",
      sectionKey: "summary",
      message: "Investment Summary에 구조 판정이 없습니다.",
      fix: "중장기 구조 판정을 한 문장으로 적으세요. 배지로 표시됩니다.",
    });
  }
  if (draft.verdictStructural?.trim() && !draft.revokeIf?.trim()) {
    problems.push({
      severity: "block",
      rule: "R3",
      sectionKey: "summary",
      message: "판정은 있는데 철회 조건이 없습니다.",
      fix: "무엇이 관측되면 이 판정을 접을지 적으세요(예: 수출 ΔYoY가 2개월 연속 마이너스). 반증 조건 없는 판정은 소감입니다.",
    });
  }
  if (draft.verdictStructural?.trim() && !draft.verdictShort?.trim()) {
    problems.push({
      severity: "warn",
      rule: "R3",
      sectionKey: "summary",
      message: "단기 판정이 없습니다.",
      fix: "시계를 나눠 적으면 두 판정이 모순돼 보이지 않습니다(중장기 구조적 상승 / 단기 과열 조정).",
    });
  }
}

/** R4 — 목표주가는 **우리가 만들지 않고** 제3자 공표치를 인용한다. */
function checkR4(draft: ReportDraft, problems: ReportProblem[]): void {
  const target = draft.consensusTarget;

  if (target) {
    if (!Number.isFinite(target.value) || target.value <= 0) {
      problems.push({
        severity: "block",
        rule: "R4",
        sectionKey: "valuation",
        message: "인용한 목표주가 값이 올바르지 않습니다.",
        fix: "집계처가 공표한 숫자를 그대로 넣으세요.",
      });
    }
    if (!target.source?.trim()) {
      problems.push({
        severity: "block",
        rule: "R4",
        sectionKey: "valuation",
        message: "인용한 목표주가에 집계처가 없습니다.",
        fix: '예: "18개사 컨센서스 · Investing.com 집계". 출처 없는 목표주가는 우리 의견처럼 읽힙니다.',
      });
    }
    if (!DATE_PATTERN.test(target.asOf ?? "")) {
      problems.push({
        severity: "block",
        rule: "R4",
        sectionKey: "valuation",
        message: "인용한 목표주가에 기준일이 없습니다.",
        fix: "YYYY-MM-DD로 적으세요. 날짜 없는 목표주가는 지금 값처럼 읽힙니다.",
      });
    }
  }

  // ⚠ 우리가 산출한 값을 '목표주가'라 부르면 규범 위반이다. 다만 문장만으로는 단정할 수 없어 경고다.
  const valuation = blockFor(draft, "valuation");
  if (valuation && valuation.body.includes("목표주가") && !target) {
    problems.push({
      severity: "warn",
      rule: "R4",
      sectionKey: "valuation",
      message: "밸류에이션 본문에 '목표주가'가 나오는데 인용 출처가 없습니다.",
      fix: "우리 산출값이면 '목표주가'라 부르지 말고 'PBR 3.0배 적용 시 산출값'처럼 적으세요. 제3자 공표치면 컨센서스 필드에 출처·기준일과 함께 넣으세요.",
    });
  }
}

/** R5 — **확정과 추정**을 문장에서 구분한다. */
function checkR5(draft: ReportDraft, problems: ReportProblem[]): void {
  const numericKeys = new Set(NUMERIC_SECTIONS.map((s) => s.key));

  for (const b of draft.blocks) {
    const section = findReportSection(b.sectionKey);
    if (!section) continue;
    const where = `§${section.no} ${section.name}`;

    if (numericKeys.has(b.sectionKey) && !isBlankBody(b.body) && !b.tag) {
      problems.push({
        severity: "block",
        rule: "R5",
        sectionKey: b.sectionKey,
        message: `${where}에 수치가 실리는데 데이터 태그가 없습니다.`,
        fix: "확인 / 확인 필요 / N/A 중 하나를 고르세요. 태그 없는 수치는 전부 확정으로 읽힙니다.",
      });
    }

    if (b.tag === "confirmed") {
      if (!b.source?.trim()) {
        problems.push({
          severity: "block",
          rule: "R5",
          sectionKey: b.sectionKey,
          message: `${where}를 '확인'으로 표시했는데 출처가 없습니다.`,
          fix: '1차 자료를 적으세요(예: "DART 2026.03.22 감사보고서").',
        });
      }
      if (!DATE_PATTERN.test(b.asOf ?? "")) {
        problems.push({
          severity: "block",
          rule: "R5",
          sectionKey: b.sectionKey,
          message: `${where}를 '확인'으로 표시했는데 기준일이 없습니다.`,
          fix: "YYYY-MM-DD로 적으세요. 날짜 없는 숫자는 지금 값처럼 읽힙니다.",
        });
      }
      if (!b.sourceUrl?.trim()) {
        problems.push({
          severity: "warn",
          rule: "R5",
          sectionKey: b.sectionKey,
          message: `${where}의 출처 링크가 없습니다.`,
          fix: "독자가 원문을 열어 검산할 수 있어야 합니다.",
        });
      }
    }

    // ⚠ N/A는 "안 봤다"는 뜻이다. 어디서 구하는지를 함께 적어야 다음 갱신이 가능하다.
    if (b.tag === "na" && !b.lookupHint?.trim()) {
      problems.push({
        severity: "block",
        rule: "R5",
        sectionKey: b.sectionKey,
        message: `${where}를 N/A로 두었는데 조회처가 없습니다.`,
        fix: "N/A는 0이 아니라 '아직 못 봤다'입니다. 어디서 확인할 수 있는지 적으세요.",
      });
    }

    if (b.tag === "needsCheck" && !b.source?.trim()) {
      problems.push({
        severity: "warn",
        rule: "R5",
        sectionKey: b.sectionKey,
        message: `${where}가 '확인 필요'인데 출처가 없습니다.`,
        fix: "추정의 근거라도 적어 두면 다음에 무엇을 확인할지 알 수 있습니다.",
      });
    }
  }
}

/** R6 — 방법론의 **한계**를 같이 쓴다. */
function checkR6(draft: ReportDraft, problems: ReportProblem[]): void {
  const valuation = blockFor(draft, "valuation");
  if (valuation && !isBlankBody(valuation.body) && !draft.valuationLimitation?.trim()) {
    problems.push({
      severity: "block",
      rule: "R6",
      sectionKey: "valuation",
      message: "밸류에이션 섹션이 있는데 방법론의 한계가 비어 있습니다.",
      fix: '이 방법이 언제 틀리는지 적으세요(예: "PBR은 수주 모멘텀 기업에 본질적 한계가 있다. 증권사는 EV/EBITDA를 쓰므로 괴리가 난다"). 신뢰는 한계 고백에서 나옵니다.',
    });
  }
}

/** R7 — **다음 판단 시점**을 날짜로 남긴다. */
function checkR7(draft: ReportDraft, problems: ReportProblem[], today: string): void {
  if (!draft.nextCheckAt?.trim()) {
    problems.push({
      severity: "block",
      rule: "R7",
      sectionKey: "checklist",
      message: "다음 판단 시점이 없습니다.",
      fix: '날짜로 적으세요(예: 1Q26 실적 발표일 2026-04-30). "지켜본다"는 지켜보지 않는다는 뜻입니다.',
    });
  } else if (!DATE_PATTERN.test(draft.nextCheckAt)) {
    problems.push({
      severity: "block",
      rule: "R7",
      sectionKey: "checklist",
      message: `다음 판단 시점의 형식이 올바르지 않습니다: ${draft.nextCheckAt}`,
      fix: "YYYY-MM-DD로 적으세요.",
    });
  } else if (draft.nextCheckAt < today) {
    problems.push({
      severity: "warn",
      rule: "R7",
      sectionKey: "checklist",
      message: `다음 판단 시점(${draft.nextCheckAt})이 이미 지났습니다.`,
      fix: "갱신하면서 다음 시점을 새로 잡으세요.",
    });
  }

  if (draft.checklist.length === 0) {
    problems.push({
      severity: "block",
      rule: "R7",
      sectionKey: "checklist",
      message: "미확정 체크리스트가 비어 있습니다.",
      fix: "모르는 채로 남긴 항목을 `항목 · 소스 · 영향`으로 적으세요. 모르는 게 하나도 없는 보고서는 없습니다.",
    });
  }
  draft.checklist.forEach((row, i) => {
    if (!row.item.trim() || !row.source.trim() || !row.impact.trim()) {
      problems.push({
        severity: "block",
        rule: "R7",
        sectionKey: "checklist",
        message: `체크리스트 ${i + 1}번째 줄이 덜 채워졌습니다.`,
        fix: "항목 · 소스 · 영향 셋을 모두 적어야 다음 갱신의 작업 목록이 됩니다.",
      });
    }
  });
}

/**
 * 보고서 초안을 검증한다.
 *
 * `today`는 `YYYY-MM-DD`. ⚠ 인자로 받는다 — 시간을 함수 안에서 읽으면 테스트가 날짜에 따라
 * 깨진다(이 저장소에서 이미 겪었다).
 */
export function validateReport(draft: ReportDraft, today: string): ReportProblem[] {
  const problems: ReportProblem[] = [];

  checkIdentity(draft, problems);
  checkSections(draft, problems);
  checkR2(draft, problems);
  checkR3(draft, problems);
  checkR4(draft, problems);
  checkR5(draft, problems);
  checkR6(draft, problems);
  checkR7(draft, problems, today);

  return problems;
}

/** 발행을 막는 문제들. */
export function publishBlockers(problems: ReportProblem[]): ReportProblem[] {
  return problems.filter((p) => p.severity === "block");
}

/** ⚠ 발행 가능한가. `block`이 하나라도 있으면 안 된다. */
export function canPublish(problems: ReportProblem[]): boolean {
  return publishBlockers(problems).length === 0;
}

/** 화면 한 줄 요약. ⚠ "통과"와 "경고만 있음"을 구분한다. */
export function validationSummary(problems: ReportProblem[]): string {
  const blockers = publishBlockers(problems).length;
  const warnings = problems.length - blockers;

  if (blockers > 0) {
    return `발행할 수 없습니다 — 규율 위반 ${blockers}건${warnings ? ` · 경고 ${warnings}건` : ""}.`;
  }
  if (warnings > 0) {
    return `발행할 수 있습니다. 다만 경고 ${warnings}건을 보고 판단하세요.`;
  }
  return "규율 검증을 모두 통과했습니다.";
}

/** 카탈로그가 아는 모든 섹션 키 — 화면·스키마가 함께 쓴다. */
export const ALL_SECTION_KEYS: ReportSectionKey[] = REPORT_SECTIONS.map((s) => s.key);

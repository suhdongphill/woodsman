/**
 * 보고서 편집 화면의 상태 타입·폼 파싱.
 *
 * ⚠ `"use server"` 파일은 async 함수만 export한다. 상수·타입·순수 파서는 여기 둔다.
 *
 * ## ⚠ 왜 zod로 다시 검증하지 않나
 * 이 폼의 **판단은 전부 `lib/report/rules.ts`가 한다**(정직성 규율 7가지).
 * 같은 판단을 zod에도 적으면 두 곳이 언젠가 갈린다(운영지침 §1).
 * 여기서 하는 일은 **형 변환뿐**이다 — FormData의 문자열을 `ReportDraft` 모양으로 옮긴다.
 * 그리고 ⚠ **초안은 규율을 어겨도 저장된다.** 쓰다 만 보고서를 저장 못 하면 아무도 안 쓴다.
 * 막는 것은 저장이 아니라 **발행**이다.
 */
import { ALL_SECTION_KEYS } from "@/lib/report/rules";
import type { ChecklistItem, ReportBlock, ReportDraft, ReportSectionKey } from "@/lib/report/types";
import type { CanslimReading, DataTagKey } from "@/lib/canslim/types";
import { CANSLIM_ITEMS } from "@/lib/canslim/catalog";
import { isScorablePoints } from "@/lib/canslim/score";

export type ReportFormState = {
  savedAt?: string;
  error?: string;
  /** 발행 시도 결과 요약 — 규율에 걸리면 여기 이유가 온다 */
  notice?: string;
};

export const emptyReportFormState: ReportFormState = {};

function text(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function optional(form: FormData, key: string): string | undefined {
  const v = text(form, key);
  return v === "" ? undefined : v;
}

function tagOf(raw: string): DataTagKey | undefined {
  return raw === "confirmed" || raw === "needsCheck" || raw === "na" ? raw : undefined;
}

/** 체크리스트는 줄 수가 유동적이라 인덱스로 받는다. 세 칸이 다 빈 줄은 버린다. */
function parseChecklist(form: FormData): ChecklistItem[] {
  const rows: ChecklistItem[] = [];
  for (let i = 0; i < 30; i++) {
    const item = text(form, `check.${i}.item`);
    const source = text(form, `check.${i}.source`);
    const impact = text(form, `check.${i}.impact`);
    if (!item && !source && !impact) continue;
    rows.push({ item, source, impact });
  }
  return rows;
}

function parseBlocks(form: FormData): ReportBlock[] {
  const blocks: ReportBlock[] = [];

  for (const key of ALL_SECTION_KEYS) {
    const body = text(form, `block.${key}.body`);
    const tag = tagOf(text(form, `block.${key}.tag`));
    const source = optional(form, `block.${key}.source`);
    const sourceUrl = optional(form, `block.${key}.sourceUrl`);
    const asOf = optional(form, `block.${key}.asOf`);
    const lookupHint = optional(form, `block.${key}.lookupHint`);

    // 아무것도 안 적은 섹션은 아예 넣지 않는다 — 선택 섹션을 빈 채로 저장하면
    // ⚠ R2가 "비었는데 조회처가 없다"고 발행을 막는다. 안 쓴 것과 비운 것은 다르다.
    if (!body && !tag && !source && !sourceUrl && !asOf && !lookupHint) continue;

    blocks.push({
      sectionKey: key as ReportSectionKey,
      body,
      tag,
      source,
      sourceUrl,
      asOf,
      lookupHint,
    });
  }
  return blocks;
}

/** FormData → 저장할 초안. ⚠ 판단하지 않는다. 형만 맞춘다. */
export function parseReportForm(form: FormData, ticker: string): ReportDraft {
  const market = text(form, "market") === "KR" ? "KR" : "US";
  const targetRaw = text(form, "consensus.value");
  const targetValue = targetRaw === "" ? Number.NaN : Number(targetRaw.replace(/,/g, ""));

  return {
    ticker,
    name: text(form, "name"),
    market,
    industry: optional(form, "industry"),
    status: text(form, "status") === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
    headline: text(form, "headline"),
    verdictStructural: optional(form, "verdictStructural"),
    verdictShort: optional(form, "verdictShort"),
    revokeIf: optional(form, "revokeIf"),
    valuationLimitation: optional(form, "valuationLimitation"),
    nextCheckAt: optional(form, "nextCheckAt"),
    consensusTarget: Number.isFinite(targetValue)
      ? {
          value: targetValue,
          currency: text(form, "consensus.currency") || (market === "KR" ? "KRW" : "USD"),
          source: text(form, "consensus.source"),
          asOf: text(form, "consensus.asOf"),
          sourceUrl: optional(form, "consensus.sourceUrl"),
        }
      : undefined,
    blocks: parseBlocks(form),
    checklist: parseChecklist(form),
  };
}

/**
 * FormData → CANSLIM 7축 채점.
 * ⚠ 점수 칸이 비어 있으면 **N/A**다. 0으로 바꾸지 않는다(R1).
 */
export function parseReadings(form: FormData): CanslimReading[] {
  return CANSLIM_ITEMS.map((item) => {
    const raw = text(form, `axis.${item.key}.points`);
    const points = raw === "" ? undefined : Number(raw);
    const tag = tagOf(text(form, `axis.${item.key}.tag`)) ?? "na";

    return {
      key: item.key,
      // 점수가 없거나 범위를 벗어나면 태그와 무관하게 N/A로 저장한다.
      points: isScorablePoints(points) ? points : undefined,
      tag: isScorablePoints(points) ? tag : "na",
      evidence: optional(form, `axis.${item.key}.evidence`),
      source: optional(form, `axis.${item.key}.source`),
      sourceUrl: optional(form, `axis.${item.key}.sourceUrl`),
      asOf: optional(form, `axis.${item.key}.asOf`),
    };
  });
}

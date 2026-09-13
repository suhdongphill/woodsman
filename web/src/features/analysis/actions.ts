"use server";

/**
 * 그날의 분석 — 관리자 붙여넣기(통합 계획 S4).
 * ⚠ 모든 액션이 `requireAdmin`을 먼저 부른다.
 *
 * ## ⚠ 운영자 결정 (2026-09-14)
 * 점수는 **우리 계산**으로 낸다. 외부 보고서에서는 출처 있는 사실과 해석만 싣고 **산식 없는 점수 · Confidence %는 뺀다**.
 * 그래서 저장 전에 `findUnsourcedScores`로 점검한다 — 걸린 줄이 있으면 **저장하지 않고 줄 번호를 돌려준다**.
 * 운영자가 지우고 다시 올리거나, 남은 줄이 출처 있는 사실임을 확인(`acceptGuard`)하면 저장한다. ⚠ 자동으로 지우지 않는다.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/session";
import { findUnsourcedScores } from "@/lib/analysis/guard";
import { ANALYSIS_ONE_LINE_MAX, DEFAULT_ANALYSIS_SOURCE, type AnalysisFormState } from "./form-state";
import { saveDailyAnalysis } from "./repository";

function text(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

const schema = z.object({
  date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "분석 날짜를 확인하세요."),
  oneLine: z
    .string()
    .trim()
    .min(4, "한 줄 결론을 적으세요.")
    .max(ANALYSIS_ONE_LINE_MAX, `한 줄 결론은 ${ANALYSIS_ONE_LINE_MAX}자까지입니다.`),
  body: z.string().trim().min(20, "분석 본문을 붙여넣으세요.").max(30_000, "본문이 너무 깁니다(3만 자까지)."),
  sourceLabel: z
    .string()
    .trim()
    .max(80, "출처 표기가 너무 깁니다.")
    .transform((v) => (v === "" ? DEFAULT_ANALYSIS_SOURCE : v)),
});

export async function saveDailyAnalysisAction(_prev: AnalysisFormState, formData: FormData): Promise<AnalysisFormState> {
  await requireAdmin("/admin/analysis");
  const raw = {
    date: text(formData, "date"),
    oneLine: text(formData, "oneLine"),
    body: text(formData, "body"),
    sourceLabel: text(formData, "sourceLabel"),
  };
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "입력을 확인하세요.", draft: raw };

  const findings = findUnsourcedScores(parsed.data.body);
  if (findings.length > 0 && text(formData, "acceptGuard") !== "1") {
    return {
      error: `산식 없는 점수 · Confidence로 보이는 줄 ${findings.length}개가 있어 저장하지 않았습니다. 지우고 다시 올리거나, 남은 줄이 출처 있는 사실이면 확인 표시를 하세요.`,
      findings,
      draft: raw,
    };
  }

  try {
    await saveDailyAnalysis(parsed.data);
  } catch (error) {
    console.error("[analysis] 그날의 분석 저장 실패", error);
    return { error: "저장하지 못했습니다. 잠시 뒤 다시 시도하세요.", draft: raw };
  }
  revalidatePath("/admin/analysis");
  revalidatePath("/");
  return { savedAt: new Date().toISOString() };
}

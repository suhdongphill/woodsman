"use server";

/**
 * 시세 수집 서버 액션.
 *
 * ⚠ `"use server"` 파일은 **async 함수만** export한다. 상수·타입은 `form-state.ts`로 뺀다
 *    (어기면 액션 호출이 500으로 죽는다 — 두 번 겪었다).
 * ⚠ `requireAdmin`을 먼저 부른다 — 미들웨어를 믿지 않는다(운영지침 §6).
 */
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { classifyQuotaError } from "@/lib/quota";
import { loadReportSummaries } from "@/features/reports/repository";
import { ingestQuotes } from "./ingest";
import { emptyQuoteFormState, type QuoteFormState } from "./form-state";

const ADMIN_PATH = "/admin/stocks";

/**
 * 보고서가 있는 종목 **전부**의 시세를 받는다.
 *
 * ⚠ 실패한 종목이 있어도 나머지는 그대로 저장된다. 다만 **몇 개가 왜 실패했는지 말한다** —
 *    "가져왔습니다"만 띄우면 절반이 실패한 것을 아무도 모른다(CLAUDE.md 3장).
 */
// ⚠ 인자를 받지 않는다. 이 액션은 이전 상태도 폼 값도 쓰지 않는다 —
//    `useActionState`는 인자가 적은 함수를 그대로 받아 준다.
export async function fetchAllQuotesAction(): Promise<QuoteFormState> {
  await requireAdmin(ADMIN_PATH);

  try {
    const summaries = await loadReportSummaries();
    if (summaries.length === 0) {
      return { ...emptyQuoteFormState, error: "보고서가 하나도 없습니다. 먼저 초안을 만드세요." };
    }

    const result = await ingestQuotes(
      summaries.map((s) => ({ ticker: s.ticker, market: s.market })),
      { trigger: "MANUAL" },
    );

    revalidatePath(ADMIN_PATH);

    const parts = [`${result.okCount}개 종목 · ${result.addedPoints}일치를 받았습니다.`];
    if (result.failCount > 0) {
      const reasons = result.detail
        .filter((d) => !d.ok)
        .map((d) => `${d.ticker}(${d.error ?? "이유 불명"})`)
        .join(" · ");
      parts.push(`⚠ ${result.failCount}개 실패 — ${reasons}`);
    }
    return { savedAt: new Date().toISOString(), notice: parts.join(" ") };
  } catch (error) {
    console.error("[stocks] 전체 시세 가져오기 실패", error);
    const verdict = classifyQuotaError(error);
    return {
      error:
        verdict.kind === "no"
          ? "시세를 가져오지 못했습니다. 서버 로그의 [stocks] 항목을 확인하세요."
          : `${verdict.title} ${verdict.action}`,
    };
  }
}

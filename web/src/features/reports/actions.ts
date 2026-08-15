"use server";

/**
 * 보고서 편집 서버 액션.
 *
 * ⚠ 모든 액션이 `requireAdmin`을 먼저 부른다 — 미들웨어를 믿지 않는다(운영지침 §6).
 *
 * ## ⚠ 저장은 막지 않고, 발행만 막는다
 * 쓰다 만 초안은 규율을 어겨도 저장돼야 한다. 저장이 막히면 아무도 안 쓴다.
 * **발행 시점에** `lib/report/rules.ts`가 판정하고, 차단 항목이 하나라도 있으면 발행하지 않는다.
 */
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { validateReport, publishBlockers } from "@/lib/report/rules";
import { classifyQuotaError } from "@/lib/quota";
import { viewDateKey } from "@/lib/analytics";
import {
  deleteReport,
  loadReport,
  replaceChecklist,
  saveReading,
  saveReport,
  setReportStatus,
} from "./repository";
import {
  emptyReportFormState,
  parseReadings,
  parseReportForm,
  type ReportFormState,
} from "./form-state";

const ADMIN_PATH = "/admin/stocks";

function ticketOf(form: FormData): string {
  const v = form.get("ticker");
  // ⚠ 문자열로만 다룬다. Number()로 만지면 005930 → 5930이 된다.
  return typeof v === "string" ? v.trim() : "";
}

function revalidate(ticker: string) {
  revalidatePath(ADMIN_PATH);
  revalidatePath(`${ADMIN_PATH}/${ticker}`);
  revalidatePath(`/stocks/${ticker}`);
}

/** 실패를 사람이 읽을 문장으로. ⚠ 한도 문제면 그렇다고 말해 준다. */
function failure(scope: string, error: unknown): ReportFormState {
  const verdict = classifyQuotaError(error);
  console.error(`[reports] ${scope} 실패`, error);

  if (verdict.kind === "yes") {
    return { error: `${verdict.title}. ${verdict.action} 자세한 상태는 /admin/diagnostics에서 봅니다.` };
  }
  if (verdict.kind === "unknown") {
    return { error: `저장하지 못했습니다. ${verdict.title} — /admin/diagnostics에서 사용량을 확인하세요.` };
  }
  return { error: "저장하지 못했습니다. 서버 로그의 [reports]·[d1] 항목을 확인하세요." };
}

export async function createReportAction(
  _prev: ReportFormState,
  formData: FormData,
): Promise<ReportFormState> {
  await requireAdmin(ADMIN_PATH);

  const ticker = ticketOf(formData);
  const name = String(formData.get("name") ?? "").trim();
  if (!ticker || !name) return { error: "티커와 종목명을 입력하세요." };

  try {
    if (await loadReport(ticker)) {
      return { error: `${ticker} 보고서가 이미 있습니다.` };
    }
    await saveReport({
      ...parseReportForm(formData, ticker),
      status: "DRAFT",
      blocks: [],
      checklist: [],
    });
  } catch (error) {
    return failure("보고서 생성", error);
  }

  revalidate(ticker);
  return { ...emptyReportFormState, savedAt: new Date().toISOString(), notice: `${ticker} 초안을 만들었습니다.` };
}

export async function saveReportAction(
  _prev: ReportFormState,
  formData: FormData,
): Promise<ReportFormState> {
  await requireAdmin(ADMIN_PATH);

  const ticker = ticketOf(formData);
  if (!ticker) return { error: "티커가 없습니다." };

  try {
    const draft = parseReportForm(formData, ticker);
    await saveReport(draft);

    // ⚠ CANSLIM 축은 행이 7개뿐이라 한 건씩 저장해도 무료 등급 쿼리 한도(50)에 여유가 있다.
    for (const reading of parseReadings(formData)) {
      await saveReading(ticker, reading);
    }
  } catch (error) {
    return failure("보고서 저장", error);
  }

  revalidate(ticker);
  return { savedAt: new Date().toISOString(), notice: "저장했습니다. 발행 전 규율 검증은 아래에서 봅니다." };
}

/**
 * 발행. ⚠ **규율 검증을 통과해야만** 상태가 바뀐다.
 * 검증은 화면이 아니라 여기서 다시 한다 — 화면을 우회한 요청도 막아야 한다.
 */
export async function publishReportAction(
  _prev: ReportFormState,
  formData: FormData,
): Promise<ReportFormState> {
  await requireAdmin(ADMIN_PATH);

  const ticker = ticketOf(formData);
  if (!ticker) return { error: "티커가 없습니다." };

  try {
    const stored = await loadReport(ticker);
    if (!stored) return { error: "보고서를 찾을 수 없습니다." };

    const blockers = publishBlockers(validateReport(stored, viewDateKey(new Date())));
    if (blockers.length > 0) {
      return {
        error: `규율 ${blockers.length}건이 남아 발행할 수 없습니다: ${blockers[0].message}`,
      };
    }
    await setReportStatus(ticker, "PUBLISHED");
  } catch (error) {
    return failure("발행", error);
  }

  revalidate(ticker);
  return { savedAt: new Date().toISOString(), notice: "발행했습니다." };
}

export async function unpublishReportAction(formData: FormData): Promise<void> {
  await requireAdmin(ADMIN_PATH);
  const ticker = ticketOf(formData);
  if (!ticker) return;

  await setReportStatus(ticker, "DRAFT");
  revalidate(ticker);
}

export async function deleteReportAction(formData: FormData): Promise<void> {
  await requireAdmin(ADMIN_PATH);
  const ticker = ticketOf(formData);
  if (!ticker) return;

  await deleteReport(ticker);
  revalidatePath(ADMIN_PATH);
  revalidatePath(`/stocks/${ticker}`);
}

/** 체크리스트만 갈아 끼운다. */
export async function replaceChecklistAction(formData: FormData): Promise<void> {
  await requireAdmin(ADMIN_PATH);
  const ticker = ticketOf(formData);
  if (!ticker) return;

  await replaceChecklist(ticker, parseReportForm(formData, ticker).checklist);
  revalidate(ticker);
}

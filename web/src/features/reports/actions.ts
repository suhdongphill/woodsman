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
import { marketAxisEvidence } from "@/lib/report/context";
import { classifyQuotaError } from "@/lib/quota";
import { viewDateKey } from "@/lib/analytics";
import { captureSiteContext } from "./context";
import { loadContext, saveContext } from "./context-repo";
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

/**
 * 사이트 자료 주입 — 거시 · 버블 · 대표 포트폴리오를 **지금 값으로 떠서 얼린다.**
 *
 * ⚠ 실시간으로 갖다 쓰지 않는 이유는 `lib/report/context.ts` 첫머리에 적었다:
 *    보고서는 날짜가 박힌 문서라, 논지가 참조한 숫자가 읽는 날마다 달라지면 안 된다.
 *    그래서 **사람이 누를 때만** 갱신된다.
 */
export async function injectContextAction(
  _prev: ReportFormState,
  formData: FormData,
): Promise<ReportFormState> {
  await requireAdmin(ADMIN_PATH);

  const ticker = ticketOf(formData);
  if (!ticker) return { error: "티커가 없습니다." };

  try {
    if (!(await loadReport(ticker))) return { error: "보고서를 찾을 수 없습니다." };

    const now = await captureSiteContext(ticker);
    await saveContext(ticker, { ...now, capturedAt: viewDateKey(new Date()) });
  } catch (error) {
    return failure("사이트 자료 주입", error);
  }

  revalidate(ticker);
  return {
    savedAt: new Date().toISOString(),
    notice: "사이트 자료를 이 보고서에 주입했습니다. 지금 값 기준으로 얼렸습니다.",
  };
}

/**
 * CANSLIM **M축의 근거·출처·기준일**만 주입한 자료로 채운다.
 *
 * ⚠ **점수는 채우지 않는다.** 이유는 `MARKET_AXIS_LIMITATION`에 적었다 —
 *    사이트의 거시 지표는 침체 신호를 재고, 오닐의 M축은 지수의 분산일·추세를 잰다.
 *    겹친다고 점수를 대신 매기면 다른 것을 잰 값이 M축 자리에 조용히 앉는다.
 * ⚠ 얼려 둔 스냅숏에서 채운다. 화면이 보여주는 숫자와 본문에 적히는 숫자가 갈리면 안 된다.
 */
export async function fillMarketAxisAction(
  _prev: ReportFormState,
  formData: FormData,
): Promise<ReportFormState> {
  await requireAdmin(ADMIN_PATH);

  const ticker = ticketOf(formData);
  if (!ticker) return { error: "티커가 없습니다." };

  try {
    const snapshot = await loadContext(ticker);
    if (!snapshot) return { error: "먼저 사이트 자료를 주입하세요." };

    const evidence = marketAxisEvidence(snapshot.macro);
    if (!evidence) {
      return {
        error:
          "거시 지표가 아직 수집되지 않아 채울 근거가 없습니다. /admin/macro에서 자료를 가져온 뒤 다시 주입하세요.",
      };
    }

    const stored = await loadReport(ticker);
    if (!stored) return { error: "보고서를 찾을 수 없습니다." };

    // ⚠ 점수와 태그는 **있던 것을 그대로 둔다.** 근거만 갈아 끼운다.
    const current = stored.readings.get("M");
    await saveReading(ticker, {
      key: "M",
      points: current?.points,
      tag: current?.tag ?? "na",
      evidence: evidence.evidence,
      source: evidence.source,
      sourceUrl: evidence.sourceUrl,
      asOf: evidence.asOf,
    });
  } catch (error) {
    return failure("M축 근거 주입", error);
  }

  revalidate(ticker);
  return {
    savedAt: new Date().toISOString(),
    notice: "M축의 근거·출처·기준일을 채웠습니다. ⚠ 점수는 사람이 넣습니다.",
  };
}

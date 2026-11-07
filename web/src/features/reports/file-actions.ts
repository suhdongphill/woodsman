"use server";

/**
 * 종목별 보고서 파일·블로그 연결 — 저장 · 공개 · 내리기 · 지우기.
 * ⚠ 이 파일은 async 함수만 export한다(상태 타입은 `file-form-state.ts`).
 * ⚠ 저장은 초안이다. 공개는 미리보기를 보고 사람이 누른다.
 */
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { recordAdminLog } from "@/features/admin-log/repository";
import {
  guessHeadline,
  normalizeTicker,
  parseReportFileName,
  REPORT_FILE_MAX_BYTES,
  reportFileProblems,
  sanitizeReportHtml,
} from "@/lib/report/file";
import { deleteReportFile, findReportFile, saveReportFile, setReportFileStatus } from "./file-repo";
import type { ReportFileFormState } from "./file-form-state";

const ADMIN_PATH = "/admin/stocks/files";

function revalidateAll(ticker: string) {
  for (const path of ["/stocks", "/portfolio", ADMIN_PATH, "/sitemap.xml"]) revalidatePath(path);
  revalidatePath(`/stocks/${ticker}`);
  revalidatePath(`${ADMIN_PATH}/${ticker}`);
}

const field = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

export async function saveReportFileAction(
  _prev: ReportFileFormState,
  formData: FormData,
): Promise<ReportFileFormState> {
  const admin = await requireAdmin(ADMIN_PATH);

  const file = formData.get("file");
  const upload = file instanceof File && file.size > 0 ? file : null;
  if (upload && upload.size > REPORT_FILE_MAX_BYTES) {
    return { error: `파일이 너무 큽니다(${Math.round(upload.size / 1024)}KB · 상한 512KB).` };
  }

  const fromName = upload ? parseReportFileName(upload.name) : {};
  const ticker = normalizeTicker(field(formData, "ticker") || fromName.ticker || "");
  const stored = ticker ? await findReportFile(ticker) : null;
  const html = upload ? sanitizeReportHtml(await upload.text()) : undefined;
  const name = field(formData, "name") || fromName.name || stored?.name || "";
  const headline = field(formData, "headline") || (html ? guessHeadline(html) : "") || stored?.headline || name;
  const blogUrl = field(formData, "blogUrl") || undefined;

  const problems = reportFileProblems({ ticker, name, headline, blogUrl, html, hasStoredHtml: !!stored?.hasHtml });
  if (problems.length) return { error: problems.join(" · ") };

  await saveReportFile({ ticker, name, headline, blogUrl: blogUrl ?? null, html, sourceName: upload?.name });
  await recordAdminLog({
    actor: admin.email,
    action: "report-file.save",
    target: ticker,
    summary: `${upload ? `파일 ${upload.name}` : "파일 그대로"} · 블로그 ${blogUrl ? "있음" : "없음"}`,
  });
  revalidateAll(ticker);
  return { savedTicker: ticker };
}

function tickerOf(formData: FormData): string {
  return normalizeTicker(field(formData, "ticker"));
}

export async function publishReportFileAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin(ADMIN_PATH);
  const ticker = tickerOf(formData);
  if (!ticker) return;
  await setReportFileStatus(ticker, "PUBLISHED");
  await recordAdminLog({ actor: admin.email, action: "report-file.publish", target: ticker });
  revalidateAll(ticker);
}

export async function unpublishReportFileAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin(ADMIN_PATH);
  const ticker = tickerOf(formData);
  if (!ticker) return;
  await setReportFileStatus(ticker, "DRAFT");
  await recordAdminLog({ actor: admin.email, action: "report-file.unpublish", target: ticker });
  revalidateAll(ticker);
}

export async function deleteReportFileAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin(ADMIN_PATH);
  const ticker = tickerOf(formData);
  if (!ticker) return;
  await deleteReportFile(ticker);
  await recordAdminLog({ actor: admin.email, action: "report-file.delete", target: ticker });
  revalidateAll(ticker);
}

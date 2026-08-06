"use server";

/**
 * 대표 포트폴리오 · 리밸런싱 서버 액션.
 *
 * 목표 비중을 고칠 수 있게 만드는 경로다. 전에는 화면이 목업 파일을 읽어서
 * **편집 자체가 불가능**했다(버튼은 있었지만 아무 데도 연결돼 있지 않았다).
 *
 * ⚠ 모든 액션이 `requireAdmin`을 먼저 부른다. 미들웨어는 1차 방어선일 뿐이라
 *    액션 자체가 스스로 확인해야 한다(matcher를 고치는 순간 구멍이 난다).
 */
import { revalidatePath } from "next/cache";
import {
  deleteHolding,
  deleteRebalance,
  findHolding,
  nextHoldingOrder,
  saveHolding,
  saveRebalance,
} from "./repository";
import { firstIssue, holdingSchema, rebalanceSchema } from "./schema";
import { emptyPortfolioFormState, type PortfolioFormState } from "./form-state";
import { requireAdmin } from "@/lib/session";

function text(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

function checked(formData: FormData, key: string): boolean {
  const v = formData.get(key);
  return v === "on" || v === "true";
}

/** 저장 후 공개 화면까지 갱신한다 — 관리자만 바뀌고 사이트는 그대로면 고친 줄 모른다. */
function revalidateAll() {
  revalidatePath("/admin/model-portfolio");
  revalidatePath("/portfolio");
  revalidatePath("/");
}

/**
 * 순서를 비워 두면: 새 종목은 목록 끝에, 수정 중이면 **원래 자리 그대로**.
 * 빈 칸을 0으로 치면 수정할 때마다 종목이 맨 앞으로 튀어 오른다.
 */
async function resolveOrder(order: number | undefined, id?: string): Promise<number> {
  if (order !== undefined) return order;
  if (id) {
    const current = await findHolding(id);
    if (current) return current.order;
  }
  return nextHoldingOrder();
}

export async function saveHoldingAction(
  _prev: PortfolioFormState,
  formData: FormData,
): Promise<PortfolioFormState> {
  await requireAdmin("/admin/model-portfolio");

  const parsed = holdingSchema.safeParse({
    name: text(formData, "name"),
    ticker: text(formData, "ticker"),
    market: text(formData, "market"),
    functionType: text(formData, "functionType"),
    targetWeight: text(formData, "targetWeight"),
    avgCost: text(formData, "avgCost"),
    shares: text(formData, "shares"),
    currency: text(formData, "currency") || "KRW",
    price: text(formData, "price"),
    priceAsOf: text(formData, "priceAsOf"),
    thesis: text(formData, "thesis"),
    canslim: text(formData, "canslim"),
    blogUrl: text(formData, "blogUrl"),
    order: text(formData, "order"),
    published: checked(formData, "published"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const id = text(formData, "id") || undefined;
  try {
    await saveHolding({ ...parsed.data, order: await resolveOrder(parsed.data.order, id) }, id);
  } catch (error) {
    console.error("[portfolio] 종목 저장 실패", error);
    return { error: "저장하지 못했습니다. 잠시 후 다시 시도하세요." };
  }

  revalidateAll();
  return { savedAt: new Date().toISOString(), ...emptyPortfolioFormState };
}

export async function deleteHoldingAction(formData: FormData): Promise<void> {
  await requireAdmin("/admin/model-portfolio");
  const id = text(formData, "id");
  if (!id) return;

  await deleteHolding(id);
  revalidateAll();
}

export async function saveRebalanceAction(
  _prev: PortfolioFormState,
  formData: FormData,
): Promise<PortfolioFormState> {
  await requireAdmin("/admin/model-portfolio");

  const parsed = rebalanceSchema.safeParse({
    date: text(formData, "date"),
    memo: text(formData, "memo"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  try {
    await saveRebalance(parsed.data, text(formData, "id") || undefined);
  } catch (error) {
    console.error("[portfolio] 리밸런싱 기록 저장 실패", error);
    return { error: "저장하지 못했습니다. 날짜 형식을 확인하세요." };
  }

  revalidateAll();
  return { savedAt: new Date().toISOString() };
}

export async function deleteRebalanceAction(formData: FormData): Promise<void> {
  await requireAdmin("/admin/model-portfolio");
  const id = text(formData, "id");
  if (!id) return;

  await deleteRebalance(id);
  revalidateAll();
}

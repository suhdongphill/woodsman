"use server";

/** 주도주 최신화 요청. ⚠ 이 파일은 async 함수만 export한다. */
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { recordAdminLog } from "@/features/admin-log/repository";
import { refreshView } from "@/lib/leaders/refresh";
import { createRefreshRequest, loadRefreshRequests } from "./refresh-repo";

export async function requestLeaderRefreshAction(): Promise<void> {
  const admin = await requireAdmin("/admin/leaders");
  const [latest] = await loadRefreshRequests(1);
  // ⚠ 화면의 버튼만 믿지 않는다 — 두 번 눌러도 한 번만 돈다.
  if (!refreshView(latest, new Date()).canRequest) return;
  await createRefreshRequest(admin.email ?? "admin");
  await recordAdminLog({ actor: admin.email, action: "leaders.refresh-request", target: "LeaderRun" });
  revalidatePath("/admin/leaders");
}

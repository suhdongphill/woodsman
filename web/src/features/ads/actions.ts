"use server";

/**
 * 광고 설정 서버 액션.
 *
 * ⚠ `requireAdmin`을 먼저 부른다.
 * ⚠ 이 파일은 async 함수만 export한다(상수·타입은 `form-state.ts`).
 */
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { isValidClientId, isValidSlotId } from "@/lib/ads";
import { saveAdsSettings } from "@/lib/site-settings";
import { recordAdminLog } from "@/features/admin-log/repository";
import { emptyAdsFormState, type AdsFormState } from "./form-state";

function text(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function checked(formData: FormData, key: string): boolean {
  const v = formData.get(key);
  return v === "on" || v === "true";
}

/** 빈 칸은 null로. ⚠ 빈 문자열을 저장하면 "설정했는데 형식이 틀린 값"처럼 보인다. */
function orNull(value: string): string | null {
  return value === "" ? null : value;
}

export async function saveAdsAction(
  _prev: AdsFormState,
  formData: FormData,
): Promise<AdsFormState> {
  const admin = await requireAdmin("/admin/ads");

  const clientId = text(formData, "clientId");
  if (clientId && !isValidClientId(clientId)) {
    return { error: "퍼블리셔 ID는 ca-pub- 으로 시작하는 숫자여야 합니다." };
  }

  const slots = {
    articleEnd: text(formData, "articleEnd"),
    feedEnd: text(formData, "feedEnd"),
    contentBottom: text(formData, "contentBottom"),
  };
  for (const [key, value] of Object.entries(slots)) {
    if (value && !isValidSlotId(value)) {
      return { error: `슬롯 ID(${key})는 숫자만 넣습니다.` };
    }
  }

  const enabled = checked(formData, "enabled");
  /**
   * ⚠ **퍼블리셔 ID 없이 켜지 못하게 막는다.**
   *    켜 두고 ID가 없으면 "켰는데 왜 안 나오지"를 한참 뒤진다 — 여기서 이유를 말해 준다.
   */
  if (enabled && !clientId) {
    return { error: "퍼블리셔 ID를 먼저 넣어야 광고를 켤 수 있습니다." };
  }

  try {
    await saveAdsSettings({
      enabled,
      clientId: orNull(clientId),
      articleEnd: orNull(slots.articleEnd),
      feedEnd: orNull(slots.feedEnd),
      contentBottom: orNull(slots.contentBottom),
    });
  } catch (error) {
    console.error("[ads] 저장 실패", error);
    return { error: "저장하지 못했습니다. 잠시 후 다시 시도하세요." };
  }

  await recordAdminLog({
    actor: admin.email,
    action: "ads.settings",
    // ⚠ 값이 아니라 **상태**만 남긴다. 로그가 설정값을 다시 흘리지 않게.
    summary: `광고 ${enabled ? "켬" : "끔"} · 퍼블리셔 ${clientId ? "등록됨" : "없음"}`,
  });

  // 광고는 거의 모든 공개 화면에 걸린다.
  for (const path of ["/", "/insights", "/macro", "/portfolio", "/journal", "/stocks", "/ads.txt"]) {
    revalidatePath(path);
  }
  revalidatePath("/admin/ads");

  return { ...emptyAdsFormState, savedAt: new Date().toISOString(), enabled };
}

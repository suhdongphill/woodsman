"use server";

/**
 * 사이트 기본값 저장.
 *
 * "처음 개발할 때 코드에 박아 둔 값"을 화면에서 고칠 수 있게 하는 경로다.
 *
 * ⚠ 티스토리 주소는 `/go/*`의 목적지가 된다. `sanitizeUrl`을 통과하지 못한 값은
 *    저장하지 않고 되돌린다 — 통과 못 한 값을 그냥 넣으면 오픈 리다이렉트가 된다.
 */
import { revalidatePath } from "next/cache";
import { saveSiteBasics } from "./repository";
import { emptySiteFormState, type SiteFormState } from "./form-state";
import { sanitizeEmail, sanitizeRate, sanitizeUrl } from "@/lib/site-basics";
import { normalizeDataMode } from "@/lib/data-mode";
import { requireAdmin } from "@/lib/session";

function text(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

/** 빈 칸은 null로 저장해 코드 기본값으로 되돌린다. */
function orNull(value: string): string | null {
  return value === "" ? null : value;
}

export async function saveSiteBasicsAction(
  _prev: SiteFormState,
  formData: FormData,
): Promise<SiteFormState> {
  await requireAdmin("/admin/settings");

  const rawEmail = text(formData, "contactEmail");
  if (rawEmail && !sanitizeEmail(rawEmail)) {
    return { error: "문의 메일 형식이 올바르지 않습니다." };
  }

  const urls = {
    tistoryBlogUrl: text(formData, "tistoryBlogUrl"),
    tistoryFeaturedUrl: text(formData, "tistoryFeaturedUrl"),
    tistoryRssUrl: text(formData, "tistoryRssUrl"),
  };
  for (const [key, value] of Object.entries(urls)) {
    if (value && !sanitizeUrl(value)) {
      return { error: `${key}: http(s)로 시작하는 주소만 넣을 수 있습니다.` };
    }
  }

  const rawRate = text(formData, "usdKrwRate");
  const rate = rawRate === "" ? undefined : sanitizeRate(Number(rawRate));
  if (rawRate !== "" && rate === null) {
    return { error: "기준 환율은 0보다 큰 숫자여야 합니다." };
  }

  try {
    await saveSiteBasics({
      dataMode: normalizeDataMode(text(formData, "dataMode")),
      usdKrwRate: rate ?? undefined,
      contactEmail: orNull(rawEmail) as never,
      tistoryBlogUrl: orNull(urls.tistoryBlogUrl) as never,
      tistoryFeaturedUrl: orNull(urls.tistoryFeaturedUrl) as never,
      tistoryRssUrl: orNull(urls.tistoryRssUrl) as never,
      featuredTitle: orNull(text(formData, "featuredTitle")) as never,
      featuredExcerpt: orNull(text(formData, "featuredExcerpt")) as never,
      heroTitle: orNull(text(formData, "heroTitle")) as never,
      heroSubtitle: orNull(text(formData, "heroSubtitle")) as never,
    });
  } catch (error) {
    console.error("[site] 기본값 저장 실패", error);
    return { error: "저장하지 못했습니다." };
  }

  // 기본값은 거의 모든 화면에 나오므로 전부 갱신한다.
  for (const path of ["/", "/portfolio", "/journal", "/about", "/privacy", "/disclaimer", "/admin/settings"]) {
    revalidatePath(path);
  }

  return { ...emptySiteFormState, savedAt: new Date().toISOString() };
}

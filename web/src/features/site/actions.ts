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
import { saveSiteBasics, saveSiteFlags } from "./repository";
import { emptySiteFormState, type SiteFormState } from "./form-state";

import { recordAdminLog } from "@/features/admin-log/repository";
import { sanitizeEmail, sanitizeRate, sanitizeUrl } from "@/lib/site-basics";
import { normalizeDataMode } from "@/lib/data-mode";
import { requireAdmin } from "@/lib/session";

function text(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

/** 토글은 켜졌을 때만 값이 온다. 안 온 것은 꺼진 것이다. */
function switched(formData: FormData, key: string): boolean {
  const v = formData.get(key);
  return v === "on" || v === "true";
}

/** 빈 칸은 null로 저장해 코드 기본값으로 되돌린다. */
function orNull(value: string): string | null {
  return value === "" ? null : value;
}

export async function saveSiteBasicsAction(
  _prev: SiteFormState,
  formData: FormData,
): Promise<SiteFormState> {
  const admin = await requireAdmin("/admin/settings");

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

  // ⚠ 환율·모의/실계좌처럼 **숫자의 뜻을 바꾸는 값**이다. 언제 누가 바꿨는지가 남아야
  //    나중에 "그때 평가액이 왜 저랬나"를 되짚을 수 있다.
  await recordAdminLog({
    actor: admin.email,
    action: "site.basics",
    summary: `계좌 성격 ${normalizeDataMode(text(formData, "dataMode"))}${rate ? ` · 기준환율 ${rate}` : ""}`,
  });

  // 기본값은 거의 모든 화면에 나오므로 전부 갱신한다.
  for (const path of ["/", "/portfolio", "/journal", "/about", "/privacy", "/disclaimer", "/admin/settings"]) {
    revalidatePath(path);
  }

  return { ...emptySiteFormState, savedAt: new Date().toISOString() };
}

/**
 * 사이트 개방·댓글 정책 스위치 저장.
 *
 * 전에는 이 토글들이 `defaultOn`만 받는 목업이라 **켜도 아무 일도 일어나지 않았다.**
 * 관리자가 "커뮤니티를 열었다"고 믿고 넘어가는 것이 이 버그의 실제 값이었다.
 *
 * ⚠ 가입을 여는 순간 `/privacy`가 형식 미비가 된다(지금 "회원정보를 수집하지 않는다"고
 *   적혀 있다). 화면에 경고를 띄우는 것으로 끝내지 않고 여기 주석에도 남긴다.
 */
export async function saveSiteFlagsAction(
  _prev: SiteFormState,
  formData: FormData,
): Promise<SiteFormState> {
  await requireAdmin("/admin/comments");

  try {
    await saveSiteFlags({
      signupEnabled: switched(formData, "signupEnabled"),
      communityEnabled: switched(formData, "communityEnabled"),
      commentsGloballyEnabled: switched(formData, "commentsGloballyEnabled"),
      requireLoginToComment: switched(formData, "requireLoginToComment"),
      moderationOn: switched(formData, "moderationOn"),
      bannedWords: text(formData, "bannedWords"),
    });
  } catch (error) {
    console.error("[site] 정책 스위치 저장 실패", error);
    return { error: "저장하지 못했습니다." };
  }

  // 스위치는 내비게이션·댓글·가입 화면을 한꺼번에 바꾼다.
  for (const path of ["/", "/admin/comments", "/board", "/register", "/login"]) {
    revalidatePath(path);
  }
  revalidatePath("/insights/[slug]", "page");

  return { ...emptySiteFormState, savedAt: new Date().toISOString() };
}

"use server";

/**
 * 콘텐츠 서버 액션 — 글 저장·삭제.
 *
 * ⚠ `requireAdmin`을 먼저 부른다. 글을 쓰는 경로라 뚫리면 사이트가 통째로 남의 것이 된다.
 * ⚠ 본문은 **여기서 한 번만** 변환·정화한다(`renderBody`). 화면은 그 결과를 믿고 그린다.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { deletePost, savePost, takenSlugs } from "./repository";
import { nextAvailableSlug } from "@/lib/slug";
import { postSummary } from "@/lib/admin-log";
import { recordAdminLog } from "@/features/admin-log/repository";
import { deriveExcerpt, firstIssue, postSchema, renderBody } from "./schema";
import { emptyPostFormState, type PostFormState } from "./form-state";

function text(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

function checked(formData: FormData, key: string): boolean {
  const v = formData.get(key);
  return v === "on" || v === "true";
}

/** 글 하나가 여러 화면에 나간다 — 섹션 프레임과 홈까지 같이 갱신한다. */
function revalidateAll(slug?: string) {
  revalidatePath("/admin/posts");
  revalidatePath("/admin/posts/edit");
  revalidatePath("/insights");
  revalidatePath("/macro");
  revalidatePath("/portfolio");
  revalidatePath("/journal");
  revalidatePath("/");
  if (slug) revalidatePath(`/insights/${slug}`);
}

export async function savePostAction(
  _prev: PostFormState,
  formData: FormData,
): Promise<PostFormState> {
  const admin = await requireAdmin("/admin/posts");

  const parsed = postSchema.safeParse({
    slug: text(formData, "slug"),
    title: text(formData, "title"),
    type: text(formData, "type"),
    section: text(formData, "section"),
    category: text(formData, "category"),
    excerpt: text(formData, "excerpt"),
    body: text(formData, "body"),
    format: text(formData, "format") || "MARKDOWN",
    source: text(formData, "source") || "SELF",
    externalUrl: text(formData, "externalUrl"),
    ticker: text(formData, "ticker"),
    tags: text(formData, "tags"),
    commentsEnabled: checked(formData, "commentsEnabled"),
    published: checked(formData, "published"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const id = text(formData, "id") || undefined;

  try {
    /**
     * ⚠ 주소가 겹쳐도 **저장을 막지 않는다.** 예전에는 오류로 돌려보냈는데, 그러면 쓰던 사람이
     *    주소를 손으로 고쳐야 했고 — 그게 "편집이 안 된다"고 느끼게 만드는 또 하나의 벽이었다.
     *    비켜서 저장하고, **비켰다는 사실을 반드시 알린다**(조용히 바꾸지 않는다).
     */
    const wanted = parsed.data.slug;
    const slug = nextAvailableSlug(wanted, await takenSlugs(wanted, id));
    const slugAdjusted = slug !== wanted;

    const bodyHtml = renderBody(parsed.data.body, parsed.data.format);
    const savedId = await savePost(
      {
        ...parsed.data,
        slug,
        bodyHtml,
        excerpt: deriveExcerpt(parsed.data.excerpt, bodyHtml),
      },
      id,
    );

    // ⚠ 되돌아보려면 "무엇을 했는가"가 남아야 한다(2026-08-30 사고). 기록 실패는
    //    하던 일을 막지 않는다 — repository가 삼키고 로그로 남긴다.
    await recordAdminLog({
      actor: admin.email,
      action: id ? "post.update" : "post.create",
      target: savedId,
      summary: postSummary(parsed.data.title, parsed.data.published),
    });

    revalidateAll(slug);

    if (!id) {
      // 새 글은 저장과 동시에 **수정 화면**으로 넘어간다.
      // 그대로 두면 빈 새 글 폼처럼 보여서 같은 글을 또 쓰게 된다.
      redirect(
        `/admin/posts/edit?id=${encodeURIComponent(savedId)}` +
          (slugAdjusted ? "&slugAdjusted=1" : ""),
      );
    }

    return {
      ...emptyPostFormState,
      savedAt: new Date().toISOString(),
      savedId,
      published: parsed.data.published,
      slugAdjusted: slugAdjusted ? slug : undefined,
    };
  } catch (error) {
    // ⚠ redirect()는 예외로 흐름을 끊는다 — 삼키면 화면이 멈춘다.
    if (error && typeof error === "object" && "digest" in error &&
        String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")) {
      throw error;
    }
    console.error("[posts] 저장 실패", error);
    return { error: "저장하지 못했습니다. 잠시 후 다시 시도하세요." };
  }
}

export async function deletePostAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin("/admin/posts");
  const id = text(formData, "id");
  if (!id) return;

  await deletePost(id);
  await recordAdminLog({ actor: admin.email, action: "post.delete", target: id });
  revalidateAll();
}

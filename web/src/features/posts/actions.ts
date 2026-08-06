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
import { deletePost, savePost, slugTaken } from "./repository";
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
  await requireAdmin("/admin/posts");

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
    if (await slugTaken(parsed.data.slug, id)) {
      return { error: `주소 "${parsed.data.slug}"는 다른 글이 쓰고 있습니다.` };
    }

    const bodyHtml = renderBody(parsed.data.body, parsed.data.format);
    const savedId = await savePost(
      {
        ...parsed.data,
        bodyHtml,
        excerpt: deriveExcerpt(parsed.data.excerpt, bodyHtml),
      },
      id,
    );

    revalidateAll(parsed.data.slug);

    if (!id) {
      // 새 글은 저장과 동시에 **수정 화면**으로 넘어간다.
      // 그대로 두면 빈 새 글 폼처럼 보여서 같은 글을 또 쓰게 된다.
      redirect(`/admin/posts?edit=${savedId}`);
    }

    return {
      ...emptyPostFormState,
      savedAt: new Date().toISOString(),
      savedId,
      published: parsed.data.published,
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
  await requireAdmin("/admin/posts");
  const id = text(formData, "id");
  if (!id) return;

  await deletePost(id);
  revalidateAll();
}

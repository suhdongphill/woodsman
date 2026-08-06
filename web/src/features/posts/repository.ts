/**
 * 콘텐츠(Post)의 DB 접근.
 *
 * ## 왜 이걸 만들었나
 * 투자일지·대표 포트폴리오에서 두 번 겪은 것과 **같은 사고**가 여기 남아 있었다.
 * `/admin/posts`가 `lib/mock.ts`를 읽고 있어서 "새 글" 버튼이 아무 데도 연결돼 있지 않았다.
 * 글을 쓸 수 없으면 이 사이트는 굴러가지 않는다(1순위 목적이 블로그 유입인데,
 * 그 통로가 목업이었다).
 *
 * ⚠ `bodyHtml`은 **원본(`body`)에서 만든 결과**다. 저장할 때만 채운다(actions.ts).
 *    여기로 직접 HTML을 넣는 경로를 만들지 않는다 — 정화를 건너뛴 HTML이 화면에 꽂힌다.
 */
import { execute, queryAll, queryOne, toBool } from "@/lib/d1";
import type { Post, PostSection, PostSource, PostType } from "@/lib/types";

function dayOf(value: string | null): string | undefined {
  return value ? String(value).slice(0, 10) : undefined;
}

type PostRow = {
  id: string;
  slug: string;
  type: string;
  category: string | null;
  title: string;
  excerpt: string | null;
  body: string | null;
  format: string;
  bodyHtml: string | null;
  section: string;
  thumbnailUrl: string | null;
  source: string;
  externalUrl: string | null;
  ticker: string | null;
  tags: string | null;
  commentsEnabled: number;
  published: number;
  viewCount: number;
  publishedAt: string | null;
  updatedAt: string;
};

function toPost(row: PostRow): Post {
  return {
    id: row.id,
    slug: row.slug,
    type: row.type as PostType,
    category: row.category ?? undefined,
    title: row.title,
    excerpt: row.excerpt ?? undefined,
    body: row.body ?? undefined,
    format: row.format === "HTML" ? "HTML" : "MARKDOWN",
    bodyHtml: row.bodyHtml ?? undefined,
    section: row.section as PostSection,
    thumbnailUrl: row.thumbnailUrl ?? undefined,
    source: row.source as PostSource,
    externalUrl: row.externalUrl ?? undefined,
    ticker: row.ticker ?? undefined,
    tags: row.tags ?? undefined,
    commentsEnabled: toBool(row.commentsEnabled),
    published: toBool(row.published),
    viewCount: row.viewCount,
    publishedAt: dayOf(row.publishedAt),
    updatedAt: row.updatedAt,
    commentCount: 0,
  };
}

const COLUMNS = `id, slug, type, category, title, excerpt, body, format, bodyHtml, section,
       thumbnailUrl, source, externalUrl, ticker, tags, commentsEnabled, published,
       viewCount, publishedAt, updatedAt`;

/** 공개 목록 — 발행된 것만, 최신순. */
export async function loadPublishedPosts(limit = 50): Promise<Post[]> {
  const rows = await queryAll<PostRow>(
    `SELECT ${COLUMNS} FROM Post WHERE published = 1
      ORDER BY COALESCE(publishedAt, updatedAt) DESC LIMIT ?`,
    [limit],
  );
  return rows.map(toPost);
}

/**
 * 섹션 프레임용 — 그 섹션에 발행된 글만.
 *
 * 발행할 때마다 해당 섹션에 한 편씩 쌓인다. 화면은 이 목록을 그대로 이어 붙인다.
 */
export async function loadSectionPosts(section: PostSection, limit = 10): Promise<Post[]> {
  const rows = await queryAll<PostRow>(
    `SELECT ${COLUMNS} FROM Post WHERE published = 1 AND section = ?
      ORDER BY COALESCE(publishedAt, updatedAt) DESC LIMIT ?`,
    [section, limit],
  );
  return rows.map(toPost);
}

/** 관리자 목록 — 미발행 포함. */
export async function loadAllPosts(limit = 200): Promise<Post[]> {
  const rows = await queryAll<PostRow>(
    `SELECT ${COLUMNS} FROM Post ORDER BY updatedAt DESC LIMIT ?`,
    [limit],
  );
  return rows.map(toPost);
}

export async function findPost(id: string): Promise<Post | null> {
  const row = await queryOne<PostRow>(`SELECT ${COLUMNS} FROM Post WHERE id = ?`, [id]);
  return row ? toPost(row) : null;
}

export async function findPostBySlug(slug: string): Promise<Post | null> {
  const row = await queryOne<PostRow>(`SELECT ${COLUMNS} FROM Post WHERE slug = ?`, [slug]);
  return row ? toPost(row) : null;
}

/** slug 중복 확인 — 다른 글이 이미 쓰고 있으면 true. */
export async function slugTaken(slug: string, exceptId?: string): Promise<boolean> {
  const row = await queryOne<{ id: string }>(`SELECT id FROM Post WHERE slug = ?`, [slug]);
  return !!row && row.id !== exceptId;
}

export type PostInput = {
  slug: string;
  type: PostType;
  section: PostSection;
  category?: string;
  title: string;
  excerpt?: string;
  body?: string;
  format: "MARKDOWN" | "HTML";
  /** ⚠ 저장 직전에 만들어 넘긴 결과 HTML(정화 완료) */
  bodyHtml?: string;
  source: PostSource;
  externalUrl?: string;
  ticker?: string;
  tags?: string;
  commentsEnabled: boolean;
  published: boolean;
};

export async function savePost(input: PostInput, id?: string): Promise<string> {
  const now = new Date().toISOString();
  const values = [
    input.slug,
    input.type,
    input.section,
    input.category ?? null,
    input.title,
    input.excerpt ?? null,
    input.body ?? null,
    input.format,
    input.bodyHtml ?? null,
    input.source,
    input.externalUrl ?? null,
    input.ticker ?? null,
    input.tags ?? null,
    input.commentsEnabled ? 1 : 0,
    input.published ? 1 : 0,
    now,
  ];

  if (id) {
    await execute(
      `UPDATE Post SET slug = ?, type = ?, section = ?, category = ?, title = ?, excerpt = ?,
              body = ?, format = ?, bodyHtml = ?, source = ?, externalUrl = ?, ticker = ?,
              tags = ?, commentsEnabled = ?, published = ?, updatedAt = ?,
              publishedAt = CASE WHEN ? = 1 AND publishedAt IS NULL THEN ? ELSE publishedAt END
         WHERE id = ?`,
      [...values, input.published ? 1 : 0, now, id],
    );
    return id;
  }

  const newId = `po_${now}_${Math.floor(performance.now())}`;
  await execute(
    `INSERT INTO Post
       (id, slug, type, section, category, title, excerpt, body, format, bodyHtml, source,
        externalUrl, ticker, tags, commentsEnabled, published, updatedAt, publishedAt, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [newId, ...values, input.published ? now : null, now],
  );
  return newId;
}

export async function deletePost(id: string): Promise<void> {
  await execute(`DELETE FROM Post WHERE id = ?`, [id]);
}

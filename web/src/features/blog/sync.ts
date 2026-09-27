/**
 * 티스토리 블로그 목록 수집 — 매일 06:00 예약 수집의 `blog` 작업, 그리고 관리자 「지금 수집」 버튼이 **같은 함수**를 부른다.
 *
 * 순서: 사이트맵(전체 글 주소) → 새 글·오래된 글만 페이지를 읽어 메타 해석 → 모든 글의 공감 수(GET) → 저장 → 기록.
 *
 * ⚠ 공감은 **GET만** 쓴다. `POST /reaction`은 공감 누르기다(2026-09-27 조사 중 실제로 한 번 눌렸다).
 * ⚠ 글 하나가 실패해도 나머지는 간다. 실패는 `BlogSync`와 로그 양쪽에 남긴다(조용한 실패 금지, CLAUDE.md §3).
 * ⚠ 사이트맵에서 글이 0편이면 **실패**다 — 「글이 없다」가 아니라 형식이 바뀌었거나 막힌 것이다.
 * ⚠ 이 작업이 실패해도 거시 수집·GCRM은 이미 끝나 있다(예약 수집에서 **맨 뒤**에 돈다).
 */
import { getSiteBasics } from "@/lib/site-settings";
import { parseEntryPage, parseReactionSum, parseSitemapEntries, type ParsedBlogEntry } from "@/lib/blog/tistory";
import { loadKnownPages, saveBlogSync, updateBlogLikes, upsertBlogPages, type BlogSyncRecord } from "./repository";

/** 이만큼 지난 글 페이지는 다시 읽는다 — 제목·요약·카테고리 수정이 늦어도 일주일 안에 반영된다. */
export const PAGE_REFRESH_DAYS = 7;
/** 동시에 보내는 요청 수. ⚠ 남의 서버다(내 블로그라도) — 한꺼번에 두드리지 않는다. */
const CONCURRENCY = 4;
const TIMEOUT_MS = 15_000;
const UA = "Mozilla/5.0 (compatible; WoodsmanBot/1.0; +https://portfolio-solutions.net)";

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { "user-agent": UA } });
    if (!res.ok) throw new Error(`응답 ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/** 작업을 `CONCURRENCY`개씩 돌린다. 결과 순서는 입력 순서와 같다. */
async function pool<T, R>(items: T[], run: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await run(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker));
  return out;
}

/**
 * 블로그 주소에서 origin을 뽑는다. ⚠ 해석 규칙이 티스토리 전용이라 티스토리가 아니면 **멈춘다**
 * (다른 플랫폼으로 옮겼는데 조용히 0편이 되는 것보다, 이유를 말하고 실패하는 편이 낫다).
 */
export function blogOrigin(blogUrl: string): string {
  const u = new URL(blogUrl);
  if (u.protocol !== "https:" || !u.hostname.endsWith(".tistory.com")) {
    throw new Error(`블로그 주소가 티스토리가 아니다(${u.hostname}) — 수집 규칙(lib/blog/tistory.ts)을 먼저 바꿔야 한다`);
  }
  return u.origin;
}

export async function syncBlog(trigger: "CRON" | "MANUAL"): Promise<BlogSyncRecord> {
  const record: BlogSyncRecord = {
    id: crypto.randomUUID(),
    trigger,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    found: 0,
    added: 0,
    refreshed: 0,
    likesRead: 0,
    failCount: 0,
    failures: [],
    error: null,
  };
  const fail = (url: string, reason: string) => {
    record.failures.push({ url, reason });
    record.failCount += 1;
  };

  try {
    const origin = blogOrigin((await getSiteBasics()).tistoryBlogUrl);
    const urls = parseSitemapEntries(await fetchText(`${origin}/sitemap.xml`), origin);
    record.found = urls.length;
    if (urls.length === 0) throw new Error("사이트맵에서 글을 한 편도 찾지 못했다 — 형식이 바뀌었거나 막혔을 수 있다");

    const known = await loadKnownPages();
    const staleBefore = Date.now() - PAGE_REFRESH_DAYS * 86_400_000;
    const toRead = urls.filter((u) => {
      const k = known.get(u);
      return !k || Date.parse(k.pageFetchedAt) < staleBefore;
    });

    const parsed = await pool(toRead, async (url): Promise<ParsedBlogEntry | null> => {
      try {
        const r = parseEntryPage(await fetchText(url), url);
        if (!r.ok) {
          fail(url, r.reason);
          return null;
        }
        return r.entry;
      } catch (error) {
        fail(url, error instanceof Error ? error.message : String(error));
        return null;
      }
    });
    const pages = parsed.filter((p): p is ParsedBlogEntry => p !== null);
    const fetchedAt = new Date().toISOString();
    await upsertBlogPages(pages, fetchedAt);
    record.added = pages.filter((p) => !known.has(p.url)).length;
    record.refreshed = pages.length - record.added;

    // 공감 — 사이트맵에 **지금 있는** 글만(지워진 글은 읽지 않는다).
    const ids = new Set<number>(pages.map((p) => p.entryId));
    for (const u of urls) {
      const k = known.get(u);
      if (k) ids.add(k.entryId);
    }
    const likes = await pool([...ids], async (entryId) => {
      try {
        const res = await fetchText(`${origin}/reaction?entryId=${entryId}`);
        const sum = parseReactionSum(JSON.parse(res));
        if (sum === null) {
          fail(`${origin}/reaction?entryId=${entryId}`, "공감 수를 읽지 못했다(응답 모양이 다르다)");
          return null;
        }
        return { entryId, likes: sum };
      } catch (error) {
        fail(`${origin}/reaction?entryId=${entryId}`, error instanceof Error ? error.message : String(error));
        return null;
      }
    });
    const read = likes.filter((l): l is { entryId: number; likes: number } => l !== null);
    await updateBlogLikes(read, new Date().toISOString());
    record.likesRead = read.length;
  } catch (error) {
    record.error = error instanceof Error ? error.message : String(error);
    console.error("[blog] 수집 실패", error);
  }

  record.finishedAt = new Date().toISOString();
  if (record.failCount > 0) console.error(`[blog] 일부 실패 ${record.failCount}건`, record.failures.slice(0, 5));
  try {
    await saveBlogSync(record);
  } catch (error) {
    // ⚠ 기록을 못 남긴 것도 남긴다 — 이 기록이 「안 돌았다」와 「돌았다」를 가르는 유일한 근거다.
    console.error("[blog] 수집 기록을 저장하지 못했다", error);
  }
  return record;
}

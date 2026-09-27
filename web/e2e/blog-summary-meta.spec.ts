import { expect, test } from "@playwright/test";

/**
 * 블로그 요약 · 공유 메타 — 2026-09-27 (80) 운영자 사양 「매체 수준으로 정리」.
 *
 * 수용 기준:
 * - /blog 모든 카드 요약이 「WOODSMAN ·」이나 날짜로 시작하지 않고, 한글 뒤에 영문 대문자가 바로 붙지 않는다.
 * - 홈과 /blog HTML에 og:image와 twitter:card=summary_large_image가 있다.
 * - /blog의 og:title이 홈과 다르다.
 */
test("/blog 카드 요약 — 머리표·붙음이 없다", async ({ page }) => {
  await page.goto("/blog", { waitUntil: "networkidle" });
  const summaries = await page.locator("a[href^='/go/blog-'] p").allTextContents();
  expect(summaries.length).toBeGreaterThan(10);
  const bad = summaries.filter((s) => /^(WOODSMAN\s*·|\d{4}\.\d{2}\.\d{2})/.test(s.trim()) || /[가-힣][A-Z]{2,}/.test(s));
  expect(bad, bad.join("\n")).toEqual([]);
  // 스크린리더가 읽을 길이 — CSS로 눈에서만 자르지 않고 글자 자체가 약 140자로 잘려 있다
  expect(summaries.filter((s) => s.length > 160), "160자 넘는 요약").toEqual([]);
});

async function meta(page: import("@playwright/test").Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  const get = (sel: string) => page.locator(sel).first().getAttribute("content");
  return {
    ogTitle: await get('meta[property="og:title"]'),
    ogImage: await get('meta[property="og:image"]'),
    ogW: await get('meta[property="og:image:width"]'),
    card: await get('meta[name="twitter:card"]'),
  };
}

test("홈 · /blog — og:image(1200×630) · summary_large_image · og:title이 서로 다르다", async ({ page, request }) => {
  const home = await meta(page, "/");
  const blog = await meta(page, "/blog");
  for (const m of [home, blog]) {
    expect(m.ogImage).toMatch(/\/og-default\.png$/);
    expect(m.ogW).toBe("1200");
    expect(m.card).toBe("summary_large_image");
  }
  expect(blog.ogTitle).toBe("블로그 글 전체 | Woodsman");
  expect(blog.ogTitle).not.toBe(home.ogTitle);
  const img = await request.get(new URL(home.ogImage!).pathname);
  expect(img.status()).toBe(200);
  expect(img.headers()["content-type"]).toContain("image/png");
});

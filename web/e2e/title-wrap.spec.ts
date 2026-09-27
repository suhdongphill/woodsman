import { expect, test, type Page } from "@playwright/test";

/**
 * 제목·부제 나누기와 한글 줄바꿈 — 2026-09-27 (81) 운영자 사양.
 *
 * - 1440 /blog: 「암호화폐로 들어오는 돈의 길이 달라지고 있다」 카드가 본제목 1줄 + 부제 1줄, 아이콘만 있는 줄이 없다.
 * - 390: 히어로·요약의 단어가 **가운데서 끊기지 않는다**(keep-all) — 단어마다 글자 범위(Range)의 줄 수를 센다.
 * - 링크의 접근 가능한 이름에 전체 제목이 들어간다.
 * - 전역 keep-all이 다른 화면에 가로 넘침을 만들지 않는다.
 */

/** 요소 안 단어(띄어쓰기 기준, 한글 2자 이상) 중 두 줄로 쪼개진 것. */
async function brokenWords(page: Page, selector: string) {
  return page.locator(selector).first().evaluate((root) => {
    const broken: string[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = n.textContent ?? "";
      for (const m of text.matchAll(/[가-힣]{2,}[^\s]*/g)) {
        const r = document.createRange();
        r.setStart(n, m.index!);
        r.setEnd(n, m.index! + m[0].length);
        const tops = new Set([...r.getClientRects()].map((c) => Math.round(c.top)));
        if (tops.size > 1) broken.push(m[0]);
      }
    }
    return broken;
  });
}

test.describe("1440 — 카드 제목", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("본제목 1줄 + 부제 1줄 · 아이콘만 있는 줄이 없다 · 링크 이름에 전체 제목", async ({ page }) => {
    await page.goto("/blog", { waitUntil: "networkidle" });
    const card = page.locator("a[href^='/go/blog-']", { hasText: "암호화폐로 들어오는 돈의 길이 달라지고 있다" }).first();
    const h3 = card.locator("h3");
    const lineH = await h3.evaluate((el) => parseFloat(getComputedStyle(el).lineHeight));
    expect((await h3.boundingBox())!.height).toBeLessThan(lineH * 1.5);
    const dek = card.locator("h3 + p");
    await expect(dek).toContainText("2026년 9월 비트코인");
    const dekLineH = await dek.evaluate((el) => parseFloat(getComputedStyle(el).lineHeight));
    expect((await dek.boundingBox())!.height).toBeLessThan(dekLineH * 1.5);
    // 아이콘은 마지막 단어와 같은 줄
    // 같은 줄 = 세로 중심의 차이가 줄 높이의 절반보다 작다(아이콘은 기준선에 맞춰 몇 px 아래에 그려진다)
    const gap = await h3.locator("span.whitespace-nowrap").evaluate((s) => {
      const i = s.querySelector("svg")!.getBoundingClientRect();
      const w = s.getBoundingClientRect();
      return Math.abs(i.top + i.height / 2 - (w.top + w.height / 2));
    });
    expect(gap).toBeLessThan(lineH / 2);
    await expect(card).toHaveAccessibleName(/암호화폐로 들어오는 돈의 길이 달라지고 있다 — 2026년 9월 비트코인 ETF/);
  });
});

for (const w of [360, 390]) {
  test.describe(`${w}px — 한글 단어가 가운데서 끊기지 않는다`, () => {
    test.use({ viewport: { width: w, height: 844 }, isMobile: true, hasTouch: true });

    test("홈 히어로(h1 · 첫 문단)", async ({ page }) => {
      await page.goto("/", { waitUntil: "networkidle" });
      expect(await brokenWords(page, "h1")).toEqual([]);
      expect(await brokenWords(page, "main section p")).toEqual([]);
    });

    test("/blog 카드 제목·부제·요약", async ({ page }) => {
      await page.goto("/blog", { waitUntil: "networkidle" });
      for (const sel of ["a[href^='/go/blog-'] h3", "a[href^='/go/blog-'] p"]) {
        expect(await brokenWords(page, sel), sel).toEqual([]);
      }
    });

    // ⚠ /portfolio는 뺐다 — 운영(수정 전)에서도 360·390에서 402px로 넘친다. 이번 변경과 무관한 **원래 있던 문제**라 따로 고친다(CHANGELOG (81)).
    for (const path of ["/macro", "/leaders", "/insights"]) {
      test(`${path} — 전역 keep-all이 가로 넘침을 만들지 않는다`, async ({ page }) => {
        await page.goto(path, { waitUntil: "networkidle" });
        await page.addStyleTag({ content: "html, body { overflow-x: visible !important; }" });
        const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
        expect(sw).toBe(cw);
      });
    }
  });
}

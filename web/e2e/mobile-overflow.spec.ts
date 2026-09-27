import { expect, test, type Page } from "@playwright/test";

/**
 * 모바일 가로 넘침 — 2026-09-27 운영자 신고(390px에서 문서 폭 586/596px).
 *
 * 원인: 블로그 카드 요약 속 띄어쓰기 없는 긴 URL(약 200자) + grid 항목의 기본 `min-width:auto`.
 * 고침: `min-w-0` · `[overflow-wrap:anywhere]` · 요약에서 URL 제거(`lib/blog/tistory.ts` `stripUrls`) · 전역 `overflow-x: clip`(안전망).
 *
 * ⚠ **안전망을 끄고 잰다.** `html,body { overflow-x: clip }`이 켜진 채로 재면 원인 수정이 빠져도 통과할 수 있다 —
 *   그러면 이 테스트는 아무것도 지키지 않는다(2026-08-30 「순서 테스트가 화면을 안 지켰다」와 같은 종류).
 */
const PAGES = ["/", "/blog"];
const VIEWPORTS = [
  { name: "iPhone 390x844", width: 390, height: 844, mobile: true },
  { name: "Android 360x800", width: 360, height: 800, mobile: true },
  { name: "데스크톱 1440x900", width: 1440, height: 900, mobile: false },
];

async function measure(page: Page) {
  await page.addStyleTag({ content: "html, body { overflow-x: visible !important; }" });
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const offenders: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
      // 가로로 넘기게 만든 영역(거시 지표 띠 등) 안쪽은 넘쳐도 정상이다.
      let inScroller = false;
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const ox = getComputedStyle(a).overflowX;
        if (ox !== "visible") {
          inScroller = true;
          break;
        }
      }
      const r = el.getBoundingClientRect();
      if (!inScroller && r.width > 0 && r.right > vw + 1) {
        offenders.push(`${el.tagName.toLowerCase()} «${(el.textContent ?? "").trim().slice(0, 30)}» right=${Math.round(r.right)}`);
      }
    }
    return { scrollWidth: document.documentElement.scrollWidth, clientWidth: vw, offenders: offenders.slice(0, 5) };
  });
}

for (const vp of VIEWPORTS) {
  test.describe(vp.name, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.mobile, hasTouch: vp.mobile });

    for (const path of PAGES) {
      test(`${path} — 가로로 넘치지 않는다`, async ({ page }) => {
        await page.goto(path, { waitUntil: "networkidle" });
        const m = await measure(page);
        expect(m.offenders, `넘치는 요소: ${m.offenders.join(" | ")}`).toEqual([]);
        expect(m.scrollWidth).toBe(m.clientWidth);
      });
    }

    if (vp.mobile) {
      /**
       * 좌우로 밀어도 화면이 옆으로 움직이지 않는다 — 운영자 요청 「스와이프 시 흔들리지 않는지」.
       * ⚠ 이건 **안전망을 켠 채로**(실제 사용자 상태) 잰다. 위 테스트는 원인을, 이 테스트는 사용자가 겪는 것을 본다.
       */
      for (const path of PAGES) {
        test(`${path} — 가로로 밀어도 흔들리지 않는다`, async ({ page }) => {
          await page.goto(path, { waitUntil: "networkidle" });
          await page.mouse.move(vp.width / 2, vp.height / 2);
          await page.mouse.wheel(600, 0);
          await page.waitForTimeout(300);
          expect(await page.evaluate(() => window.scrollX)).toBe(0);
        });
      }
    }
  });
}

test.describe("요약 속 URL", () => {
  test("「금리는 오르는데, 비트코인은 왜 오르는 것일까?」 카드 요약에 URL이 보이지 않는다", async ({ page }) => {
    await page.goto("/blog", { waitUntil: "networkidle" });
    const card = page.locator("a", { hasText: "금리는 오르는데, 비트코인은 왜 오르는 것일까?" }).first();
    await expect(card).toBeVisible();
    await expect(card).not.toContainText("http");
  });

  test("/blog 어느 카드 요약에도 URL이 없다", async ({ page }) => {
    await page.goto("/blog", { waitUntil: "networkidle" });
    const texts = await page.locator("a[href^='/go/blog-'] p").allTextContents();
    expect(texts.length).toBeGreaterThan(0);
    expect(texts.filter((t) => /https?:\/\//.test(t))).toEqual([]);
  });
});

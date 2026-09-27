import { expect, test } from "@playwright/test";

/**
 * 두 유동성 점수 — 2026-09-27 운영자 신고: 홈에서 GCRM 유동성(52)과 포털 유동성 점수(46)가 둘 다 「유동성」으로 보였다.
 *
 * 수용 기준(운영자 사양):
 * - 홈 어디에도 수식어 없는 「유동성 NN」이 두 값으로 동시에 나타나지 않는다.
 * - 글이 인용하는 이름 「포털 유동성 점수」가 홈 카드에 있다.
 * - 390px에서 칩 라벨이 단어 단위로 줄바꿈된다(keep-all).
 * - 설명은 툴팁이 아니라 늘 보이는 글 + 링크(터치에 hover가 없다) — 링크의 도착지가 실제로 있다.
 */
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test("홈 — 수식어 없는 「유동성 NN」이 없다 · 두 이름이 다 있다", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  const text = (await page.locator("main").innerText()).replace(/\s+/g, " ");
  // 「GCRM 유동성 52」·「포털 유동성 점수 46」은 된다. 「순유동성」처럼 붙은 말도 된다.
  const bare = [...text.matchAll(/(^|[^가-힣A-Za-z])유동성 \d{1,3}/g)].map((m) => text.slice(Math.max(0, m.index! - 12), m.index! + 12));
  const unqualified = bare.filter((s) => !/GCRM 유동성 \d/.test(s));
  expect(unqualified, `수식어 없는 유동성: ${unqualified.join(" | ")}`).toEqual([]);
  expect(text).toContain("포털 유동성 점수");
  expect(text).toContain("GCRM 유동성");
});

test("GCRM 칩은 keep-all · 차이 설명 링크가 사전 항목으로 간다", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  const frame = page.locator('section[aria-label="Global Capital Regime"]');
  await expect(frame).toBeVisible();
  const chip = frame.locator("li", { hasText: "GCRM 유동성" }).first();
  await expect(chip).toHaveCSS("word-break", "keep-all");
  await expect(frame).toContainText("다른 모델");
  const link = frame.getByRole("link", { name: /두 점수의 차이/ });
  await expect(link).toHaveAttribute("href", "/macro/glossary#gcrm-liquidity");
  await link.click();
  await page.waitForURL(/glossary/);
  await expect(page.locator("#gcrm-liquidity")).toBeVisible();
  await expect(page.locator("#portal-liquidity-score")).toBeAttached();
});

test("두 카드의 기준일·계산 시각이 같은 형식이다 (YYYY-MM-DD · KST)", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  const stamp = /기준일 \d{4}-\d{2}-\d{2} · 계산 \d{4}-\d{2}-\d{2} \d{2}:\d{2} KST/;
  await expect(page.locator('section[aria-label="Global Capital Regime"]')).toContainText(stamp);
  await expect(page.locator("article", { hasText: "포털 유동성 점수" }).first()).toContainText(stamp);
});

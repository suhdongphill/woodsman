import { defineConfig } from "@playwright/test";

/**
 * 화면 회귀 테스트(Playwright) — 2026-09-27 모바일 가로 넘침 신고에서 시작했다.
 *
 * ⚠ 단위 테스트(`npm test`, vitest)와 따로 돈다: `npm run test:e2e`.
 *   대상 주소는 `PLAYWRIGHT_BASE_URL`(기본 로컬 개발 서버 http://localhost:3000).
 *   로컬에서는 `npm run dev`를 먼저 띄운다 — ⚠ `npm run check`(빌드)와 동시에 돌리지 않는다(CLAUDE.md §7).
 *   운영본에 대고 돌리면 배포 뒤 검증이 된다: `PLAYWRIGHT_BASE_URL=https://portfolio-solutions.net npm run test:e2e`.
 * ⚠ 브라우저는 Chromium 하나만 설치했다(`npx playwright install chromium`) — 모바일은 뷰포트·터치로 흉내 낸다.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    browserName: "chromium",
  },
});

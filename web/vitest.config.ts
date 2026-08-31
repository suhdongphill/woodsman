import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  /**
   * ⚠ `.tsx` 테스트가 JSX를 쓰려면 필요하다. Next는 자동 런타임을 쓰는데(tsconfig의
   * `"jsx": "preserve"` + SWC), vitest의 esbuild는 기본이 classic이라 `React is not defined`로
   * 죽는다. 화면 조각을 **실제로 그려서** 규칙을 지키려면(2026-08-31, 홈 재편 Step 4)
   * 이 한 줄이 있어야 한다.
   */
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});

import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DYNAMIC_PATH_RULES, PUBLIC_STATIC_PATHS, isRecordablePath } from "./beacon-path";
import { normalizePath } from "./analytics";
import { MACRO_GROUPS } from "./macro/registry";

/**
 * ⚠ 이 파일의 핵심은 마지막 describe다 — **실제 라우트 디렉터리와 목록을 대조한다.**
 * 화면을 새로 만들고 `beacon-path.ts`에 넣는 것을 잊으면 그 화면의 집계가 조용히 0이 된다.
 * 사람이 기억하는 대신 `npm run check`가 잡게 한다.
 */

const PUBLIC_DIR = fileURLToPath(new URL("../app/(public)", import.meta.url));

/** `src/app/(public)` 아래에서 `page.tsx`를 가진 디렉터리를 모아 라우트 문자열로 만든다. */
function discoverRoutes(dir: string, segments: string[] = []): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const routes: string[] = [];

  if (entries.some((e) => e.isFile() && e.name === "page.tsx")) {
    routes.push(segments.length === 0 ? "/" : `/${segments.join("/")}`);
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    // 라우트 그룹 `(admin)` 등은 경로에 나타나지 않는다. `@slot`·`_private`도 건너뛴다.
    const isGroup = entry.name.startsWith("(") || entry.name.startsWith("@") || entry.name.startsWith("_");
    routes.push(
      ...discoverRoutes(
        path.join(dir, entry.name),
        isGroup ? segments : [...segments, entry.name],
      ),
    );
  }
  return routes;
}

describe("집계할 수 있는 경로", () => {
  it("공개 정적 화면은 센다", () => {
    for (const p of PUBLIC_STATIC_PATHS) {
      expect(isRecordablePath(p), p).toBe(true);
    }
  });

  it("실재하는 동적 경로는 센다", () => {
    expect(isRecordablePath("/insights/three-bucket")).toBe(true);
    expect(isRecordablePath("/board/12")).toBe(true);
    expect(isRecordablePath("/stocks/TSM")).toBe(true);
    // ⚠ 국장 티커는 문자열이다 — 숫자로 다루면 앞의 0이 날아간다.
    expect(isRecordablePath("/stocks/005930")).toBe(true);
    expect(isRecordablePath(`/macro/${MACRO_GROUPS[0].key}`)).toBe(true);
  });

  it("⚠ 없는 화면을 만들어 내는 요청을 막는다 — 이 파일을 만든 이유다", () => {
    for (const p of ["/__probe", "/aaa1", "/nope/deep", "/portfolio/x", "/insights/a/b"]) {
      expect(isRecordablePath(p), p).toBe(false);
    }
  });

  it("⚠ 거시 그룹은 정규식이 아니라 실제 섹터 목록과 대조한다", () => {
    expect(isRecordablePath("/macro/does-not-exist")).toBe(false);
  });

  it("동적 세그먼트 모양을 좁게 잡는다", () => {
    expect(isRecordablePath("/board/abc")).toBe(false); // 게시글 id는 숫자
    expect(isRecordablePath("/insights/Three_Bucket")).toBe(false); // slug는 소문자·하이픈
    expect(isRecordablePath(`/insights/${"a".repeat(200)}`)).toBe(false);
  });
});

describe("⚠ 라우트와 목록이 어긋나면 여기서 깨진다", () => {
  const routes = discoverRoutes(PUBLIC_DIR);
  const statics = routes.filter((r) => !r.includes("["));
  const templates = routes.filter((r) => r.includes("["));

  it("공개 정적 화면이 빠짐없이 목록에 있다", () => {
    // `normalizePath`가 이미 빼는 화면(`/login`·`/register`)은 목록에 없어도 된다.
    const missing = statics.filter(
      (r) => normalizePath(r) !== null && !(PUBLIC_STATIC_PATHS as readonly string[]).includes(r),
    );
    expect(missing, `beacon-path.ts의 PUBLIC_STATIC_PATHS에 추가하세요: ${missing.join(", ")}`).toEqual(
      [],
    );
  });

  it("목록에 있는데 실제로는 없는 화면이 없다", () => {
    const stale = PUBLIC_STATIC_PATHS.filter((p) => !statics.includes(p));
    expect(stale, `없어진 화면입니다. 목록에서 지우세요: ${stale.join(", ")}`).toEqual([]);
  });

  it("동적 라우트가 빠짐없이 규칙을 갖는다", () => {
    const covered = DYNAMIC_PATH_RULES.map((r) => r.template);
    expect([...templates].sort()).toEqual([...covered].sort());
  });

  it("라우트를 실제로 찾아냈다 — 탐색이 조용히 0개를 반환하면 위 검사가 전부 통과한다", () => {
    expect(routes.length).toBeGreaterThan(5);
  });
});

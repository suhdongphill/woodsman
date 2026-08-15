import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as mock from "./mock";
import { getStock, mockSeries } from "./mock";

describe("대표 포트폴리오는 목업에서 내려왔다", () => {
  it("⚠ 목업을 다시 export하지 않는다 — 화면이 이걸 읽으면 관리자 편집이 무효가 된다", () => {
    // 2026-08-06: 대표 포트폴리오·리밸런싱은 D1로 옮겼다(features/portfolio/repository.ts).
    // 시드 데이터는 lib/seed-data.ts에 있다. 여기에 되살리면 같은 사고가 반복된다.
    expect("modelHoldings" in mock).toBe(false);
    expect("rebalances" in mock).toBe(false);
    expect("functionAllocation" in mock).toBe(false);
  });
});

describe("콘텐츠도 목업에서 내려왔다", () => {
  it("⚠ 글 목업을 다시 export하지 않는다 — 화면이 이걸 읽으면 편집이 무효가 된다", () => {
    // 2026-08-06: Post는 D1로 옮겼다(features/posts/repository.ts).
    expect("posts" in mock).toBe(false);
    expect("users" in mock).toBe(false);
    expect("allPosts" in mock).toBe(false);
    expect("getPostBySlug" in mock).toBe(false);
  });
});

describe("댓글·사이트 설정도 목업에서 내려왔다", () => {
  it("⚠ 댓글 목업을 다시 export하지 않는다 — 화면이 이걸 읽으면 승인·숨김 버튼이 죽는다", () => {
    // 2026-08-07: 댓글은 D1로 옮겼다(features/comments/repository.ts).
    // 목업을 읽는 동안 /admin/comments의 버튼 3종에 onClick이 없었고,
    // 숨겼다고 믿은 댓글이 계속 노출됐다. 노출 규칙은 lib/comments.test.ts가 지킨다.
    expect("comments" in mock).toBe(false);
    expect("getCommentsByPostId" in mock).toBe(false);
  });

  it("⚠ 사이트 설정 목업을 다시 export하지 않는다 — 토글이 켜도 저장되지 않는다", () => {
    // 정책 스위치는 lib/site-settings.getSiteFlags()가 D1에서 읽는다.
    expect("siteConfig" in mock).toBe(false);
  });


  it("⚠ 대시보드 요약 목업도 다시 export하지 않는다", () => {
    expect("adminStats" in mock).toBe(false);
  });
});
describe("종목 목업", () => {
  it("티커 대소문자 무관하게 조회된다", () => {
    expect(getStock("tsm")?.name).toBe("TSMC");
  });

  it("mockSeries는 결정적이다(같은 입력 → 같은 출력)", () => {
    expect(mockSeries(100, 10)).toEqual(mockSeries(100, 10));
  });
});

/**
 * ⚠ 2026-08-15에 지운 것이 되살아나지 않게 막는다.
 *
 * `/stocks/[ticker]`에 `CANSLIM_SCORES = {TSM, NVDA, DEFAULT}`가 근거·출처·기준일 없이
 * 박혀 있었고, 화면은 그걸 실제 분석처럼 그렸다. 게다가 `scores[key] ?? 0`으로
 * **결측을 0점 처리**했고 등급 경계도 정책(8.0/6.5)이 아니라 7.0/5.0이었다.
 *
 * 목업을 되살리는 사고는 이 저장소에서 여섯 곳에서 났다. 그래서 소스를 직접 읽어 막는다.
 */
describe("⚠ CANSLIM 예시 점수를 화면에 되살리지 않는다", () => {
  const page = readFileSync(
    fileURLToPath(new URL("../app/(public)/stocks/[ticker]/page.tsx", import.meta.url)),
    "utf8",
  );
  const panel = readFileSync(
    fileURLToPath(new URL("../features/ai/ui/CanslimPanel.tsx", import.meta.url)),
    "utf8",
  );
  /** 주석은 화면에 나오지 않으므로 검사에서 뺀다(주석에는 왜 지웠는지가 적혀 있다). */
  const code = (src: string) =>
    src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("하드코딩된 점수표가 없다", () => {
    expect(code(page)).not.toMatch(/CANSLIM_SCORES/);
    expect(code(page)).not.toMatch(/\bDEFAULT\s*:/);
  });

  it("⚠ 결측을 0점으로 떨어뜨리지 않는다", () => {
    expect(code(panel)).not.toMatch(/scores\[[^\]]+\]\s*\?\?\s*0/);
    expect(code(page)).not.toMatch(/canslim\s*\?\?\s*0/);
  });

  it("⚠ 등급 경계를 화면이 직접 판정하지 않는다 — 정책은 lib/canslim에 있다", () => {
    // 옛 코드: composite >= 7 ? "편입 후보" : composite >= 5 ? "관찰" : "보류"
    expect(code(panel)).not.toMatch(/composite\s*>=\s*[0-9]/);
    expect(code(panel)).toContain("score.band");
  });

  it("점수·게이트·커버리지 판정을 순수 모듈에서 가져온다", () => {
    expect(page).toContain("scoreCanslim");
    expect(panel).toContain("canslimCoverageNotice");
  });
});

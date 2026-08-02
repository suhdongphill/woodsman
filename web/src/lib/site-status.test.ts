/**
 * 사이트 단계·로드맵 회귀 테스트.
 *
 * 핵심은 "말과 동작이 어긋나지 않는가"다.
 * 예: 로드맵에는 커뮤니티가 '예정'이라고 적혀 있는데 실제 스위치는 열려 있다면,
 * 방문자에게 거짓말을 하는 셈이므로 여기서 잡는다.
 */
import { describe, expect, it } from "vitest";
import { siteConfig } from "./mock";
import { resolveSitePolicy } from "./site-policy";
import {
  BETA_NOTICE,
  ROADMAP,
  ROADMAP_STATUS_LABEL,
  SITE_STAGE,
  VISION,
  currentPhase,
  isBeta,
} from "./site-status";

describe("사이트 단계", () => {
  it("지금은 베타다", () => {
    expect(SITE_STAGE).toBe("BETA");
    expect(isBeta).toBe(true);
  });

  it("베타 고지 문구가 비어 있지 않다", () => {
    expect(BETA_NOTICE.badge).toBe("BETA");
    expect(BETA_NOTICE.short.length).toBeGreaterThan(0);
    expect(BETA_NOTICE.long.length).toBeGreaterThan(0);
  });

  it("비전 문구가 채워져 있다", () => {
    expect(VISION.headline.length).toBeGreaterThan(0);
    expect(VISION.body.length).toBeGreaterThan(40);
  });
});

describe("로드맵", () => {
  it("단계가 4개이고 id가 겹치지 않는다", () => {
    expect(ROADMAP).toHaveLength(4);
    expect(new Set(ROADMAP.map((p) => p.id)).size).toBe(ROADMAP.length);
  });

  it("step 번호가 01부터 순서대로다", () => {
    expect(ROADMAP.map((p) => p.step)).toEqual(["01", "02", "03", "04"]);
  });

  it("진행 중 단계는 정확히 하나다", () => {
    const current = ROADMAP.filter((p) => p.status === "current");
    expect(current).toHaveLength(1);
    expect(currentPhase()?.id).toBe("record");
  });

  it("모든 단계가 요약과 항목을 갖는다", () => {
    for (const p of ROADMAP) {
      expect(p.title.length, p.id).toBeGreaterThan(0);
      expect(p.summary.length, p.id).toBeGreaterThan(10);
      expect(p.items.length, p.id).toBeGreaterThan(0);
      expect(ROADMAP_STATUS_LABEL[p.status], p.id).toBeTruthy();
    }
  });

  it("시점을 확정하는 표현을 쓰지 않는다", () => {
    // "곧 오픈" 같은 약속은 지키지 못하면 신뢰를 깎고 광고 심사에도 불리하다.
    const text = ROADMAP.map((p) => `${p.summary} ${p.items.join(" ")}`).join(" ");
    expect(text).not.toMatch(/곧 (오픈|출시|공개)/);
    expect(text).not.toMatch(/\d+월 (오픈|출시)/);
  });
});

describe("말과 동작의 일치", () => {
  const policy = resolveSitePolicy(siteConfig);

  it("커뮤니티가 '예정'이면 실제 스위치도 닫혀 있어야 한다", () => {
    const community = ROADMAP.find((p) => p.id === "community")!;
    if (community.status === "planned") {
      expect(policy.communityEnabled).toBe(false);
      expect(policy.signupEnabled).toBe(false);
    }
  });

  it("베타 단계에서는 기록 단계가 진행 중이다", () => {
    if (isBeta) expect(currentPhase()?.id).toBe("record");
  });
});

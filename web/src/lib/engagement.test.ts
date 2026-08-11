import { describe, expect, it } from "vitest";
import {
  BOUNCE_UNDER_SEC,
  DWELL_BUCKET_LABELS,
  MAX_DWELL_SEC,
  dwellBucket,
  medianBucketIndex,
  redesignPriority,
  rollupByTemplate,
  sanitizeEngagement,
  scrollBucket,
  sortByRedesignPriority,
  templatePath,
  toEngagementView,
  type EngagementRow,
} from "./engagement";

function row(over: Partial<EngagementRow & { views: number; outboundClicks: number }> = {}) {
  return {
    path: "/insights/a",
    date: "2026-08-11",
    samples: 0,
    dwellBuckets: [0, 0, 0, 0, 0, 0, 0],
    scrollBuckets: [0, 0, 0, 0, 0],
    reads: 0,
    views: 0,
    outboundClicks: 0,
    ...over,
  };
}

describe("체류시간 버킷", () => {
  it("경계값은 위 구간에 들어간다", () => {
    expect(dwellBucket(4.9)).toBe(0); // 5초 미만
    expect(dwellBucket(5)).toBe(1);
    expect(dwellBucket(14.9)).toBe(1);
    expect(dwellBucket(15)).toBe(2);
    expect(dwellBucket(30)).toBe(3);
    expect(dwellBucket(60)).toBe(4);
    expect(dwellBucket(180)).toBe(5);
    expect(dwellBucket(300)).toBe(6);
  });

  it("⚠ 탭을 열어 둔 채 잊은 경우는 상한에 갇힌다", () => {
    expect(dwellBucket(86_400)).toBe(DWELL_BUCKET_LABELS.length - 1);
    expect(dwellBucket(MAX_DWELL_SEC)).toBe(DWELL_BUCKET_LABELS.length - 1);
  });

  it("음수·NaN은 첫 칸으로 떨어진다(계산을 멈추지 않는다)", () => {
    expect(dwellBucket(-1)).toBe(0);
    expect(dwellBucket(Number.NaN)).toBe(0);
  });

  it("이탈 기준은 첫 버킷과 같은 경계다", () => {
    expect(dwellBucket(BOUNCE_UNDER_SEC - 0.1)).toBe(0);
    expect(dwellBucket(BOUNCE_UNDER_SEC)).toBe(1);
  });
});

describe("스크롤 버킷", () => {
  it("끝까지 내려가면 마지막 칸", () => {
    expect(scrollBucket(24)).toBe(0);
    expect(scrollBucket(50)).toBe(2);
    expect(scrollBucket(100)).toBe(4);
    expect(scrollBucket(140)).toBe(4); // 100 초과는 잘린다
  });
});

describe("비콘 입력 정화", () => {
  it("⚠ 누구나 부를 수 있는 값이라 범위를 자른다", () => {
    expect(sanitizeEngagement({ dwellSec: 999_999, scrollPct: 900 })).toEqual({
      dwellSec: MAX_DWELL_SEC,
      scrollPct: 100,
    });
  });

  it("숫자가 아니거나 음수면 기록하지 않는다", () => {
    expect(sanitizeEngagement({ dwellSec: "abc", scrollPct: 10 })).toBeNull();
    expect(sanitizeEngagement({ dwellSec: -5, scrollPct: 10 })).toBeNull();
    expect(sanitizeEngagement({ dwellSec: 10, scrollPct: -1 })).toBeNull();
    expect(sanitizeEngagement({})).toBeNull();
  });

  it("정상값은 반올림해서 통과", () => {
    expect(sanitizeEngagement({ dwellSec: 42.6, scrollPct: 73.2 })).toEqual({
      dwellSec: 43,
      scrollPct: 73,
    });
  });
});

describe("중앙 구간", () => {
  it("표본이 없으면 값을 만들지 않는다", () => {
    expect(medianBucketIndex([0, 0, 0])).toBeUndefined();
  });

  it("절반이 넘는 첫 구간", () => {
    expect(medianBucketIndex([10, 0, 0])).toBe(0);
    expect(medianBucketIndex([1, 1, 8])).toBe(2);
    expect(medianBucketIndex([5, 5])).toBe(0); // 누적 5 >= 5
  });

  it("⚠ 한 명의 긴 체류가 전체를 끌어올리지 못한다 — 평균과 다른 점", () => {
    // 9명이 3초, 1명이 5분 이상. 평균은 30초를 넘지만 중앙 구간은 첫 칸이어야 한다.
    expect(medianBucketIndex([9, 0, 0, 0, 0, 0, 1])).toBe(0);
  });
});

describe("경로 묶기", () => {
  it("글·게시글·종목은 템플릿으로 접는다", () => {
    expect(templatePath("/insights/three-bucket")).toBe("/insights/*");
    expect(templatePath("/board/123")).toBe("/board/*");
    expect(templatePath("/stocks/NVDA")).toBe("/stocks/*");
    expect(templatePath("/macro/rates")).toBe("/macro/*");
  });

  it("고정 화면은 그대로 둔다", () => {
    expect(templatePath("/")).toBe("/");
    expect(templatePath("/macro")).toBe("/macro");
    expect(templatePath("/macro/bubble")).toBe("/macro/bubble"); // /macro/* 로 접히지 않는다
    expect(templatePath("/portfolio")).toBe("/portfolio");
  });

  it("합칠 때 버킷은 자리별로 더한다", () => {
    const merged = rollupByTemplate([
      row({ path: "/insights/a", views: 10, samples: 2, dwellBuckets: [1, 1, 0, 0, 0, 0, 0], reads: 1 }),
      row({ path: "/insights/b", views: 5, samples: 3, dwellBuckets: [0, 2, 1, 0, 0, 0, 0], reads: 2 }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].path).toBe("/insights/*");
    expect(merged[0].views).toBe(15);
    expect(merged[0].samples).toBe(5);
    expect(merged[0].reads).toBe(3);
    expect(merged[0].dwellBuckets).toEqual([1, 3, 1, 0, 0, 0, 0]);
  });

  it("⚠ 원본 배열을 건드리지 않는다", () => {
    const original = row({ path: "/insights/a", dwellBuckets: [1, 0, 0, 0, 0, 0, 0] });
    rollupByTemplate([original, row({ path: "/insights/b", dwellBuckets: [2, 0, 0, 0, 0, 0, 0] })]);
    expect(original.dwellBuckets).toEqual([1, 0, 0, 0, 0, 0, 0]);
  });
});

describe("화면용 요약", () => {
  it("표본이 없으면 비율을 만들지 않는다 — 0%는 '재 봤더니 0'으로 읽힌다", () => {
    const v = toEngagementView(row({ views: 40 }));
    expect(v.dwellLabel).toBeUndefined();
    expect(v.bouncePct).toBeUndefined();
    expect(v.readPct).toBeUndefined();
    expect(v.views).toBe(40);
  });

  it("비율을 소수 한 자리까지 낸다", () => {
    const v = toEngagementView(
      row({
        views: 100,
        samples: 8,
        dwellBuckets: [2, 0, 0, 3, 3, 0, 0],
        scrollBuckets: [1, 1, 2, 2, 2],
        reads: 5,
        outboundClicks: 3,
      }),
    );
    expect(v.bouncePct).toBe(25); // 2/8
    expect(v.fullScrollPct).toBe(25); // 2/8
    expect(v.readPct).toBe(62.5); // 5/8
    expect(v.outboundPct).toBe(3); // 3/100
    expect(v.dwellLabel).toBe("30초~1분");
  });
});

describe("개편 우선순위", () => {
  const bouncy = toEngagementView(
    row({ path: "/a", views: 1000, samples: 100, dwellBuckets: [80, 20, 0, 0, 0, 0, 0], reads: 0 }),
  );
  const readNoHandoff = toEngagementView(
    row({
      path: "/b",
      views: 1000,
      samples: 100,
      dwellBuckets: [0, 0, 0, 0, 100, 0, 0],
      reads: 90,
      outboundClicks: 0,
    }),
  );
  const healthy = toEngagementView(
    row({
      path: "/c",
      views: 1000,
      samples: 100,
      dwellBuckets: [0, 0, 0, 0, 100, 0, 0],
      reads: 90,
      outboundClicks: 150,
    }),
  );

  it("⚠ 조회수만 많고 건강한 화면은 위로 오지 않는다 — 고칠 게 없다", () => {
    expect(redesignPriority(healthy)).toBeLessThan(redesignPriority(bouncy));
    expect(redesignPriority(healthy)).toBeLessThan(redesignPriority(readNoHandoff));
  });

  it("잘 읽히는데 티스토리로 안 넘어가면 놓친 기회로 잡힌다", () => {
    expect(redesignPriority(readNoHandoff)).toBeGreaterThan(0);
  });

  it("조회가 없으면 0점", () => {
    expect(redesignPriority(toEngagementView(row({ path: "/x" })))).toBe(0);
  });

  it("표본이 없어도 목록에서 사라지지 않는다 — 규모만 약하게 반영", () => {
    const noSample = toEngagementView(row({ path: "/y", views: 500 }));
    expect(redesignPriority(noSample)).toBeGreaterThan(0);
  });

  it("정렬은 우선순위 → 조회수 순", () => {
    const sorted = sortByRedesignPriority([healthy, readNoHandoff, bouncy]);
    expect(sorted[0].path).toBe("/a");
    expect(sorted[sorted.length - 1].path).toBe("/c");
  });
});

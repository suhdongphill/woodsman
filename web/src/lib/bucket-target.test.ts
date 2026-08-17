import { describe, expect, it } from "vitest";
import {
  BUCKET_TARGET_MAX,
  BUILT_IN_BUCKET_KEYS,
  bucketBreakdownWarning,
  bucketColor,
  bucketName,
  bucketTargetSum,
  breakdownBuckets,
  canDeleteBucket,
  cashTargetPct,
  isBucketTargetSet,
  orphanHoldings,
  sortBuckets,
  validateNewBucket,
  validateTargets,
  type PortfolioBucket,
} from "./bucket-target";

function bucket(over: Partial<PortfolioBucket> & { key: string }): PortfolioBucket {
  return {
    name: over.key,
    targetPct: 0,
    color: "#36a06a",
    sortOrder: 0,
    builtIn: false,
    ...over,
  };
}

const DEFAULTS: PortfolioBucket[] = [
  bucket({ key: "GROWTH", name: "성장", targetPct: 60, sortOrder: 0, builtIn: true }),
  bucket({ key: "INCOME", name: "인컴", targetPct: 25, sortOrder: 1, builtIn: true }),
  bucket({ key: "DEFENSE", name: "방어", targetPct: 10, sortOrder: 2, builtIn: true }),
];

describe("sortBuckets", () => {
  it("순서대로 낸다", () => {
    const shuffled = [DEFAULTS[2], DEFAULTS[0], DEFAULTS[1]];
    expect(sortBuckets(shuffled).map((b) => b.key)).toEqual(["GROWTH", "INCOME", "DEFENSE"]);
  });

  it("순서가 같으면 키로 갈라 매번 같은 차례가 나온다", () => {
    const same = [bucket({ key: "ZZZ" }), bucket({ key: "AAA" })];
    expect(sortBuckets(same).map((b) => b.key)).toEqual(["AAA", "ZZZ"]);
  });

  it("원본 배열을 건드리지 않는다", () => {
    const input = [DEFAULTS[2], DEFAULTS[0]];
    sortBuckets(input);
    expect(input[0].key).toBe("DEFENSE");
  });
});

describe("합계와 현금", () => {
  it("목표 구성비를 더한다", () => {
    expect(bucketTargetSum(DEFAULTS)).toBe(95);
  });

  it("남는 몫이 현금·미배정이다", () => {
    expect(cashTargetPct(DEFAULTS)).toBe(5);
  });

  it("합이 100이면 현금은 0이다", () => {
    const full = [...DEFAULTS.slice(0, 2), bucket({ key: "DEFENSE", targetPct: 15 })];
    expect(cashTargetPct(full)).toBe(0);
  });

  it("합이 100을 넘어도 현금을 음수로 내지 않는다 — 음수 막대가 그려진다", () => {
    const over = [bucket({ key: "A", targetPct: 200 })];
    expect(cashTargetPct(over)).toBe(0);
  });

  it("합이 0이면 미설정으로 본다 — 0%짜리 막대를 그리지 않는다", () => {
    const zero = DEFAULTS.map((b) => ({ ...b, targetPct: 0 }));
    expect(isBucketTargetSet(zero)).toBe(false);
    expect(isBucketTargetSet(DEFAULTS)).toBe(true);
  });

  it("버킷이 하나도 없으면 미설정이다", () => {
    expect(isBucketTargetSet([])).toBe(false);
  });
});

describe("validateTargets", () => {
  it("합이 100 미만인 것은 막지 않는다 — 나머지는 현금이다", () => {
    expect(validateTargets(DEFAULTS)).toEqual({ ok: true });
  });

  it("합계 100은 통과한다", () => {
    const full = [...DEFAULTS.slice(0, 2), bucket({ key: "DEFENSE", targetPct: 15 })];
    expect(validateTargets(full)).toEqual({ ok: true });
  });

  it("합계 100 초과는 막는다 — 작성 중이 아니라 틀린 값이다", () => {
    const over = [...DEFAULTS, bucket({ key: "ALT", name: "대체투자", targetPct: 20 })];
    const verdict = validateTargets(over);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.error).toContain("115%");
  });

  it("상한은 100이다", () => {
    expect(BUCKET_TARGET_MAX).toBe(100);
  });

  it("음수를 막는다", () => {
    const verdict = validateTargets([bucket({ key: "A", name: "가", targetPct: -1 })]);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.error).toContain("음수");
  });

  it("숫자가 아닌 값을 막는다", () => {
    const verdict = validateTargets([bucket({ key: "A", name: "가", targetPct: Number.NaN })]);
    expect(verdict.ok).toBe(false);
  });
});

describe("validateNewBucket", () => {
  const input = { key: "ALT", name: "대체투자", color: "#8b5cf6" };

  it("새 버킷을 받는다", () => {
    expect(validateNewBucket(input, DEFAULTS)).toEqual({ ok: true });
  });

  it("키가 겹치면 거부한다 — 조용히 덮어쓰지 않는다", () => {
    const verdict = validateNewBucket({ ...input, key: "GROWTH" }, DEFAULTS);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.error).toContain("이미 있습니다");
  });

  it("소문자로 넣어도 대문자로 보고 겹침을 잡는다", () => {
    expect(validateNewBucket({ ...input, key: "growth" }, DEFAULTS).ok).toBe(false);
  });

  it("키 모양이 아니면 거부한다", () => {
    for (const key of ["", "A", "1ABC", "대체투자", "ALT-X"]) {
      expect(validateNewBucket({ ...input, key }, DEFAULTS).ok, key).toBe(false);
    }
  });

  it("이름이 비면 거부한다", () => {
    expect(validateNewBucket({ ...input, name: "  " }, DEFAULTS).ok).toBe(false);
  });

  it("색이 #RRGGBB가 아니면 거부한다 — 임의 문자열이 style에 들어가지 않게", () => {
    for (const color of ["red", "#fff", "javascript:alert(1)", "#12345g"]) {
      expect(validateNewBucket({ ...input, color }, DEFAULTS).ok, color).toBe(false);
    }
  });
});

describe("canDeleteBucket", () => {
  it("기본 버킷은 지울 수 없다 — AI 용어와 기존 보고서가 그 키를 참조한다", () => {
    const verdict = canDeleteBucket(DEFAULTS[0], 0);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.error).toContain("0%");
  });

  it("기본 셋 키는 셋이다", () => {
    expect([...BUILT_IN_BUCKET_KEYS]).toEqual(["GROWTH", "INCOME", "DEFENSE"]);
  });

  it("보유 종목이 있으면 지울 수 없다 — 갈 곳 없는 분류가 생긴다", () => {
    const custom = bucket({ key: "ALT", name: "대체투자" });
    const verdict = canDeleteBucket(custom, 2);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.error).toContain("2건");
  });

  it("비어 있는 커스텀 버킷은 지울 수 있다", () => {
    expect(canDeleteBucket(bucket({ key: "ALT", name: "대체투자" }), 0)).toEqual({ ok: true });
  });
});

describe("breakdownBuckets", () => {
  const holdings = [
    { functionType: "GROWTH", targetWeight: 25 },
    { functionType: "GROWTH", targetWeight: 20 },
    { functionType: "INCOME", targetWeight: 25 },
  ];

  it("버킷 목표 안에서 배정분과 미배정분을 가른다", () => {
    const rows = breakdownBuckets(DEFAULTS, holdings);
    const growth = rows.find((r) => r.bucket.key === "GROWTH")!;
    expect(growth.targetPct).toBe(60);
    expect(growth.assignedPct).toBe(45);
    expect(growth.unassignedPct).toBe(15);
    expect(growth.overAssignedPct).toBe(0);
    expect(growth.holdings).toBe(2);
  });

  it("딱 맞으면 미배정도 초과도 0이다", () => {
    const income = breakdownBuckets(DEFAULTS, holdings).find((r) => r.bucket.key === "INCOME")!;
    expect(income.unassignedPct).toBe(0);
    expect(income.overAssignedPct).toBe(0);
  });

  it("넘친 것과 모자란 것을 다른 필드로 낸다 — 부호 해석을 화면에 맡기지 않는다", () => {
    const rows = breakdownBuckets(
      [bucket({ key: "DEFENSE", name: "방어", targetPct: 10 })],
      [{ functionType: "DEFENSE", targetWeight: 18 }],
    );
    expect(rows[0].unassignedPct).toBe(0);
    expect(rows[0].overAssignedPct).toBe(8);
  });

  it("종목이 없으면 목표가 통째로 미배정이다", () => {
    const rows = breakdownBuckets(DEFAULTS, []);
    expect(rows.map((r) => r.unassignedPct)).toEqual([60, 25, 10]);
  });

  it("표시 순서를 지킨다", () => {
    const rows = breakdownBuckets([DEFAULTS[2], DEFAULTS[0], DEFAULTS[1]], holdings);
    expect(rows.map((r) => r.bucket.key)).toEqual(["GROWTH", "INCOME", "DEFENSE"]);
  });
});

describe("orphanHoldings — 어느 버킷에도 없는 종목", () => {
  it("모르는 분류의 종목을 찾아낸다 — 조용히 빠지면 안 된다", () => {
    const holdings = [
      { functionType: "GROWTH", ticker: "NVDA" },
      { functionType: "ALT", ticker: "GOLD" },
    ];
    expect(orphanHoldings(DEFAULTS, holdings).map((h) => h.ticker)).toEqual(["GOLD"]);
  });

  it("전부 아는 분류면 빈 배열", () => {
    expect(orphanHoldings(DEFAULTS, [{ functionType: "INCOME" }])).toEqual([]);
  });
});

describe("bucketBreakdownWarning", () => {
  it("모자란 것은 말하지 않는다 — 종목을 채우는 중에는 정상이다", () => {
    const rows = breakdownBuckets(DEFAULTS, [{ functionType: "GROWTH", targetWeight: 10 }]);
    expect(bucketBreakdownWarning(rows)).toBeNull();
  });

  it("넘친 것만 말한다", () => {
    const rows = breakdownBuckets(DEFAULTS, [{ functionType: "INCOME", targetWeight: 40 }]);
    expect(bucketBreakdownWarning(rows)).toContain("인컴 15%p");
  });
});

describe("이름·색 찾기", () => {
  it("이름을 찾는다", () => {
    expect(bucketName(DEFAULTS, "INCOME")).toBe("인컴");
  });

  it("모르는 키는 키를 그대로 낸다 — 빈 이름으로 뜨지 않게", () => {
    expect(bucketName(DEFAULTS, "ALT")).toBe("ALT");
  });

  it("모르는 키는 회색이다 — 다른 버킷 색으로 칠하지 않는다", () => {
    expect(bucketColor(DEFAULTS, "GROWTH")).toBe("#36a06a");
    expect(bucketColor(DEFAULTS, "ALT")).toBe("#6b7280");
  });
});

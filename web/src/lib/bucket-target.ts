/**
 * 포트폴리오 **버킷과 목표 구성비** — 순수 계산.
 *
 * ## 왜 이 모듈이 생겼나 (2026-08-17)
 * 두 가지가 동시에 없었다.
 *
 * 1. **버킷 목표 구성비를 정할 자리가 없었다.** 목표비중은 보유 종목의 `targetWeight`
 *    합계로 **파생**되고 있어서, "성장 60 / 인컴 25 / 방어 10을 목표로 하는데 아직
 *    아무것도 안 샀다"를 표현할 방법이 아예 없었다. 종목이 0건이면 목표도 전부 0이 된다.
 *    정작 `allocation.ts` 첫 문장은 "목표 배분을 정해 두고 매달 조금씩 채워 간다"였다 —
 *    **목표가 먼저고 보유가 나중인데** 코드가 순서를 거꾸로 갖고 있었다.
 * 2. **버킷 목록이 코드에 박혀 있었다.** 성장·인컴·방어는 `FunctionType` 유니온이라
 *    운영 전략이 바뀌어도(대체투자·현금성을 따로 보고 싶어도) 관리자가 손댈 수 없었다.
 *    운영지침의 설계사상은 "모든 것은 admin이 유연하게 운영한다"이다.
 *
 * 그래서 **버킷은 데이터**가 되었고(`PortfolioBucket`), 이 모듈은 그 목록을 받아 계산만 한다.
 *
 * ## ⚠ 합계는 100 **이하**를 허용한다
 * 남은 몫은 **현금·미배정**이다. 100을 강제하면 현금 보유를 버킷 중 하나에 억지로 섞게 되고,
 * 그러면 "방어 25%"가 실제로 현금인지 채권인지 알 수 없어진다. 계좌를 공개하는 사이트에서
 * 그건 숫자에 대한 거짓말이 된다(운영지침 §5).
 * ⚠ 반대로 **100 초과는 막는다.** 그건 작성 중이 아니라 틀린 값이다.
 *
 * ## ⚠ 버킷이 상위, 종목이 하위다
 * 종목별 `targetWeight`의 합이 버킷 목표를 다 채우지 못할 수 있다 —
 * 그 차이가 **"아직 종목을 안 정한 몫"**이고, 숨기지 않고 그대로 보여준다.
 */

/** 관리자가 만드는 버킷 하나. ⚠ `key`는 보유 종목이 참조하므로 만든 뒤 바꾸지 않는다. */
export type PortfolioBucket = {
  /** 안정된 식별자. 기본 셋은 GROWTH · INCOME · DEFENSE */
  key: string;
  /** 화면에 보이는 이름. 관리자가 바꿀 수 있다 */
  name: string;
  /** 공개 화면의 한 줄 설명 */
  description?: string;
  /** 목표 구성비(%) */
  targetPct: number;
  /** 차트·배지 색 (#RRGGBB) */
  color: string;
  /** 표시 순서. 작을수록 앞 */
  sortOrder: number;
  /**
   * ⚠ 기본 셋인가. 기본 셋의 **키**는 지우지 않는다 —
   * AI 프롬프트 용어(`lib/ai/labels.ts`)와 시드·기존 보고서가 이 키를 참조한다.
   * 이름·색·비중은 기본 셋도 바꿀 수 있다.
   */
  builtIn: boolean;
};

/**
 * ⚠ 기본 버킷 키. **지우지 않는다.**
 *
 * 이 세 키는 `lib/seed-data.ts` · 기존 `ModelHolding.functionType` ·
 * `StockReportContext.functionType` · AI 프롬프트 라벨이 이미 쓰고 있다.
 * 관리자가 이름을 "공격/배당/수비"로 바꿔도 **키는 그대로**여서 옛 데이터가 안 끊긴다.
 */
export const BUILT_IN_BUCKET_KEYS = ["GROWTH", "INCOME", "DEFENSE"] as const;

/** 합계 상한. 넘으면 저장하지 않는다. */
export const BUCKET_TARGET_MAX = 100;

/** 버킷 키의 모양 — 대문자·숫자·밑줄. ⚠ 화면 표시용 이름과 다르다. */
export const BUCKET_KEY_PATTERN = /^[A-Z][A-Z0-9_]{1,23}$/;

/** 색의 모양 — #RRGGBB. 임의 문자열이 style에 그대로 들어가지 않게 막는다. */
export const BUCKET_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** 표시 순서대로. 순서가 같으면 키로 갈라 **매번 같은 차례**가 나오게 한다. */
export function sortBuckets(buckets: PortfolioBucket[]): PortfolioBucket[] {
  return [...buckets].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key),
  );
}

/** 목표 구성비의 합(%). */
export function bucketTargetSum(buckets: PortfolioBucket[]): number {
  return round1(buckets.reduce((sum, b) => sum + (b.targetPct || 0), 0));
}

/**
 * 목표를 한 번이라도 정했나.
 *
 * ⚠ 합이 0이면 **미설정**으로 본다. 화면은 "아직 목표를 정하지 않았습니다"라고 말하고
 *    0%짜리 막대를 그리지 않는다 — 빈 막대는 "목표가 0이다"로 읽힌다.
 */
export function isBucketTargetSet(buckets: PortfolioBucket[]): boolean {
  return bucketTargetSum(buckets) > 0;
}

/**
 * 현금·미배정 몫(%) — 100에서 버킷 합계를 뺀 나머지.
 *
 * ⚠ 음수를 내지 않는다. 합이 100을 넘는 값은 저장되지 않지만, 옛 데이터가 남아 있을 수 있어
 *    화면에서 음수 막대가 그려지는 것은 막는다.
 */
export function cashTargetPct(buckets: PortfolioBucket[]): number {
  return round1(Math.max(0, BUCKET_TARGET_MAX - bucketTargetSum(buckets)));
}

export type BucketVerdict = { ok: true } | { ok: false; error: string };

/**
 * 목표 구성비를 저장해도 되나.
 *
 * ⚠ **합이 100 미만인 것은 막지 않는다.** 나머지는 현금이다(위 첫머리).
 *    막는 것은 ① 숫자가 아닌 값 ② 음수 ③ 합계 100 초과 셋뿐이다.
 */
export function validateTargets(buckets: PortfolioBucket[]): BucketVerdict {
  for (const b of buckets) {
    if (!Number.isFinite(b.targetPct)) {
      return { ok: false, error: `${b.name}의 목표 비중이 숫자가 아닙니다.` };
    }
    if (b.targetPct < 0) {
      return { ok: false, error: `${b.name}의 목표 비중에 음수를 넣을 수 없습니다.` };
    }
  }

  const sum = bucketTargetSum(buckets);
  if (sum > BUCKET_TARGET_MAX) {
    return {
      ok: false,
      error: `목표 구성비의 합이 ${sum}%입니다. 100%를 넘을 수 없습니다(남는 몫은 현금으로 둡니다).`,
    };
  }
  return { ok: true };
}

/** 새 버킷을 만들 수 있나. ⚠ 키 충돌은 조용히 덮어쓰지 않고 거부한다. */
export function validateNewBucket(
  input: { key: string; name: string; color: string },
  existing: PortfolioBucket[],
): BucketVerdict {
  const key = input.key.trim().toUpperCase();

  if (!BUCKET_KEY_PATTERN.test(key)) {
    return {
      ok: false,
      error: "키는 영문 대문자로 시작하는 2~24자여야 합니다(대문자·숫자·밑줄).",
    };
  }
  if (existing.some((b) => b.key === key)) {
    return { ok: false, error: `키 ${key}는 이미 있습니다.` };
  }
  if (!input.name.trim()) {
    return { ok: false, error: "버킷 이름을 적어 주세요." };
  }
  if (!BUCKET_COLOR_PATTERN.test(input.color)) {
    return { ok: false, error: "색은 #RRGGBB 모양이어야 합니다." };
  }
  return { ok: true };
}

/**
 * 버킷을 지워도 되나.
 *
 * ⚠ **두 가지를 막는다.**
 *    ① 기본 셋의 키는 지우지 않는다 — AI 프롬프트 용어와 기존 보고서·시드가 참조한다.
 *      (이름·색·비중은 바꿀 수 있으므로, 안 쓰겠다면 비중을 0으로 두면 된다.)
 *    ② 그 버킷을 쓰는 보유 종목이 있으면 지우지 않는다 — 종목이 갈 곳 없는 분류를
 *      갖게 되면 화면에서 조용히 사라진다. **먼저 옮기게** 한다.
 */
export function canDeleteBucket(
  bucket: PortfolioBucket,
  holdingsInBucket: number,
): BucketVerdict {
  if (bucket.builtIn) {
    return {
      ok: false,
      error: `${bucket.name}은 기본 버킷이라 지울 수 없습니다. 쓰지 않으려면 목표 비중을 0%로 두세요.`,
    };
  }
  if (holdingsInBucket > 0) {
    return {
      ok: false,
      error: `${bucket.name}에 보유 종목 ${holdingsInBucket}건이 있습니다. 먼저 다른 버킷으로 옮기세요.`,
    };
  }
  return { ok: true };
}

export type BucketBreakdown = {
  bucket: PortfolioBucket;
  /** 이 버킷의 목표 구성비(%) */
  targetPct: number;
  /** 그중 종목에 배정된 몫(%) — 종목별 `targetWeight`의 합 */
  assignedPct: number;
  /**
   * 아직 종목을 정하지 않은 몫(%). ⚠ 음수를 내지 않는다 —
   * 넘친 경우는 `overAssignedPct`가 따로 말한다. 한 숫자로 뭉뚱그리면 방향을 알 수 없다.
   */
  unassignedPct: number;
  /** 버킷 목표보다 종목 합계가 넘친 몫(%). 0이면 넘치지 않았다 */
  overAssignedPct: number;
  /** 이 버킷에 든 보유 종목 수 */
  holdings: number;
};

/**
 * 버킷 목표를 종목 배정분과 대조한다.
 *
 * ⚠ 넘친 것과 모자란 것을 **다른 필드로** 낸다. 하나의 부호 있는 숫자로 내면
 *    화면이 매번 부호를 해석해야 하고, 그러다 한 곳에서 뒤집힌다.
 */
export function breakdownBuckets(
  buckets: PortfolioBucket[],
  holdings: { functionType: string; targetWeight?: number }[],
): BucketBreakdown[] {
  return sortBuckets(buckets).map((bucket) => {
    const inBucket = holdings.filter((h) => h.functionType === bucket.key);
    const targetPct = round1(bucket.targetPct || 0);
    const assignedPct = round1(inBucket.reduce((sum, h) => sum + (h.targetWeight ?? 0), 0));
    const diff = round1(targetPct - assignedPct);

    return {
      bucket,
      targetPct,
      assignedPct,
      unassignedPct: diff > 0 ? diff : 0,
      overAssignedPct: diff < 0 ? round1(-diff) : 0,
      holdings: inBucket.length,
    };
  });
}

/**
 * ⚠ **어느 버킷에도 속하지 않는 보유 종목.**
 *
 * 관리자가 버킷을 지웠거나 옛 데이터가 남으면 생긴다. 이 종목들은 비중 계산에서
 * 조용히 빠지므로 **반드시 화면이 말해야 한다** — "값이 없음"과 "읽지 못함"을
 * 같은 화면으로 만들지 않는다(CLAUDE.md §3).
 */
export function orphanHoldings<T extends { functionType: string }>(
  buckets: PortfolioBucket[],
  holdings: T[],
): T[] {
  const known = new Set(buckets.map((b) => b.key));
  return holdings.filter((h) => !known.has(h.functionType));
}

/**
 * 관리자 화면에 띄울 한 문장. 문제가 없으면 null.
 *
 * ⚠ **저장을 막는 문장이 아니다.** 종목을 하나씩 넣는 중에는 배정이 모자란 게 정상이다
 *    (`targetSumWarning`과 같은 규율). 넘친 경우만 말한다.
 */
export function bucketBreakdownWarning(rows: BucketBreakdown[]): string | null {
  const over = rows.filter((r) => r.overAssignedPct > 0);
  if (over.length === 0) return null;

  const parts = over.map((r) => `${r.bucket.name} ${r.overAssignedPct}%p`);
  return `종목별 목표비중이 버킷 목표를 넘습니다 — ${parts.join(" · ")}. 버킷 목표를 올리거나 종목 비중을 줄이세요.`;
}

/** 버킷 이름 찾기. 없으면 키를 그대로 — ⚠ 빈 문자열을 내면 화면에서 종목이 이름 없이 뜬다. */
export function bucketName(buckets: PortfolioBucket[], key: string): string {
  return buckets.find((b) => b.key === key)?.name ?? key;
}

/** 버킷 색 찾기. 없으면 회색 — 알 수 없는 분류를 다른 버킷 색으로 칠하지 않는다. */
export function bucketColor(buckets: PortfolioBucket[], key: string): string {
  return buckets.find((b) => b.key === key)?.color ?? "#6b7280";
}

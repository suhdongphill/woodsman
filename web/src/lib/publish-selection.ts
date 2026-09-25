/**
 * 운영 포트폴리오에서 **어느 종목을 공개할지** 고르는 판단 — 순수 함수.
 *
 * ## 왜 필요한가 (2026-09-25)
 * 볼트가 증권사 잔고(100종목이 넘는다)를 `ModelHolding`에 **비공개 초안**으로 싣는다.
 * 공개는 사람이 켠다(볼트 인수인계 사양서 1-2). 종목마다 편집 폼을 열어 체크하는 방식으로는
 * 100개를 고를 수 없어서, 관리자 화면에 한 번에 고르는 표를 붙였다.
 *
 * ⚠ 표에 **실제로 보였던 종목만** 바꾼다. 화면을 연 뒤 볼트 적재로 새 종목이 들어왔을 수 있다 —
 *   체크가 없다는 이유로 그 종목까지 건드리면 사람이 보지도 않은 것을 결정한 셈이 된다.
 * ⚠ 이미 지워진 종목은 무시한다(다른 탭에서 지웠을 수 있다).
 */

export type PublishPlan = {
  /** 비공개 → 공개 */
  publish: string[];
  /** 공개 → 비공개 */
  unpublish: string[];
};

/**
 * @param listed  폼에 실제로 보였던 종목 id
 * @param checked 그중 공개로 체크된 id
 * @param current DB의 지금 공개 상태(id → 공개 여부)
 */
export function planPublishSelection(
  listed: readonly string[],
  checked: readonly string[],
  current: ReadonlyMap<string, boolean>,
): PublishPlan {
  const listedSet = new Set(listed);
  const want = new Set(checked.filter((id) => listedSet.has(id)));
  const publish: string[] = [];
  const unpublish: string[] = [];
  for (const id of listedSet) {
    const now = current.get(id);
    if (now === undefined) continue; // 지워진 종목
    const next = want.has(id);
    if (next && !now) publish.push(id);
    if (!next && now) unpublish.push(id);
  }
  return { publish, unpublish };
}

export type PublishCoverage = {
  publishedCount: number;
  totalCount: number;
  /**
   * 공개 종목 평가액 ÷ 전체 종목 평가액(%) — 원화 환산 뒤.
   * 평가액을 아는 종목이 하나도 없으면 null(0%로 지어내지 않는다).
   */
  publishedValuePct: number | null;
  /** 수량·현재가가 없어 평가액을 모르는 종목 수 — 비율 계산에서 빠졌다고 밝힌다 */
  unvalued: number;
};

/**
 * 공개 종목이 계좌(종목 평가액 기준)에서 차지하는 몫.
 * ⚠ 값은 반드시 **원화로 환산된 것**을 받는다(`allocation.holdingValueKrw`) — 통화를 섞으면 통째로 틀린다.
 */
export function publishCoverage(
  items: readonly { published: boolean; valueKrw: number | undefined }[],
): PublishCoverage {
  let total = 0;
  let shown = 0;
  let unvalued = 0;
  for (const it of items) {
    if (it.valueKrw == null || !Number.isFinite(it.valueKrw)) {
      unvalued++;
      continue;
    }
    total += it.valueKrw;
    if (it.published) shown += it.valueKrw;
  }
  return {
    publishedCount: items.filter((it) => it.published).length,
    totalCount: items.length,
    publishedValuePct: total > 0 ? Math.round((shown / total) * 1000) / 10 : null,
    unvalued,
  };
}

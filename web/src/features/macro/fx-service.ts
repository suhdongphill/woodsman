/**
 * 원/달러 환율 한 개를 읽어 온다 — 질의 + 조립.
 *
 * ⚠ **판단은 `lib/fx-rate.ts`에 있다.** 여기서는 D1에서 최신 한 점을 꺼내 넘기기만 한다
 *    (CLAUDE.md §1). 낡음 기준·문구를 여기에 다시 적지 않는다.
 * ⚠ 기한 규칙은 **카탈로그에서 읽는다.** `fx.ts`의 `freq`·`staleDays`를 여기 베껴 두면
 *    출처를 바꿀 때 한쪽만 고쳐진다(2026-08-31에 실제로 출처를 바꿨다).
 */
import { loadSeries } from "./repository";
import { findIndicator } from "@/lib/macro/catalog";
import { resolveUsdKrw, type UsdKrwRate } from "@/lib/fx-rate";

/** 카탈로그의 지표 키. ⚠ 바꾸면 쌓아 둔 시계열이 끊긴다. */
const KEY = "usdkrw";

/**
 * 지금 쓸 환율. `setting`은 `SiteBasics.usdKrwRate`(관리자 설정값)다.
 *
 * ⚠ 수집값을 못 읽어도 **화면을 죽이지 않는다.** 다만 `console.error`로 남긴다 —
 *    "값이 없음"과 "읽지 못함"이 같은 화면이 되면 안 된다(CLAUDE.md §3).
 */
export async function loadUsdKrwRate(setting: number, now = new Date()): Promise<UsdKrwRate> {
  const indicator = findIndicator(KEY);
  let collected: { value: number; asOf: string } | null = null;

  try {
    const points = await loadSeries(KEY, 1);
    const last = points[points.length - 1];
    if (last) collected = { value: last.value, asOf: last.date };
  } catch (error) {
    console.error("[fx] 환율 수집값을 읽지 못했습니다. 설정값으로 떨어집니다.", error);
  }

  return resolveUsdKrw({
    collected,
    setting,
    freq: indicator?.freq ?? "d",
    staleDays: indicator?.staleDays,
    now,
  });
}

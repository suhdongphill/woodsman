/**
 * 운영 포트폴리오가 **주도주 칸 안에 있나 밖에 있나** — 판정·레이어별 평가액 비중. 순수 함수.
 *
 * ## 왜 (2026-09-25)
 * 사용자 요구: 「계좌들의 포트폴리오가 산업별로 주도주 안에 있는지 밖에 있는지 쉽게 보여야 한다」.
 * 볼트 「내 포트폴리오」 화면의 첫 막대를 관리자 화면으로 옮긴다 — 포털에서 실제 관리를 하기 위해서다.
 *
 * ⚠ 비중은 **원화로 환산한 평가액**으로 받는다(`allocation.holdingValueKrw`). 통화를 섞으면 통째로 틀린다.
 * ⚠ 평가액을 모르는 종목은 비중에서 빼고 **뺐다고 센다**. 판정이 없는 종목은 「판정 없음」으로 따로 둔다 —
 *   「판정 불가」(볼트가 보고 못 정한 것)와 「판정 없음」(아직 안 실은 것)은 다른 사실이다.
 */
import { CLASS_LABEL } from "@/lib/holding-tags";
import type { HoldingTags } from "@/lib/types";

/** 막대의 순서 — 안(주도주) → 경계(후발) → 밖(추격 주의·제외) → 모름. 볼트 화면과 같다. */
export const CLASS_ORDER = ["leader", "candidate", "watch", "out", "unknown", "none"] as const;
export type MixClass = (typeof CLASS_ORDER)[number];

export type MixItem = { valueKrw: number | undefined; tags?: HoldingTags };

export type MixRow = { key: string; label: string; pct: number; count: number };

export type VerdictMix = {
  byClass: (MixRow & { key: MixClass })[];
  /** 주도주 칸 안(leader) 비중 */
  insidePct: number;
  /** 그중 ★ 이상(prime·core) */
  starPct: number;
  /** 밖(추격 주의 + 제외) */
  outsidePct: number;
  /** 레이어별 — 비중 큰 순. 레이어 밖은 맨 끝 */
  byLayer: MixRow[];
  /** 평가액을 몰라 뺀 종목 수 */
  unvalued: number;
  /** 비중을 낸 종목 수 */
  valued: number;
};

const round1 = (x: number) => Math.round(x * 10) / 10;

function classOf(tags?: HoldingTags): MixClass {
  const c = tags?.leaderClass;
  // ⚠ 모르는 값은 「판정 없음」으로 — 이름을 지어 다른 칸에 넣지 않는다.
  return c && c in CLASS_LABEL ? (c as MixClass) : "none";
}

export function verdictMix(items: readonly MixItem[]): VerdictMix {
  const valued = items.filter((it) => it.valueKrw != null && Number.isFinite(it.valueKrw) && it.valueKrw > 0);
  const total = valued.reduce((s, it) => s + (it.valueKrw as number), 0);
  const pct = (v: number) => (total > 0 ? round1((v / total) * 100) : 0);

  const cls = new Map<MixClass, { value: number; count: number }>();
  const layer = new Map<string, { value: number; count: number }>();
  let star = 0;
  for (const it of valued) {
    const v = it.valueKrw as number;
    const k = classOf(it.tags);
    const c = cls.get(k) ?? { value: 0, count: 0 };
    cls.set(k, { value: c.value + v, count: c.count + 1 });
    if (k === "leader" && (it.tags?.leaderTier === "prime" || it.tags?.leaderTier === "core")) star += v;
    // 판정을 싣지 않은 종목은 레이어도 모른다 — 「레이어 밖」과 섞지 않는다.
    const ln = k === "none" ? "판정 없음" : (it.tags?.layerName ?? "레이어 밖");
    const l = layer.get(ln) ?? { value: 0, count: 0 };
    layer.set(ln, { value: l.value + v, count: l.count + 1 });
  }

  const byClass = CLASS_ORDER.filter((k) => cls.has(k)).map((k) => ({
    key: k,
    label: k === "none" ? "판정 없음" : CLASS_LABEL[k].label,
    pct: pct(cls.get(k)!.value),
    count: cls.get(k)!.count,
  }));
  const tailKeys = new Set(["레이어 밖", "판정 없음"]);
  const byLayer = [...layer.entries()]
    .map(([key, x]) => ({ key, label: key, pct: pct(x.value), count: x.count }))
    .sort((a, b) => Number(tailKeys.has(a.key)) - Number(tailKeys.has(b.key)) || b.pct - a.pct);

  const of = (k: MixClass) => cls.get(k)?.value ?? 0;
  return {
    byClass,
    insidePct: pct(of("leader")),
    starPct: pct(star),
    outsidePct: pct(of("watch") + of("out")),
    byLayer,
    unvalued: items.length - valued.length,
    valued: valued.length,
  };
}

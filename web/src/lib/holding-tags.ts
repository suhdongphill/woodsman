/**
 * 운영 포트폴리오 종목의 **볼트 판정 태그** — 순수 판단.
 *
 * ## 무엇인가 (2026-09-25)
 * 볼트(`D:\Woodsman\Investor`)의 주도주 모니터가 보유 종목 전부에 내는 판정을 그대로 싣는다
 * (`_data/portfolio-verdicts.json` → `export-portal-portfolio.py` → `ModelHolding`). 사용자 결정: 태그는 **로컬 판정 그대로**.
 * 판정 규칙은 볼트 `05_Methodology/주도주 판별 프레임 — 4단계·2×2 설계서.md` — 여기서 다시 계산하지 않는다.
 *
 * ⚠ 기계 값이다. 관리자 폼으로 고치지 않고, 재실행마다 덮어쓴다.
 * ⚠ **판정일 없이 보이지 않는다.** 날짜 없는 판정은 오늘 판정처럼 읽힌다(`manual-price`와 같은 이유).
 * ⚠ 모르는 판정 값은 그리지 않는다 — 볼트가 새 분류를 만들었는데 여기서 이름을 지어내면 뜻이 틀린다.
 */
import type { BadgeTone } from "@/components/ui/Badge";
import type { HoldingTags } from "@/lib/types";

/** 볼트 판정(2×2) — 이름은 볼트 화면과 같게 둔다. */
const CLASS_LABEL: Record<string, { label: string; tone: BadgeTone; hint: string }> = {
  leader: { label: "주도주", tone: "emerald", hint: "이익 성장과 가격이 함께 강하다" },
  candidate: { label: "후발 후보", tone: "info", hint: "성장은 강한데 가격이 아직 따라오지 않았다" },
  watch: { label: "추격 주의", tone: "warn", hint: "가격만 강하고 성장이 받쳐 주지 않는다" },
  out: { label: "제외", tone: "neutral", hint: "성장·가격 둘 다 약하다" },
  unknown: { label: "판정 불가", tone: "neutral", hint: "ETF이거나 재무 자료가 없다" },
};

const TIER_STARS: Record<string, string> = { prime: "★★", core: "★" };

const KIND_LABEL: Record<string, string> = { ETF: "ETF", DEPOSITARY_RECEIPT: "ADR" };

/** 판정이 이보다 오래되면 「오래됨」을 붙인다. 볼트 주도주 판정은 주 1회 돈다 — 한 주 + 하루. */
export const VERDICT_STALE_DAYS = 8;

type TagRow = {
  layer: string | null;
  layerName: string | null;
  leaderClass: string | null;
  leaderTier: string | null;
  assetKind: string | null;
  leverage: number | null;
  verdictFlag: string | null;
  verdictAsOf: string | null;
};

/** DB 행 → 태그. 전부 비어 있으면 `undefined`(아직 싣지 않은 종목 — 수기 종목이 그렇다). */
export function toHoldingTags(row: TagRow): HoldingTags | undefined {
  const tags: HoldingTags = {
    layer: row.layer ?? undefined,
    layerName: row.layerName ?? undefined,
    leaderClass: row.leaderClass ?? undefined,
    leaderTier: row.leaderTier ?? undefined,
    assetKind: row.assetKind ?? undefined,
    leverage: row.leverage ?? undefined,
    flag: row.verdictFlag ?? undefined,
    asOf: row.verdictAsOf ? String(row.verdictAsOf).slice(0, 10) : undefined,
  };
  return Object.values(tags).some((v) => v !== undefined) ? tags : undefined;
}

export type TagView = {
  /** 판정 칩. 모르는 값이면 없음 */
  verdict?: { label: string; stars: string; tone: BadgeTone; hint: string };
  /** 레이어 이름. 레이어 밖이면 "레이어 밖" */
  layer: string;
  /** 종류 칩 — ETF·ADR·레버리지. 개별주면 없음 */
  kind?: string;
  /** 경고 문장들 */
  flags: string[];
  asOf?: string;
  /** 판정일이 없거나 `VERDICT_STALE_DAYS`보다 오래됐다 */
  stale: boolean;
};

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** 화면에 그릴 모양으로. `today`는 YYYY-MM-DD. */
export function describeTags(tags: HoldingTags, today: string): TagView {
  const c = tags.leaderClass ? CLASS_LABEL[tags.leaderClass] : undefined;
  const lev = tags.leverage && tags.leverage > 1 ? `레버리지 ${Number(tags.leverage.toFixed(1))}배` : undefined;
  const kindName = tags.assetKind ? KIND_LABEL[tags.assetKind] : undefined;
  return {
    verdict: c
      ? {
          label: c.label,
          // ⚠ 별은 주도주에만 뜻이 있다. 다른 판정에 tier가 새어 들어와도 그리지 않는다.
          stars: tags.leaderClass === "leader" ? (TIER_STARS[tags.leaderTier ?? ""] ?? "") : "",
          tone: c.tone,
          hint: c.hint,
        }
      : undefined,
    layer: tags.layerName ?? "레이어 밖",
    kind: [kindName, lev].filter(Boolean).join(" · ") || undefined,
    flags: (tags.flag ?? "")
      .split(" · ")
      .map((s) => s.trim())
      .filter(Boolean),
    asOf: tags.asOf,
    stale: !tags.asOf || daysBetween(tags.asOf, today) > VERDICT_STALE_DAYS,
  };
}

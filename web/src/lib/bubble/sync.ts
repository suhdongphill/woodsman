/**
 * 볼트 자동 산출값 → 사이트 버블 판정(`BubbleReading`) 동기화 계획 — 순수 함수.
 *
 * ## 왜 (2026-10-26)
 * 사이트 판정은 `/admin/bubble`에서 사람이 넣을 때만 움직였다. 볼트 파이프라인(`fetch-edgar-l1.py` ·
 * `fetch-l2-valuation.py` · `fetch-bubble-auto.py` · FRED)은 매주 새로 계산하는데 **사이트로 넘어오는 길이 없어서**
 * 9/11~13 입력 뒤로 판정이 멈춰 있었다(가장 오래된 것 5/3). 운영자 「동기화 스크립트도 만들어 주세요」.
 *
 * ## 무엇을 넘기나 — 정의가 같은 키만
 * `SYNC_KEYS`에 적은 키만 넘긴다. 정의가 다른 키는 `NOT_SYNCED`에 이유와 함께 적는다 —
 * 같은 이름이라도 다른 것을 재면 넘기는 순간 화면이 거짓말을 한다(`move` — 볼트는 아직 Yahoo ^MOVE).
 *
 * ## 넘기지 않는 경우 (⚠ 조용히 덮어쓰지 않는다 — 이유를 돌려준다)
 * - 볼트 수집 오류(`fetch_err`) · 수집이 `staleDays`보다 오래됨 — 「수집 끊김」을 새 값처럼 넣지 않는다.
 * - 볼트 임계값(op·t1·t2)이 사이트 카탈로그 `scale`과 다름 — 점수는 볼트가 매기므로 눈금이 같아야 한다.
 *   사이트에 `scale`이 없는 키도 넘기지 않는다(대조할 수 없다).
 * - **사이트 판정이 더 새것** — 사람이 1차 출처로 넣은 값을 더 오래된 자동값으로 되돌리지 않는다
 *   (10/26 실제 사례: 볼트 TSMC는 8월에 멈췄고 사이트는 9월 보도자료로 넣었다).
 * - 값·점수·기준일이 모두 같음(멱등).
 */
import { findBubbleIndicator } from "./catalog";
import type { BubblePoints } from "./types";

/** 볼트 대시보드 `bubble-data` JSON의 지표 한 줄 중 쓰는 칸. */
export type VaultIndicator = {
  key: string;
  points?: number | null;
  value?: unknown;
  /** 자료 기준일(볼트 규약) */
  date?: string;
  /** 마지막 성공 수집 시각 */
  fetched_at?: string;
  fetch_err?: string;
  op?: string;
  t1?: number;
  t2?: number;
  src?: string;
};

export type SiteReadingLite = {
  indicatorKey: string;
  points: number;
  value?: string | null;
  /** YYYY-MM-DD */
  asOf?: string | null;
};

/**
 * 넘기는 키와 기준일을 무엇으로 잡나.
 * - `date` — 볼트 `date`(자료 기준일: 분기·월·관측일)
 * - `fetched` — 시세로 매기는 비율이라 **수집일**이 기준일이다. 볼트 `date`는 매출 TTM 분기라 값 끝에 따로 적는다.
 */
export const SYNC_KEYS: Record<string, "date" | "fetched"> = {
  capex_yoy: "date",
  capex_to_ocf: "date",
  roi_gap: "date",
  debt_funded: "date",
  kr_fwd_pe: "date",
  semi_ps: "fetched",
  nvda_ev_sales: "fetched",
  concentration: "date",
  peg: "date",
  memory_inventory: "date",
  tsmc_rev_yoy: "date",
  hy_oas: "date",
  vix: "date",
  tga_4w: "date",
  hyper_ig_leverage: "date",
  retail_froth: "date",
  insider_sell: "date",
};

/** 정의가 달라 넘기지 않는 키 — 볼트를 사이트 정의로 맞추면 `SYNC_KEYS`로 옮긴다. */
export const NOT_SYNCED: Record<string, string> = {
  move: "볼트는 Yahoo ^MOVE(ICE MOVE 아님) — 사이트는 10년물 20일 실현변동성(2026-09-14 운영자 결정)",
};

export const STALE_DAYS = 14;
const VALUE_MAX = 500;

export type SyncDecision =
  | { key: string; action: "write"; points: BubblePoints; value: string; asOf: string; note: string; reason: string }
  | { key: string; action: "skip"; reason: string };

/** 볼트 값(HTML 섞인 문자열)을 화면 문장으로. */
export function plainValue(v: unknown): string {
  const s = String(v ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return s.length > VALUE_MAX ? `${s.slice(0, VALUE_MAX - 1)}…` : s;
}

function day(s: string | undefined | null): string | undefined {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(s ?? ""));
  return m ? m[1] : undefined;
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export function planBubbleSync(
  vault: VaultIndicator[],
  site: SiteReadingLite[],
  today: string,
  staleDays = STALE_DAYS,
): SyncDecision[] {
  const byKey = new Map(vault.map((v) => [v.key, v]));
  const siteByKey = new Map(site.map((r) => [r.indicatorKey, r]));
  const out: SyncDecision[] = [];

  for (const [key, mode] of Object.entries(SYNC_KEYS)) {
    const skip = (reason: string) => out.push({ key, action: "skip", reason });
    const v = byKey.get(key);
    const cat = findBubbleIndicator(key)?.indicator;
    if (!cat) { skip("사이트 카탈로그에 없는 키"); continue; }
    if (!v) { skip("볼트에 없음"); continue; }
    if (v.fetch_err) { skip(`볼트 수집 오류: ${v.fetch_err}`); continue; }

    const fetched = day(v.fetched_at);
    if (!fetched) { skip("볼트 수집 시각이 없다(자동 수집 줄이 아님)"); continue; }
    if (daysBetween(fetched, today) > staleDays) { skip(`볼트 수집 끊김(마지막 ${fetched})`); continue; }

    if (v.points !== 0 && v.points !== 1 && v.points !== 2) { skip("볼트 점수가 0·1·2가 아니다"); continue; }

    if (!cat.scale) { skip("사이트 카탈로그에 눈금(scale)이 없어 대조할 수 없다"); continue; }
    if (v.op !== cat.scale.op || Number(v.t1) !== cat.scale.t1 || Number(v.t2) !== cat.scale.t2) {
      skip(`임계값 불일치 — 볼트 ${v.op} ${v.t1}/${v.t2} · 사이트 ${cat.scale.op} ${cat.scale.t1}/${cat.scale.t2}`);
      continue;
    }

    const dataDay = day(v.date);
    const asOf = mode === "fetched" ? fetched : dataDay;
    if (!asOf) { skip("볼트 기준일이 없다"); continue; }

    let value = plainValue(v.value);
    if (!value) { skip("볼트 값이 비었다"); continue; }
    if (mode === "fetched" && dataDay && dataDay !== fetched) value = plainValue(`${value} · 시세 ${fetched} 수집, 매출 TTM은 ${dataDay} 분기까지`);

    const s = siteByKey.get(key);
    const siteDay = day(s?.asOf);
    if (siteDay && siteDay > asOf) { skip(`사이트 판정이 더 새것(${siteDay} > ${asOf}) — 되돌리지 않는다`); continue; }
    if (s && s.points === v.points && (s.value ?? "") === value && siteDay === asOf) { skip("같음"); continue; }

    out.push({
      key,
      action: "write",
      points: v.points,
      value,
      asOf,
      note: `볼트 자동 동기화(bubble-sync) · 볼트 수집 ${fetched} · 원천: ${plainValue(v.src) || "—"} · 자료 기준일 ${dataDay ?? "—"}`,
      reason: s ? `${s.points}점(${siteDay ?? "날짜 없음"}) → ${v.points}점(${asOf})` : `새로 ${v.points}점(${asOf})`,
    });
  }

  for (const [key, why] of Object.entries(NOT_SYNCED)) out.push({ key, action: "skip", reason: `정의가 다름 — ${why}` });
  return out;
}

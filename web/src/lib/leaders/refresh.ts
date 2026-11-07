/**
 * 주도주 최신화 요청 — 순수 판단 (2026-11-07, 운영자 「주도주 분석 시간이 오래 되었네요. 최신화 기능을 만들어 줘요」).
 *
 * ## 왜 「요청」인가
 * 주도주 판정은 사이트가 계산하지 않는다. 볼트(운영자 PC)의 `fetch-leaders.py`가 계산해 D1에 싣는다.
 * 사이트 버튼은 D1에 요청 한 줄을 남기고, PC의 `refresh-leaders-on-request.ps1`이 그것을 집어 돌린다.
 * ⚠ 그래서 **PC가 켜져 있어야** 돈다. 화면이 이 사실을 말한다 — 눌렀는데 조용히 멈춰 있으면 안 된다.
 */
export type RefreshStatus = "REQUESTED" | "RUNNING" | "DONE" | "FAILED";

export type RefreshRequest = {
  id: string;
  requestedAt: string;
  status: RefreshStatus;
  startedAt?: string | null;
  finishedAt?: string | null;
  note?: string | null;
};

/** 판정이 이보다 오래되면 화면이 알린다 — 주간 파이프라인 주기(7일). */
export const LEADER_STALE_DAYS = 7;
/** 이만큼 지나도 시작 안 했으면 PC가 꺼져 있는 것으로 본다(호출 주기 1시간 + 여유). */
const NOT_PICKED_UP_MS = 2 * 60 * 60 * 1000;
/** 돌기 시작하고 이만큼 지나면 멈춘 것으로 본다(평소 5분 · 단계별 제한의 합보다 길게). */
const STUCK_MS = 60 * 60 * 1000;

const ms = (iso?: string | null) => (iso ? Date.parse(iso) : Number.NaN);

export type RefreshView = {
  /** 지금 새 요청을 받을 수 있나 */
  canRequest: boolean;
  /** 화면 한 줄 */
  line: string;
  tone: "idle" | "busy" | "warn";
};

export function refreshView(latest: RefreshRequest | null | undefined, now: Date): RefreshView {
  if (!latest) return { canRequest: true, line: "아직 요청한 적이 없습니다.", tone: "idle" };
  const t = now.getTime();
  switch (latest.status) {
    case "REQUESTED":
      return t - ms(latest.requestedAt) > NOT_PICKED_UP_MS
        ? { canRequest: true, line: "요청이 2시간 넘게 시작되지 않았습니다. PC가 꺼져 있거나 절전 중일 수 있습니다.", tone: "warn" }
        : { canRequest: false, line: "요청을 받았습니다. PC가 켜져 있으면 1시간 안에 시작합니다.", tone: "busy" };
    case "RUNNING":
      return t - ms(latest.startedAt) > STUCK_MS
        ? { canRequest: true, line: "1시간 넘게 끝나지 않았습니다. 멈춘 것으로 보입니다.", tone: "warn" }
        : { canRequest: false, line: "지금 계산하고 있습니다. 보통 5분쯤 걸립니다.", tone: "busy" };
    case "FAILED":
      return { canRequest: true, line: `지난 요청이 실패했습니다${latest.note ? ` — ${latest.note}` : ""}.`, tone: "warn" };
    case "DONE":
      return { canRequest: true, line: "지난 요청이 끝났습니다.", tone: "idle" };
  }
}

/** 판정이 며칠 지났나. `collectedAt`은 볼트가 적은 KST `YYYY-MM-DD HH:MM`. 못 읽으면 `null`(0일로 만들지 않는다). */
export function leaderAgeDays(collectedAt: string | null | undefined, now: Date): number | null {
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/.exec(collectedAt ?? "");
  if (!m) return null;
  const at = Date.parse(`${m[1]}T${m[2]}:00+09:00`);
  if (!Number.isFinite(at)) return null;
  return Math.max(0, Math.floor((now.getTime() - at) / 86_400_000));
}

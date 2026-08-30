/**
 * 관리자 활동 로그 — 판단·표현을 맡는 순수 모듈.
 *
 * ## 왜 만들었나
 * ⚠ 2026-08-30에 「편집을 눌러도 아무 일이 없다」를 **재현으로 반나절 걸려** 좁혔다.
 *    이 기록이 있었으면 *"편집 화면 열림이 하나도 없고 새 글 저장만 쌓였다"* 를 보고
 *    10분에 끝났다. 이 프로젝트가 반복해서 데인 것은 전부 **조용한 실패**이고,
 *    관리자 행위 기록은 그 계열의 마지막 빈칸이었다.
 *
 * ## 규칙
 * - **키는 안정된 값**(`post.create`)이고, 화면 문구는 여기서 만든다. DB에 한국어 문장을
 *   쌓으면 문구를 고치는 순간 옛 기록과 새 기록이 서로 다른 말을 한다.
 * - ⚠ **모르는 키를 감추지 않는다.** 라벨이 없으면 키를 그대로 보여준다 — 빈칸으로 두면
 *   "기록이 없는 것"과 "라벨을 안 만든 것"이 같아 보인다.
 * - ⚠ 요약에 **비밀번호·API 키·토큰을 담지 않는다**(호출부의 책임이지만 여기 적어 둔다).
 */

/** 기록하는 행위. ⚠ 값을 바꾸면 옛 기록이 미아가 된다 — 더하기만 한다. */
export const ADMIN_ACTIONS = {
  "post.create": "글 작성",
  "post.update": "글 수정",
  "post.delete": "글 삭제",
  "macro.ingest": "거시 자료 가져오기",
  "site.basics": "사이트 기본값 변경",
  "ads.settings": "광고 설정 변경",
  "release.create": "릴리스 기록",
  "release.delete": "릴리스 기록 삭제",
} as const;

export type AdminAction = keyof typeof ADMIN_ACTIONS;

export type AdminLogEntry = {
  id: string;
  at: string;
  actor: string;
  action: string;
  target?: string;
  summary?: string;
};

/** 화면에 쓰는 이름. ⚠ 모르는 키는 키 그대로 — 감추지 않는다. */
export function actionLabel(action: string): string {
  return (ADMIN_ACTIONS as Record<string, string>)[action] ?? action;
}

/**
 * ⚠ **지금 기록하는 자리**를 화면이 그대로 말하게 한다.
 *
 * 부분만 기록하는 로그의 가장 큰 위험은 **없는 것을 "안 한 것"으로 읽는 것**이다.
 * 어디를 기록하고 어디를 아직 안 하는지 화면에 적어 두면 그 오해가 생기지 않는다.
 */
export const LOGGED_AREAS = [
  "콘텐츠(작성·수정·삭제)",
  "거시 지표 자료 가져오기",
  "사이트 기본값",
  "릴리스 기록",
  "광고 설정",
] as const;

/** 아직 기록하지 않는 자리. 비워 두지 말고 적는다. */
export const UNLOGGED_AREAS = [
  "투자일지 · 계좌 스냅숏",
  "대표 포트폴리오",
  "종목 보고서",
  "댓글 · 정책",
  "버블 모니터",
  "AI 제공자 설정",
] as const;

/** 글 저장 한 줄 요약 — 제목은 길 수 있으니 자른다. */
export function postSummary(title: string, published: boolean): string {
  const head = title.length > 60 ? `${title.slice(0, 60)}…` : title;
  return `${head} · ${published ? "발행" : "작성중"}`;
}

/**
 * ⚠ **날짜·시각은 한국 시간으로 읽는다.** 기록은 UTC로 쌓지만, 보는 사람은 KST로 산다.
 *    UTC로 보여 주면 밤에 한 일이 어제 일로 보이고, 그 순간 기록을 못 믿게 된다.
 *
 * 시간대를 **명시**한다 — 서버(UTC)와 브라우저(KST)가 각자 판단하면 같은 기록이
 * 두 날짜로 보인다.
 */
const SEOUL = "Asia/Seoul";

/** ISO → `2026-08-30` (KST 기준) */
export function seoulDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  // en-CA는 YYYY-MM-DD로 준다 — 문자열 조립보다 안전하다.
  return d.toLocaleDateString("en-CA", { timeZone: SEOUL });
}

/** ISO → `14:05` (KST 기준) */
export function seoulTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-GB", {
    timeZone: SEOUL,
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** 로그를 날짜(KST)별 덩어리로 묶는다. 목록은 이미 최근 것부터 정렬돼 온다. */
export function groupByDay(entries: AdminLogEntry[]): { day: string; items: AdminLogEntry[] }[] {
  const days: { day: string; items: AdminLogEntry[] }[] = [];
  for (const entry of entries) {
    const day = seoulDay(entry.at);
    const last = days[days.length - 1];
    if (last && last.day === day) last.items.push(entry);
    else days.push({ day, items: [entry] });
  }
  return days;
}

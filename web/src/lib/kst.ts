/**
 * 한국 시간(KST) 표시 — 순수 모듈.
 *
 * ## ⚠ 왜 따로 있나
 * 기록은 UTC로 쌓지만 **보는 사람은 KST로 산다.** UTC로 보여 주면 밤에 한 일이 어제 일로
 * 보이고, 그 순간 기록을 못 믿게 된다.
 *
 * ⚠ 시간대를 **명시**한다. 서버(UTC)와 브라우저(KST)가 각자 판단하면 같은 값이 두 날짜로 보인다.
 * ⚠ 이 판단은 **한 곳에만** 둔다 — 활동 로그·경제 캘린더가 같은 함수를 쓴다.
 *    (2026-08-30: 원래 `admin-log.ts`에 있던 것을 캘린더가 쓰게 되면서 여기로 옮겼다.)
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

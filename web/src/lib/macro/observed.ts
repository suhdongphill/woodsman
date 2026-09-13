/**
 * 관측일이 미래인 점은 관측이 아니다 — 순수 함수.
 *
 * ## 왜 필요한가 (2026-09-14)
 * 잠재산출(`GDPPOT`)은 **2036년까지 값이 있다.** 의회예산처의 전망이 같은 계열에 붙어 오기 때문이다.
 * 파이프라인은 마지막 점을 「최신」으로 잡으므로, 그대로 받으면 화면이 **「2036-10-01 기준」**이라고 말하고
 * 전년비·신선도·기준일 대조가 전부 미래 값 위에서 돈다.
 *
 * ⚠ **계열 하나를 위한 예외로 막지 않는다.** 앞으로 붙일 추계·전망 계열 전부에 같은 함정이 있다.
 *   그래서 수집기 입구에서 **일반 규칙**으로 막는다.
 *
 * ## ⚠ 조용히 버리지 않는다
 * 버린 개수를 돌려주고, 수집기가 `MacroIngest.detail`에 남긴다. 「받았는데 몇 점이 사라졌다」와
 * 「원래 없었다」가 같은 화면이 되면 안 된다(CLAUDE.md §3).
 *
 * ## 「오늘」은 누구의 오늘인가
 * **KST 기준 오늘**이다(수집기의 다른 날짜 판단과 같다). 날짜만 있는 문자열끼리 비교하므로
 * 오늘 날짜의 점은 **남긴다** — 오늘 관측한 값은 미래가 아니다.
 */
import type { SeriesPoint } from "./series";

export function dropFuturePoints(
  points: SeriesPoint[],
  /** `YYYY-MM-DD` — 이 날짜보다 **뒤**인 점을 버린다 */
  today: string,
): { kept: SeriesPoint[]; dropped: number; firstDropped?: string } {
  const kept: SeriesPoint[] = [];
  let dropped = 0;
  let firstDropped: string | undefined;
  for (const p of points) {
    if (p.date > today) {
      dropped += 1;
      if (!firstDropped || p.date < firstDropped) firstDropped = p.date;
    } else {
      kept.push(p);
    }
  }
  return { kept, dropped, ...(firstDropped ? { firstDropped } : {}) };
}

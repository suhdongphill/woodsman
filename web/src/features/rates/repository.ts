/**
 * `rates.json`을 읽어 온다.
 *
 * ## ⚠ 프런트에서 외부 API를 직접 부르지 않는다 (명세 §6)
 * 이 화면은 **이 파일 하나만** 읽는다. FRED·ECOS를 브라우저나 서버 라우트에서 다시 부르면
 * 같은 숫자가 두 경로로 들어오고, 어느 쪽이 맞는지 아무도 모르게 된다.
 * 만드는 쪽은 `pms rates export`다(파이썬).
 *
 * ## ⚠ 경로를 갈라 놓지 않는다
 * 로컬(`next dev`)과 배포본(Workers)이 **같은 방식**으로 읽는다 — 사이트 자기 자신의
 * 정적 자산 주소를 부른다. 로컬은 파일에서, 배포는 바인딩에서… 처럼 갈라 두면
 * "로컬은 되는데 배포만 죽는" 사고가 난다(CLAUDE.md 3장).
 *
 * ## ⚠ 없으면 없다고 말한다
 * 파일이 아직 없을 수 있다(수집을 한 번도 안 돌린 상태). 그때 빈 화면을 그리지 않고
 * **왜 비었는지**를 화면이 말하게 `null`을 돌려준다.
 */
import { absoluteUrl } from "@/lib/site-url";
import type { RatesPayload } from "@/lib/rates";

/** 정적 자산이라 자주 바뀌지 않는다. 스케줄러가 하루 한 번 새로 올린다. */
const REVALIDATE_SECONDS = 900;

export async function loadRates(): Promise<RatesPayload | null> {
  const url = absoluteUrl("/data/rates.json");

  try {
    const response = await fetch(url, { next: { revalidate: REVALIDATE_SECONDS } });
    if (!response.ok) {
      // ⚠ 삼키지 않는다. 404(아직 안 만듦)와 500(서빙 실패)은 다른 상태다.
      console.error(`[rates] ${url} 응답 ${response.status}`);
      return null;
    }
    return (await response.json()) as RatesPayload;
  } catch (error) {
    console.error("[rates] rates.json을 읽지 못했습니다", error);
    return null;
  }
}

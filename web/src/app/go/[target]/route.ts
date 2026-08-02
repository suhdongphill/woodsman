import { notFound } from "next/navigation";
import { clickDateKey, resolveOutbound } from "@/lib/outbound";
import { recordClick } from "@/lib/outbound-repo";

/**
 * 아웃바운드 경유 — 클릭을 세고 목적지로 넘긴다.
 *
 * ⚠ 목적지를 쿼리로 받지 않는다. 등록된 대상만 허용해 오픈 리다이렉트를 막는다.
 * ⚠ 집계 실패가 이동을 막으면 안 된다. DB가 죽어도 사용자는 블로그로 가야 한다.
 * ⚠ **응답을 캐시하지 못하게 한다.** 리다이렉트가 엣지·브라우저에 캐시되면 두 번째부터는
 *    이 코드가 아예 실행되지 않아 클릭이 누락된다(실제로 3회 중 1회만 집계됐다).
 *    그래서 next/navigation의 redirect() 대신 헤더를 직접 붙인 Response를 돌려준다.
 */
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ target: string }> },
) {
  const { target } = await params;
  const destination = resolveOutbound(target);
  if (!destination) notFound();

  try {
    await recordClick(target, clickDateKey(new Date()));
  } catch (error) {
    // 집계는 부가 기능이라 이동을 막지 않는다. 다만 조용히 넘기지는 않는다 —
    // 집계가 0인데 이유를 모르는 상태가 되면 성과 판단 자체가 불가능해진다.
    console.error("[outbound] 클릭 집계 실패", error);
  }

  return new Response(null, {
    // 302 — 영구 이동이 아니다. 대표 글이 바뀔 수 있으므로 고정되면 곤란하다.
    status: 302,
    headers: {
      location: destination,
      "cache-control": "no-store, no-cache, must-revalidate",
      // 외부로 나갈 때 우리 경로가 리퍼러로 새지 않게 한다.
      "referrer-policy": "no-referrer",
    },
  });
}

import { notFound } from "next/navigation";
import { clickDateKey, outboundDestinations, resolveOutbound } from "@/lib/outbound";
import { normalizePath } from "@/lib/analytics";
import { getSiteBasics } from "@/lib/site-settings";
import { findPostBySlug } from "@/features/posts/repository";
import { findPublishedTistoryUrl } from "@/features/reports/repository";
import { recordClick } from "@/lib/outbound-repo";
import { recordOutboundSource } from "@/features/analytics/engagement-repository";

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

/**
 * 클릭이 **어느 화면에서** 났는지 알아낸다.
 *
 * 같은 출처에서 온 링크 클릭은 브라우저가 `Referer`에 전체 URL을 실어 준다
 * (기본 정책 `strict-origin-when-cross-origin`은 동일 출처에 한해 전체 경로를 보낸다).
 * ⚠ 여기서 **경로만 뽑고 쿼리는 버린다**(`normalizePath`). 검색어·UTM에 개인정보가 실릴 수 있다.
 * ⚠ 리퍼러 원문은 어디에도 저장하지 않는다. 남는 것은 정규화된 사이트 내부 경로뿐이다.
 * ⚠ 목적지는 여전히 **등록된 대상만**이다 — 리퍼러는 집계에만 쓰고 이동에 쓰지 않는다.
 */
function sourcePathFrom(referer: string | null): string | null {
  if (!referer) return null;
  try {
    return normalizePath(new URL(referer).pathname);
  } catch {
    return null;
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ target: string }> },
) {
  const { target } = await params;
  // 글 경유(post-<slug>)는 DB에 저장된 티스토리 원문 URL로만 간다.
  const tistoryUrl = target.startsWith("post-")
    ? (await findPostBySlug(target.slice("post-".length)))?.externalUrl
    : undefined;
  // 종목 보고서 경유(stock-<ticker>)도 같은 규칙이다 — 저장해 둔 원문 URL로만 간다.
  // ⚠ 티커는 문자열로 다룬다. 숫자로 만지면 005930이 5930이 된다.
  const stockUrl = target.startsWith("stock-")
    ? await findPublishedTistoryUrl(target.slice("stock-".length))
    : null;
  // ⚠ 목적지는 /admin/settings에서 바꾼 값을 쓴다. 코드 상수로만 가면
  //    운영자가 블로그 주소를 바꿔도 방문자는 옛 주소로 간다(1순위 목적의 경로다).
  const basics = await getSiteBasics();
  const destination = resolveOutbound(
    target,
    () => tistoryUrl,
    outboundDestinations(basics),
    () => stockUrl,
  );
  if (!destination) notFound();

  try {
    const date = clickDateKey(new Date());
    await recordClick(target, date);

    // ⚠ 출처 집계는 **부가**다. 실패해도 1순위 지표(recordClick)는 이미 올라가 있다.
    //    순서를 바꾸지 말 것 — 출처를 먼저 쓰다 죽으면 클릭 자체가 누락된다.
    const from = sourcePathFrom(request.headers.get("referer"));
    if (from) await recordOutboundSource({ path: from, target, date });
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

import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { siteUrl } from "@/lib/site-url";
import { viewDateKey } from "@/lib/analytics";
import { renderTistoryHtml } from "@/lib/report/tistory";
import { loadReport } from "@/features/reports/repository";
import { loadContext } from "@/features/reports/context-repo";

/**
 * 티스토리용 HTML **미리보기**.
 *
 * ## 왜 라우트인가
 * 붙여 넣기 전에 **실제로 어떻게 보이는지** 눈으로 봐야 한다. 편집 화면의 칸에서는
 * 태그 문자열만 보인다. 여기서는 브라우저가 그대로 그려 준다 —
 * 티스토리에 붙여 넣었을 때와 같은 판이다(인라인 스타일뿐이라 외부 CSS가 없다).
 *
 * ⚠ **관리자 전용**이다. 초안도 내보낼 수 있으므로 공개되면 미발행 보고서가 새어 나간다.
 * ⚠ 검색엔진에 색인되지 않게 `noindex`를 붙인다 — 같은 내용이 두 주소에 잡히면
 *    사이트 본문과 중복 색인이 된다.
 */
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await params;
  await requireAdmin(`/admin/stocks/${ticker}`);

  const report = await loadReport(ticker);
  if (!report) notFound();

  const snapshot = await loadContext(report.ticker);
  const fragment = renderTistoryHtml({
    report,
    snapshot,
    siteUrl: siteUrl(),
    today: viewDateKey(new Date()),
  });

  // ⚠ 미리보기에서만 문서 껍데기를 씌운다. **복사해 가는 것은 조각뿐**이다
  //    (티스토리는 head·style을 받지 않는다).
  const page = `<!doctype html><html lang="ko"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>티스토리 미리보기 · ${report.ticker}</title>
</head><body style="margin:0;background:#05080f;padding:20px 0">${fragment}</body></html>`;

  return new Response(page, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

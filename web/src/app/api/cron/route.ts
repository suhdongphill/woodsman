/**
 * 자동 수집 실행 경로.
 *
 * ## 왜 라우트인가
 * 스케줄 핸들러(`worker.js`)는 Next 번들 **바깥**에 있어서 `getCloudflareContext()`로 붙는
 * D1 바인딩을 그대로 쓸 수 없다. 그래서 스케줄은 이 경로를 한 번 두드리고, 실제 수집은
 * 관리자 버튼과 **똑같은 함수**(`ingestMacro`·`ingestQuotes`)가 한다.
 * ⚠ 같은 판단을 두 번 구현하지 않는다(운영지침 §1) — 자동과 수동의 결과가 갈리면 안 된다.
 *
 * ## 규칙
 * - ⚠ **시크릿 헤더 없이는 아무것도 하지 않는다.** 바깥 서버를 대신 두드리는 경로다.
 * - ⚠ **작업 하나가 죽어도 나머지는 간다.** 다만 실패는 응답과 로그 양쪽에 남긴다
 *   (CLAUDE.md 3장). 조용히 성공으로 끝나는 것이 이 프로젝트에서 가장 크게 데인 사고다.
 * - ⚠ 결과는 `MacroIngest`·`StockQuoteIngest`에 `trigger: "CRON"`으로 쌓인다.
 *   `/admin/macro`가 「자동/수동」을 구분해 보여준다 — 안 돌고 있으면 화면에서 보여야 한다.
 */
import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { revalidatePath } from "next/cache";
import {
  CRON_HEADER,
  allSucceeded,
  cronSummary,
  isAuthorizedCron,
  planForCron,
  type CronJob,
  type CronJobResult,
} from "@/lib/cron";
import { ingestMacro } from "@/features/macro/ingest";
import { ingestQuotes } from "@/features/stocks/ingest";
import { loadReportSummaries } from "@/features/reports/repository";
import { computeAndSaveGcrm, gcrmToday } from "@/features/gcrm/compute";

export const runtime = "nodejs";
/** ⚠ 정적 생성 금지 — 매 실행마다 바깥에서 받아 와야 한다. */
export const dynamic = "force-dynamic";

async function readCronSecret(): Promise<string | undefined> {
  const { env } = await getCloudflareContext({ async: true });
  const value = (env as unknown as Record<string, unknown>).CRON_SECRET;
  return typeof value === "string" ? value : undefined;
}

/** 거시 지표 — 관리자 버튼과 같은 경로다. */
async function runMacro(): Promise<CronJobResult> {
  const result = await ingestMacro({ trigger: "CRON" });
  return {
    job: "macro",
    ok: true,
    okCount: result.okCount,
    failCount: result.failCount,
    addedPoints: result.addedPoints,
  };
}

/**
 * 보고서가 있는 종목의 시세.
 * ⚠ 보고서가 하나도 없으면 **실패가 아니다.** 아직 담을 것이 없는 상태와 고장을 구분한다.
 */
async function runQuotes(): Promise<CronJobResult> {
  const summaries = await loadReportSummaries();
  if (summaries.length === 0) {
    return { job: "quotes", ok: true, okCount: 0, failCount: 0, addedPoints: 0 };
  }

  const result = await ingestQuotes(
    summaries.map((s) => ({ ticker: s.ticker, market: s.market })),
    { trigger: "CRON" },
  );
  return {
    job: "quotes",
    ok: true,
    okCount: result.okCount,
    failCount: result.failCount,
    addedPoints: result.addedPoints,
  };
}

/**
 * GCRM 축 점수 — ⚠ **수집 뒤에 돈다**(`ALL_CRON_JOBS` 순서).
 *
 * ## 왜 매일 저장하나
 * 레짐 판정의 **방향**은 과거 축 점수를 본다(조류는 63영업일 전과 비교 — 명세 §2-8).
 * 그 과거는 **저장된 run에서만** 나온다. 2026-09-20까지 저장하는 경로가 `/api/gcrm/run`뿐이었고
 * 아무도 부르지 않아, 축 이력이 **하루도 쌓이지 않고 있었다.** 그래서 종합 점수는 나와도
 * 레짐은 영원히 R0였다 — 자료가 모자라서가 아니라 **시간이 안 쌓여서**다.
 *
 * ⚠ **하루 한 점이다.** 같은 `asOf`에 두 번 저장하지 않는다(`CRON_PLAN`의 22:00 항목 주석).
 * ⚠ `basis`는 `LIVE` — 그날 알려진 값으로 그날을 계산한 것이다. 과거를 되살린 `RECOMPUTED`와
 *    **섞이면 안 된다**(P9 백테스트가 그 구분 위에 선다).
 * ⚠ 점수가 안 나오는 것(커버리지 미달)은 **실패가 아니다.** 게이트가 일한 것이고, 그 사실이
 *    저장되는 것 자체가 기록이다. 고장과 「아직 못 냄」을 같아 보이게 하지 않는다.
 */
async function runGcrm(): Promise<CronJobResult> {
  const summary = await computeAndSaveGcrm({ asOf: gcrmToday(), basis: "LIVE" });
  const axes = summary.result.axes;
  const scored = (["tide", "wind", "wave"] as const).filter((a) => axes[a].status === "OK").length;
  return {
    job: "gcrm",
    ok: true,
    // 「낸 축 / 3」을 성공 수로 쓴다 — 0이어도 실패가 아니다(커버리지 게이트).
    okCount: scored,
    failCount: 3 - scored,
    addedPoints: summary.saved,
  };
}

const RUNNERS: Record<CronJob, () => Promise<CronJobResult>> = {
  macro: runMacro,
  quotes: runQuotes,
  gcrm: runGcrm,
};

export async function POST(request: Request) {
  const secret = await readCronSecret().catch((error) => {
    // ⚠ 삼키지 않는다. "시크릿이 없는 것"과 "context를 못 읽은 것"이 같아 보이면 안 된다.
    console.error("[cron] CRON_SECRET을 읽지 못했습니다", error);
    return undefined;
  });

  if (!isAuthorizedCron(request.headers.get(CRON_HEADER), secret)) {
    // ⚠ 왜 거부됐는지 응답에 적지 않는다(시크릿 유무를 알려주는 꼴이 된다). 로그에만 남긴다.
    console.error("[cron] 인증되지 않은 호출을 거부했습니다");
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const cron = new URL(request.url).searchParams.get("cron");
  const plan = planForCron(cron);
  if (!plan.known) {
    // ⚠ 큰 소리로 남긴다. 설정만 고치고 코드를 안 고친 상태다.
    console.error(
      `[cron] 계획에 없는 스케줄입니다(cron=${cron ?? "없음"}). 전부 돌립니다 — src/lib/cron.ts의 CRON_PLAN을 맞추세요.`,
    );
  }

  const results: CronJobResult[] = [];
  for (const job of plan.jobs) {
    try {
      results.push(await RUNNERS[job]());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[cron] ${job} 실행 실패`, error);
      results.push({ job, ok: false, error: message });
    }
  }

  // 새 값이 들어왔으면 공개 화면도 같이 바뀌어야 한다.
  for (const path of ["/", "/macro", "/portfolio", "/stocks"]) revalidatePath(path);

  const summary = cronSummary(results);
  console.log(`[cron] ${summary}`);

  return NextResponse.json(
    { ok: allSucceeded(results), knownSchedule: plan.known, summary, results },
    { status: allSucceeded(results) ? 200 : 500 },
  );
}

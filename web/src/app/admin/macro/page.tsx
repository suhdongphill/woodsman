import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader, AdminShell } from "@/components/layout/AdminPageHeader";
import { Card, CardTitle } from "@/components/ui/Card";
import { Table, Th, Td, Tr } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { StatTile } from "@/components/ui/StatBar";
import { formatDate } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { manualIndicators } from "@/lib/macro/catalog";
import { findMacroGroup } from "@/lib/macro/groups";
import { loadMacroStatus } from "@/features/macro/service";
import { loadIngestRuns, countPointsBySeries } from "@/features/macro/repository";
import { readRuntimeEnv } from "@/lib/runtime-env";
import { CRON_PLAN, CRON_SECRET_LABEL, cronSecretState, nextDailyRun } from "@/lib/cron";
import { seoulTime, seoulDay } from "@/lib/kst";
import { IngestPanel } from "@/features/macro/ui/IngestPanel";
import { ManualPointForm } from "@/features/macro/ui/ManualPointForm";
import { ExtractPanel } from "@/features/macro/ui/ExtractPanel";
import { SignalPill } from "@/features/macro/ui/SignalPill";

export const metadata: Metadata = { title: "거시 지표" };

/** ⚠ 정적 생성 금지 — 자료를 가져와도 화면이 안 바뀐다. */
export const dynamic = "force-dynamic";

/** 며칠 지났는지. 오래된 지표를 위로 올리려고 쓴다. */
function ageDays(asOf: string | undefined, today: string): number | undefined {
  if (!asOf) return undefined;
  return Math.round((Date.parse(today) - Date.parse(asOf)) / 86_400_000);
}

/**
 * 거시 지표 관리.
 *
 * ⚠ 이 화면의 핵심은 "무엇이 안 들어왔나"다. 성공 목록은 훑고 지나가면 되지만,
 *    실패·오래된 지표는 눈에 띄어야 한다(정렬을 오래된 순으로 두는 이유).
 */
export default async function AdminMacroPage() {
  await requireAdmin("/admin/macro");

  const [status, runs, counts, cronSecret] = await Promise.all([
    loadMacroStatus(),
    loadIngestRuns(5),
    countPointsBySeries(),
    // ⚠ 값을 쓰려는 게 아니다. **등록됐는지 길이만** 본다(화면에도 값은 안 나간다).
    readRuntimeEnv("CRON_SECRET"),
  ]);

  /**
   * ⚠ 자동 수집이 실제로 켜져 있는가.
   *    9월 1일에 스케줄을 만들어 두고도 시크릿이 없어 **나흘간 한 번도 돌지 않았는데**,
   *    그 사실을 화면 어디에서도 알 수 없었다. 이 카드가 그 자리다.
   */
  const secretState = cronSecretState(cronSecret);
  const plan = CRON_PLAN[0];
  const nextRun = plan ? nextDailyRun(plan.expr, new Date()) : null;
  const lastAuto = runs.find((r) => r.trigger === "CRON");

  const today = new Date().toISOString().slice(0, 10);
  const collected = status.filter((s) => s.asOf);
  const missing = status.filter((s) => !s.asOf);
  const totalPoints = [...counts.values()].reduce((a, b) => a + b, 0);
  const lastRun = runs[0];

  // 오래된 것부터. 아직 못 받은 지표가 맨 위로 온다.
  const sorted = [...status].sort((a, b) => {
    if (!a.asOf) return -1;
    if (!b.asOf) return 1;
    return a.asOf.localeCompare(b.asOf);
  });

  return (
    <AdminShell>
      <AdminPageHeader
        title="거시 지표"
        description="FRED·Yahoo에서 받아 데이터베이스에 누적합니다. 여기서 가져온 값이 공개 화면(/macro)과 홈의 경제 상태가 됩니다."
        action={
          <Link
            href="/macro"
            className="rounded-xl border border-border px-3 py-2 text-[12.5px] text-gray-300 transition-colors hover:border-gold-600/40 hover:text-ink"
          >
            공개 화면 보기
          </Link>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="수집된 지표"
          value={`${collected.length}개`}
          sub={`전체 ${status.length}개`}
          tone={missing.length === 0 ? "up" : undefined}
        />
        <StatTile
          label="쌓인 값"
          value={totalPoints.toLocaleString("ko-KR")}
          sub="누적 데이터 포인트"
          tone="gold"
        />
        <StatTile
          label="아직 못 받은 지표"
          value={`${missing.length}개`}
          sub={missing.length ? "아래 표 위쪽에 있습니다" : "없음"}
          tone={missing.length ? "down" : "up"}
        />
        <StatTile
          label="마지막 수집"
          value={lastRun ? formatDate(lastRun.startedAt) : "없음"}
          sub={
            lastRun
              ? `성공 ${lastRun.okCount} · 실패 ${lastRun.failCount} · 신규 ${lastRun.addedPoints}`
              : "아직 가져온 적 없음"
          }
        />
      </div>

      <Card className="mb-6">
        <CardTitle>자료 가져오기</CardTitle>
        <IngestPanel />
        <p className="mt-4 text-[11px] leading-relaxed text-gray-600">
          FRED(미국 연준 통계)와 Yahoo Finance는 API 키가 필요 없어 시크릿 없이 동작합니다.
          처음 받을 때는 1990년부터, 이후에는 최근 500일 구간만 받아 갱신합니다(발표 기관이
          과거 값을 수정하기 때문에 최근 구간을 통째로 다시 받습니다). 아래 목록의
          <strong className="text-gray-400"> 파생</strong> 표시가 붙은 지표는 받아 오지 않고
          성분 지표에서 계산합니다 — 성분이 채워지면 같이 채워집니다.
        </p>
      </Card>

      <Card className="mb-6">
        {/* ⚠ 모델은 **읽기만** 한다 — 서버가 받아 온 본문 안에서만 값을 찾고, 인용문을 원문과
          대조한 뒤, 저장은 사람이 누른다(features/macro/extract-actions.ts 머리말) */}
      <Card className="mb-6">
        <CardTitle>AI로 값 옮겨 적기 ({manualIndicators().length}개 대상)</CardTitle>
        <ExtractPanel indicators={manualIndicators()} />
      </Card>

      <CardTitle>수동 지표 입력 ({manualIndicators().length}개)</CardTitle>
        <ManualPointForm indicators={manualIndicators()} today={today} />
      </Card>

      <Card className="mb-6" padding="p-0">
        <div className="px-5 pt-5">
          <CardTitle>지표 상태 (오래된 순)</CardTitle>
        </div>
        <Table>
          <caption className="sr-only">지표별 최신값·기준일·누적 개수</caption>
          <thead>
            <Tr>
              <Th>지표</Th>
              <Th>묶음</Th>
              <Th>출처</Th>
              <Th className="text-right">최신값</Th>
              <Th>기준일</Th>
              <Th className="text-right">누적</Th>
              <Th className="text-center">상태</Th>
            </Tr>
          </thead>
          <tbody>
            {sorted.map((s) => {
              const age = ageDays(s.asOf, today);
              const stale = age !== undefined && age > 45;
              return (
                <Tr key={s.indicator.key}>
                  <Td className="text-ink">{s.indicator.name}</Td>
                  <Td className="text-muted">
                    {findMacroGroup(s.indicator.group)?.name ?? s.indicator.group}
                  </Td>
                  <Td className="text-muted">
                    {s.indicator.source === "MANUAL" ? (
                      <Badge tone="info">수동</Badge>
                    ) : s.indicator.derived ? (
                      /* ⚠ 파생은 받아 오는 시리즈가 없다. 성분을 적어 두지 않으면
                         "가져오기를 눌렀는데 이건 왜 안 채워지나"로 읽힌다. */
                      <span className="text-[11px] text-gray-500">
                        <Badge tone="neutral">파생</Badge>{" "}
                        <span className="font-mono">{s.indicator.derived.from.join(" − ")}</span>
                      </span>
                    ) : (
                      <span className="font-mono text-[11px] text-gray-500">
                        {s.indicator.sourceId}
                      </span>
                    )}
                  </Td>
                  <Td className="text-right tabular-nums text-ink">{s.display}</Td>
                  <Td
                    className={`tabular-nums ${
                      !s.asOf ? "text-red-400" : stale ? "text-yellow-400" : "text-muted"
                    }`}
                  >
                    {s.asOf ?? "미수집"}
                    {age !== undefined && age > 45 && (
                      <span className="ml-1 text-[11px]">({age}일 전)</span>
                    )}
                  </Td>
                  <Td className="text-right tabular-nums text-gray-500">
                    {/* 파생은 저장하지 않고 읽을 때 만든다 — 0으로 적으면 수집 실패로 보인다. */}
                    {s.indicator.derived
                      ? "—"
                      : (counts.get(s.indicator.key) ?? 0).toLocaleString("ko-KR")}
                  </Td>
                  <Td className="text-center">
                    {s.indicator.signal ? <SignalPill status={s.status} /> : <span className="text-[11px] text-gray-600">—</span>}
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
      </Card>

      {/* ⚠ 스케줄은 아무도 보고 있지 않는 자리다. 켜져 있는지를 화면이 말해야 한다. */}
      <Card className="mb-6">
        <CardTitle>자동 수집</CardTitle>
        <div className="space-y-1.5 text-[12.5px]">
          <p className="text-muted">
            일정: <span className="text-ink">{plan?.note ?? "설정 없음"}</span>
            {nextRun && (
              <>
                {" · "}다음 실행{" "}
                <span className="text-ink">
                  {seoulDay(nextRun.toISOString())} {seoulTime(nextRun.toISOString())}
                </span>
              </>
            )}
          </p>
          <p className="text-muted">
            시크릿:{" "}
            <span className={secretState === "ok" ? "text-emerald-400" : "text-red-400"}>
              {CRON_SECRET_LABEL[secretState]}
            </span>
          </p>
          <p className="text-muted">
            마지막 자동 실행:{" "}
            {lastAuto ? (
              <span className="text-ink">
                {new Date(lastAuto.startedAt).toLocaleString("ko-KR")} · 성공 {lastAuto.okCount} ·
                실패 {lastAuto.failCount}
              </span>
            ) : (
              <span className="text-gold-500">아직 없습니다 — 아래 이력이 전부 수동입니다</span>
            )}
          </p>
        </div>
      </Card>

      <Card padding="p-0">
        <div className="px-5 pt-5">
          <CardTitle>최근 수집 이력</CardTitle>
        </div>
        {runs.length === 0 ? (
          <p className="px-5 pb-5 text-[13px] text-muted">
            아직 가져온 적이 없습니다. 위에서 &ldquo;전체 자료 가져오기&rdquo;를 누르세요.
          </p>
        ) : (
          <ul>
            {runs.map((run) => {
              const failed = run.detail.filter((d) => !d.ok);
              return (
                <li key={run.id} className="border-t border-border px-5 py-3.5">
                  <div className="flex flex-wrap items-center gap-2 text-[12px]">
                    <span className="tabular-nums text-gray-400">
                      {new Date(run.startedAt).toLocaleString("ko-KR")}
                    </span>
                    {/* ⚠ 자동인지 수동인지 구분해 보여준다. 구분이 없으면 "스케줄이 도는 줄
                        알았는데 사실 내가 누른 것뿐이었다"를 화면에서 알 수 없다. */}
                    <Badge tone={run.trigger === "CRON" ? "info" : "neutral"}>
                      {run.trigger === "CRON" ? "자동" : "수동"}
                    </Badge>
                    <Badge tone={run.failCount === 0 ? "emerald" : "warn"}>
                      성공 {run.okCount} · 실패 {run.failCount}
                    </Badge>
                    <span className="text-gray-500">
                      새로 쌓인 값 {run.addedPoints.toLocaleString("ko-KR")}개
                    </span>
                    {!run.finishedAt && <Badge tone="info">진행 중</Badge>}
                  </div>
                  {failed.length > 0 && (
                    <ul className="mt-2 space-y-0.5">
                      {failed.map((f) => (
                        <li key={f.key} className="text-[11.5px] text-red-300/80">
                          <code>{f.key}</code> · {f.error}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </AdminShell>
  );
}

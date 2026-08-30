import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader, AdminShell } from "@/components/layout/AdminPageHeader";
import { Card, CardTitle } from "@/components/ui/Card";
import { requireAdmin } from "@/lib/session";
import { RateLimitProbe } from "@/features/diagnostics/ui/RateLimitProbe";
import { probeUsage } from "@/features/diagnostics/usage";
import { checkSeedResidue } from "@/features/diagnostics/seed-check";
import { SeedResidueCard } from "@/features/diagnostics/ui/SeedResidueCard";
import { PUBLIC_STATIC_PATHS, DYNAMIC_PATH_RULES } from "@/lib/beacon-path";
import { CLOUDFLARE_LIMITS, CLOUDFLARE_LINKS, LIMITS_CHECKED_AT, gaugeD1 } from "@/lib/quota";

export const metadata: Metadata = { title: "자가 진단" };

/** ⚠ 정적 생성 금지 — 매번 실제 런타임에서 재야 의미가 있다. */
export const dynamic = "force-dynamic";

/**
 * 자가 진단 — **"붙였다"가 아니라 "실제로 동작한다"를 확인하는 화면.**
 *
 * ## 왜 만들었나
 * 2026-08-11에 집계 비콘에 속도 제한을 걸고 `CHANGELOG`에 "무제한 쓰기를 닫았다"고 적었다.
 * 배포 후 운영본에서 재 보니 **447건을 연속으로 보내도 한 건도 차단되지 않았다.**
 * 코드는 맞게 생겼고 배포도 성공했는데 방어는 없었다 — 이 저장소가 가장 크게 데이는 유형
 * (조용한 실패)의 변종이다.
 *
 * 그래서 교훈을 **문장이 아니라 화면**으로 남긴다:
 * > 방어 장치는 붙였다고 끝이 아니라 "실제로 막히는지"를 재야 한다.
 */
export default async function AdminDiagnosticsPage() {
  await requireAdmin("/admin/diagnostics");

  const [usage, seed] = await Promise.all([probeUsage(), checkSeedResidue()]);
  const gauge = usage.sizeBytes === undefined ? undefined : gaugeD1(usage.sizeBytes, "free");

  return (
    <AdminShell>
      <AdminPageHeader
        title="자가 진단"
        description="방어 장치가 실제로 동작하는지, 무료 등급 한도에 얼마나 가까운지 운영 런타임에서 직접 잽니다."
        action={
          <Link
            href="/admin"
            className="rounded-xl border border-border px-3 py-2 text-[12.5px] text-gray-300 transition-colors hover:border-gold-600/40 hover:text-ink"
          >
            대시보드
          </Link>
        }
      />

      <div className="space-y-5">
        {/* ⚠ 지어낸 숫자가 공개되고 있는 것보다 급한 계기는 없다. 그래서 맨 위다.
            (2026-08-16: 종목을 다 지웠는데 시드 계좌 곡선이 공개되고 있었다.) */}
        <SeedResidueCard check={seed} />

        {/* ⚠ 비용·한도 문제는 코드 버그와 증상이 똑같다("불러오지 못했습니다").
            그래서 닿기 전에 보이게 계기를 맨 위에 둔다. */}
        <Card>
          <CardTitle
            action={
              <a
                href={CLOUDFLARE_LINKS.workersPlans}
                target="_blank"
                rel="noreferrer noopener"
                className="text-[11px] text-gold-400 hover:text-gold-500"
              >
                요금제 전환 →
              </a>
            }
          >
            무료 등급 사용량
          </CardTitle>

          {usage.failure ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/[0.06] px-3.5 py-3">
              <p className="text-[13px] font-medium text-red-200">{usage.failure.title}</p>
              <p className="mt-1 text-[12px] text-gray-300">{usage.failure.detail}</p>
              <p className="mt-1 text-[12px] text-red-200">→ {usage.failure.action}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[12px] text-muted">D1 데이터베이스 크기</span>
                  <span
                    className={`text-[12.5px] tabular-nums ${
                      gauge?.level === "critical"
                        ? "text-red-300"
                        : gauge?.level === "warn"
                          ? "text-amber-300"
                          : "text-gray-200"
                    }`}
                  >
                    {gauge ? gauge.text : "재지 못했습니다"}
                  </span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-bg overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      gauge?.level === "critical"
                        ? "bg-red-500"
                        : gauge?.level === "warn"
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                    }`}
                    style={{ width: `${Math.min(100, gauge?.pct ?? 0)}%` }}
                  />
                </div>
              </div>

              {usage.tables.length > 0 && (
                <div className="rounded-lg bg-ink/10 px-3 py-2">
                  <p className="mb-1.5 text-[11px] text-muted">행이 많은 표 (무엇이 자리를 먹나)</p>
                  {usage.tables.slice(0, 6).map((t) => (
                    <div key={t.name} className="flex justify-between py-0.5 text-[12px]">
                      <span className="text-gray-400 font-mono">{t.name}</span>
                      <span className="text-gray-300 tabular-nums">
                        {t.rows.toLocaleString("ko-KR")}행
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-border text-left text-[10.5px] text-muted">
                  <th className="py-2 pr-3">자원</th>
                  <th className="py-2 pr-3">무료</th>
                  <th className="py-2 pr-3">유료</th>
                  <th className="py-2">한도에 닿으면</th>
                </tr>
              </thead>
              <tbody>
                {CLOUDFLARE_LIMITS.map((row) => (
                  <tr key={row.key} className="border-b border-border/50 last:border-0">
                    <td className="py-2 pr-3 text-gray-300 whitespace-nowrap">{row.label}</td>
                    <td className="py-2 pr-3 text-gray-400 whitespace-nowrap tabular-nums">{row.free}</td>
                    <td className="py-2 pr-3 text-emerald-300/80 whitespace-nowrap tabular-nums">{row.paid}</td>
                    <td className="py-2 text-gray-500">{row.symptom}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11.5px]">
            <a href={CLOUDFLARE_LINKS.billing} target="_blank" rel="noreferrer noopener" className="text-gold-400 hover:text-gold-500">
              결제·요금제 →
            </a>
            <a href={CLOUDFLARE_LINKS.d1} target="_blank" rel="noreferrer noopener" className="text-gold-400 hover:text-gold-500">
              D1 사용량 →
            </a>
            <a href={CLOUDFLARE_LINKS.observability} target="_blank" rel="noreferrer noopener" className="text-gold-400 hover:text-gold-500">
              Worker 로그 →
            </a>
            <a href={CLOUDFLARE_LINKS.limitsDoc} target="_blank" rel="noreferrer noopener" className="text-gray-500 hover:text-gray-300">
              공식 한도 문서 →
            </a>
            {/* ⚠ 오래된 숫자를 확정처럼 보이지 않게 확인 날짜를 적는다. */}
            <span className="text-gray-600">한도표 확인: {LIMITS_CHECKED_AT}</span>
          </div>
        </Card>

        <Card>
          <CardTitle>집계 비콘 · 속도 제한</CardTitle>
          <RateLimitProbe />
        </Card>

        {/* ⚠ 지금 무엇이 막히고 무엇이 안 막히는지를 화면에 적어 둔다.
            "보안 조치를 했다"는 말만 남으면 다음 사람이 다 막힌 줄 안다. */}
        <Card>
          <CardTitle>집계 비콘은 지금 무엇을 막나</CardTitle>
          <div className="space-y-3 text-[12.5px] leading-relaxed text-gray-300">
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.05] px-3.5 py-3">
              <p className="font-medium text-emerald-200">막는다 — 없는 화면 만들어 내기</p>
              <p className="mt-1 text-gray-300">
                사이트가 실제로 서비스하는 경로만 집계합니다. 정적 화면{" "}
                {PUBLIC_STATIC_PATHS.length}개와 동적 규칙 {DYNAMIC_PATH_RULES.length}개
                (<code className="text-gray-400">{DYNAMIC_PATH_RULES.map((r) => r.template).join(" · ")}</code>)
                밖의 경로는 세지 않습니다. 규칙은 <code>src/lib/beacon-path.ts</code>에 있고
                라우트가 늘면 테스트가 먼저 깨집니다.
              </p>
            </div>

            <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.05] px-3.5 py-3">
              <p className="font-medium text-amber-200">반만 막는다 — 꾸준한 남용은 막고, 폭주는 못 막는다</p>
              <p className="mt-1 text-gray-300">
                2026-08-15 운영 실측입니다. 같은 배포본·같은 상한인데 방식에 따라 갈렸습니다 —
                <strong className="text-gray-200"> 순차 100건/29초는 32건 차단</strong>,
                <strong className="text-amber-200"> 병렬 120건/18초는 0건 차단</strong>
                (그 직후 순차 30건도 통과 → 폭주분이 카운터에 아예 안 잡혔습니다).
              </p>
            </div>

            <div className="rounded-xl border border-red-500/25 bg-red-500/[0.05] px-3.5 py-3">
              <p className="font-medium text-red-200">⚠ 못 막는다 — 실재하는 화면의 숫자 부풀리기</p>
              <p className="mt-1 text-gray-300">
                남용은 정확히 <strong className="text-red-200">병렬</strong>로 옵니다. 그래서
                속도 제한 바인딩을 방어선으로 인정하지 않고, 폭주 상한은 아직 미해결입니다.
                <strong className="text-red-200"> 그동안 초기 통계는 그만큼 덜 믿습니다.</strong>{" "}
                후속안은 <code>docs/계획_2026-08-15.md</code> §3에 있습니다.
              </p>
            </div>

            <p className="text-[11.5px] text-gray-600">
              참고 — <code>Sec-Fetch-Site</code>·본문 크기 확인도 걸려 있지만 위조 가능한
              헤더라 보호라고 부르지 않습니다. 스크립트 키디만 걸러 냅니다.
            </p>
          </div>
        </Card>
      </div>
    </AdminShell>
  );
}

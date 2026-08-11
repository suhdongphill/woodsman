import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader, AdminShell } from "@/components/layout/AdminPageHeader";
import { Card, CardTitle } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatBar";
import { requireAdmin } from "@/lib/session";
import {
  BOUNCE_UNDER_SEC,
  DWELL_BUCKET_LABELS,
  READ_MIN_SCROLL_PCT,
  READ_MIN_SEC,
} from "@/lib/engagement";
import { loadScreenReport } from "@/features/analytics/engagement-service";
import { ScreenTable } from "@/features/analytics/ui/ScreenTable";

export const metadata: Metadata = { title: "화면 통계" };

/** ⚠ 정적 생성 금지 — 집계는 매번 새로 읽어야 한다. */
export const dynamic = "force-dynamic";

const DAYS = 30;

/**
 * 화면 통계 — **개편 판단용**.
 *
 * ## 왜 조회수 화면과 따로 만드나
 * `/admin` 대시보드의 조회수는 "얼마나 왔나"에 답한다. 이 화면은 **"무엇을 고칠까"**에 답한다.
 * 두 질문은 정렬 순서가 다르다. 조회수로 줄 세우면 항상 홈이 1등이고 처방이 안 나온다.
 *
 * ## ⚠ 이 숫자로 할 수 없는 것
 * 쿠키·세션 ID를 만들지 않으므로 **개인의 이동 경로(퍼널)는 낼 수 없다.**
 * 낼 수 있는 것은 화면 단위의 평균적 소비 패턴까지다. 화면에도 그렇게 적는다.
 */
export default async function AdminAnalyticsPage() {
  await requireAdmin("/admin/analytics");

  const report = await loadScreenReport(DAYS);

  return (
    <AdminShell>
      <AdminPageHeader
        title="화면 통계"
        description={`최근 ${DAYS}일. 어느 화면을 고치면 효과가 큰지를 기준으로 정렬합니다.`}
        action={
          <Link
            href="/admin"
            className="rounded-xl border border-border px-3 py-2 text-[12.5px] text-gray-300 transition-colors hover:border-gold-600/40 hover:text-white"
          >
            대시보드
          </Link>
        }
      />

      {/* ⚠ 못 읽은 것과 0을 구분한다 */}
      {!report ? (
        <Card className="border-red-500/30 bg-red-500/[0.06]">
          <p className="text-[13px] text-red-200">
            집계를 불러오지 못했습니다. 서버 로그의 <code>[analytics]</code> 항목을 확인하세요.
          </p>
        </Card>
      ) : (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            <StatTile
              label={`최근 ${DAYS}일 조회`}
              value={report.totalViews.toLocaleString()}
              sub="봇 제외 · 개인 식별 없음"
            />
            <StatTile
              label="체류 표본"
              value={report.totalSamples.toLocaleString()}
              sub={
                report.totalSamples === 0
                  ? "아직 쌓이지 않았습니다"
                  : `조회 대비 ${Math.round((report.totalSamples / Math.max(report.totalViews, 1)) * 100)}%`
              }
              tone={report.totalSamples === 0 ? "down" : "default"}
            />
            <StatTile
              label="화면 수"
              value={report.templates.length.toLocaleString()}
              sub="템플릿 기준"
            />
          </div>

          {report.totalSamples === 0 && (
            <Card className="mb-6 border-yellow-500/30 bg-yellow-500/[0.06]">
              <p className="text-[13px] leading-relaxed text-yellow-200">
                체류시간 표본이 아직 없습니다. 방문자가 화면을 <strong>떠날 때</strong> 한 번
                보고되므로, 배포 후 실제 방문이 있어야 채워집니다. 조회수는 그와 별개로 이미
                쌓이고 있습니다.
              </p>
            </Card>
          )}

          <Card className="mb-6">
            <CardTitle>화면(템플릿) 단위</CardTitle>
            <p className="mb-4 text-[12px] leading-relaxed text-gray-500">
              글·종목처럼 개수가 늘어나는 경로는 <code>/insights/*</code>로 접어서 봅니다.
              화면을 고치는 판단은 이 표로 합니다.
            </p>
            <ScreenTable rows={report.templates} />
          </Card>

          <Card className="mb-6">
            <CardTitle>개별 경로</CardTitle>
            <p className="mb-4 text-[12px] leading-relaxed text-gray-500">
              같은 템플릿 안에서 어떤 글이 읽히고 어떤 글이 안 읽히는지 봅니다.
            </p>
            <ScreenTable rows={report.paths.slice(0, 30)} />
            {report.paths.length > 30 && (
              <p className="mt-3 text-[11.5px] text-gray-600">
                우선순위 상위 30개만 보여 줍니다(전체 {report.paths.length}개).
              </p>
            )}
          </Card>
        </>
      )}

      <Card>
        <CardTitle>이 숫자를 읽는 법</CardTitle>
        <dl className="space-y-3 text-[12.5px] leading-relaxed text-gray-400">
          <div>
            <dt className="font-semibold text-gray-200">조회 vs 표본</dt>
            <dd>
              조회는 화면이 그려질 때, 표본은 <strong>떠날 때</strong> 셉니다. 떠나는 신호를
              브라우저가 못 보내는 경우가 있어 표본이 조회보다 항상 적습니다.
              표본이 적은 줄의 비율은 그만큼 덜 믿어야 합니다.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-gray-200">체류(중앙 구간)</dt>
            <dd>
              ⚠ 평균이 아니라 <strong>중앙값이 든 구간</strong>입니다({DWELL_BUCKET_LABELS.join(" · ")}).
              평균을 쓰면 탭을 열어 두고 자리를 뜬 한 명이 전체를 끌어올립니다.
              화면이 보이지 않는 동안(탭 전환)은 세지 않습니다.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-gray-200">이탈 · 읽음</dt>
            <dd>
              이탈은 {BOUNCE_UNDER_SEC}초 미만 비율입니다 — 높으면 <strong>첫 화면이 답을 주지
              못하고</strong> 있습니다. 읽음은 {READ_MIN_SEC}초 이상 머물면서{" "}
              {READ_MIN_SCROLL_PCT}% 이상 내려간 비율로, <strong>둘 다</strong> 넘어야 셉니다.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-gray-200">우선순위</dt>
            <dd>
              조회수(규모) × 문제 강도입니다. 문제 강도는 <strong>이탈</strong>과{" "}
              <strong>잘 읽히는데 티스토리로 안 넘어감</strong> 두 가지를 봅니다.
              ⚠ 이건 <strong>어디부터 볼지 정하는 순서</strong>이지 화면의 품질 등급이 아닙니다.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-gray-200">⚠ 낼 수 없는 것</dt>
            <dd>
              쿠키·IP·세션 ID를 저장하지 않으므로 <strong>방문자 수(UV)와 개인의 이동 경로(퍼널)는
              낼 수 없습니다.</strong> 여기 있는 것은 전부 화면 단위 집계입니다
              (<Link href="/privacy" className="underline hover:text-gold-400">개인정보 처리방침</Link>과 같은 선).
            </dd>
          </div>
        </dl>
      </Card>
    </AdminShell>
  );
}

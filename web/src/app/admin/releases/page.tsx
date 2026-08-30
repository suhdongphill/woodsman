import type { Metadata } from "next";
import { AdminPageHeader, AdminShell } from "@/components/layout/AdminPageHeader";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { TrashIcon } from "@/components/icons";
import { requireAdmin } from "@/lib/session";
import { seoulDay } from "@/lib/admin-log";
import {
  EFFECT_WINDOW_DAYS,
  daysSince,
  judgeEffect,
  sumAround,
} from "@/lib/release-effect";
import { loadClickDaily } from "@/lib/outbound-repo";
import { loadViewDaily } from "@/features/analytics/repository";
import { loadReleases } from "@/features/release/repository";
import { deleteReleaseAction } from "@/features/release/actions";
import { RELEASE_KINDS, RELEASE_METRICS } from "@/features/release/form-state";
import { ReleaseForm } from "@/features/release/ui/ReleaseForm";

export const metadata: Metadata = { title: "릴리스 · 효과" };

/** ⚠ 정적 생성 금지 — 방금 기록한 것이 안 보이면 기록이 아니다. */
export const dynamic = "force-dynamic";

const KIND_LABEL = Object.fromEntries(RELEASE_KINDS.map((k) => [k.value, k.label]));
const METRIC_LABEL = Object.fromEntries(RELEASE_METRICS.map((m) => [m.value, m.label]));

/**
 * 릴리스와 그 효과.
 *
 * ## 이 화면이 하는 일
 * **바꾼 것**(배포)과 **반응**(티스토리 클릭·조회수)을 잇는다. 지금까지 배포는 git에만 있어서
 * 사이트가 자기 변화를 몰랐고, 그래서 "이렇게 바꿨더니 이렇게 됐다"를 말할 수 없었다.
 *
 * ## ⚠ 이 화면이 **하지 않는** 일
 * - **자동으로 화면을 바꾸지 않는다.** 방문자마다 다른 화면을 보여 주면 "공개한 기록"이라는
 *   전제가 흔들린다. 사이트는 근거를 모아 사람 앞에 놓고, 결정은 사람이 한다.
 * - **표본이 적으면 판정하지 않는다.** 적은 표본의 그럴듯한 결론이 가장 위험하다.
 * - **겹친 릴리스를 하나로 지목하지 않는다.** 같은 기간에 셋을 바꿨으면 "무엇 때문인지 모른다"고 적는다.
 * - **인과로 말하지 않는다.** 외부 요인(검색 유입 급변·시장 이벤트)은 알 수 없다.
 */
export default async function AdminReleasesPage() {
  await requireAdmin("/admin/releases");

  const [releases, clickDaily, viewDaily] = await Promise.all([
    loadReleases(50),
    loadClickDaily(),
    loadViewDaily(),
  ]);

  const today = seoulDay(new Date().toISOString());

  return (
    <AdminShell>
      <AdminPageHeader
        title="릴리스 · 효과"
        description="무엇을 바꿨고 그 뒤에 반응이 어떻게 달라졌는지 잇습니다. 배포할 때마다 한 줄씩 남기세요."
      />

      <Card className="mb-6">
        <CardTitle>릴리스 기록</CardTitle>
        <ReleaseForm today={today} />
      </Card>

      <Card className="mb-6">
        <CardTitle>이 화면이 하지 않는 일</CardTitle>
        <ul className="space-y-1.5 text-[12.5px] leading-relaxed text-muted">
          <li>
            · ⚠ <strong className="text-ink">표본이 적으면 판정하지 않습니다.</strong> 전+후 합계가{" "}
            {EFFECT_WINDOW_DAYS}일 창에서 최소치에 못 미치면 숫자만 보여 주고 결론을 내지 않습니다.
          </li>
          <li>
            · ⚠ <strong className="text-ink">겹친 변경을 하나로 지목하지 않습니다.</strong> 같은
            기간에 여러 번 바꿨으면 “무엇 때문인지 가릴 수 없다”고 적습니다.
          </li>
          <li>
            · ⚠ <strong className="text-ink">인과가 아니라 동시 발생입니다.</strong> 검색 유입 급변·시장
            이벤트 같은 외부 요인은 알 수 없습니다.
          </li>
          <li>
            · ⚠ <strong className="text-ink">사이트가 스스로 화면을 바꾸지 않습니다.</strong> 근거를
            모아 놓을 뿐, 결정은 사람이 합니다.
          </li>
        </ul>
      </Card>

      {releases.length === 0 ? (
        <Card>
          <p className="text-[13px] text-muted">
            아직 기록이 없습니다. 배포할 때마다 위에 한 줄씩 남기면, 그 뒤의 반응이 여기에 붙습니다.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {releases.map((r) => {
            const day = seoulDay(r.at);
            const daily = r.metric === "VIEWS" ? viewDaily : clickDaily;
            const { before, after } = sumAround(daily, day);
            // ⚠ 같은 창(±14일)에 들어온 **다른** 릴리스를 센다. 겹치면 하나로 지목하지 않는다.
            const overlapping = releases.filter((o) => {
              if (o.id === r.id) return false;
              const gap = Math.abs(daysSince(seoulDay(o.at), day));
              return gap < EFFECT_WINDOW_DAYS;
            }).length;

            const verdict = judgeEffect({
              before,
              after,
              daysSinceRelease: daysSince(day, today),
              overlappingReleases: overlapping,
            });

            return (
              <Card key={r.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="text-[13.5px] font-semibold text-ink">{r.title}</span>
                      <Badge tone="neutral">{KIND_LABEL[r.kind] ?? r.kind}</Badge>
                    </p>
                    <p className="mt-1 text-[11px] text-ink-3">
                      {day} · {METRIC_LABEL[r.metric] ?? r.metric}
                      {r.commitHash ? ` · ${r.commitHash}` : ""}
                    </p>
                  </div>
                  <form action={deleteReleaseAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <button
                      type="submit"
                      aria-label={`${r.title} 기록 삭제`}
                      className="rounded-lg p-1.5 text-ink-3 transition-colors hover:bg-cardHover hover:text-danger"
                    >
                      <TrashIcon size={14} />
                    </button>
                  </form>
                </div>

                {r.hypothesis && (
                  <p className="mt-3 rounded-xl bg-surface-2 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-muted">
                    <span className="text-ink-3">기대한 것 · </span>
                    {r.hypothesis}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[12.5px]">
                  <span className="text-ink-3">
                    전 {EFFECT_WINDOW_DAYS}일 <span className="tabular-nums text-ink">{before}</span>
                  </span>
                  <span className="text-ink-3">
                    후 {EFFECT_WINDOW_DAYS}일 <span className="tabular-nums text-ink">{after}</span>
                  </span>
                  {/* ⚠ 판정 문구는 lib/release-effect.ts가 만든다. 화면에서 다시 쓰지 않는다. */}
                  <span
                    className={
                      verdict.kind === "measured" ? "text-ink" : "text-ink-3"
                    }
                  >
                    {verdict.message}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </AdminShell>
  );
}

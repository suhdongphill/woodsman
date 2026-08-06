/**
 * 조회수 요약 — 스스로 집계를 읽어 그린다.
 *
 * `features/site/ui/OutboundStats.tsx`와 같은 모양이다: 데이터 로딩과 마크업을 한 덩어리로
 * 두고, 라우트는 자리만 잡는다(CLAUDE.md 1장 "라우트는 조립만 한다").
 *
 * ⚠ 집계를 **못 읽은 것**과 **0회**를 구분해서 말한다. 둘이 같은 화면이 되면
 *    지표가 죽은 줄 모르고 지나간다(이 프로젝트에서 가장 크게 데인 지점).
 */
import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/Card";
import { cx, formatPct } from "@/lib/format";
import type { ViewStats as Stats } from "../repository";

/**
 * ⚠ 집계는 **부르는 쪽이 한 번만 읽어** 넘긴다. 여기서 또 읽으면 같은 화면이 같은 질의를
 *    두 번 하게 된다(상단 타일과 이 카드가 같은 값을 쓴다).
 */
export function ViewStatsCard({ stats }: { stats: Stats | null }) {
  if (!stats) {
    return (
      <Card>
        <CardTitle>최근 7일 조회수</CardTitle>
        <p className="text-[12.5px] text-muted">집계를 불러오지 못했습니다.</p>
      </Card>
    );
  }

  const max = Math.max(...stats.daily.map((d) => d.count), 1);

  return (
    <Card>
      <CardTitle
        action={
          stats.weekChangePct === undefined ? undefined : (
            <span
              className={cx(
                "text-[11px] tabular-nums",
                stats.weekChangePct >= 0 ? "text-emerald-400" : "text-red-400",
              )}
            >
              전주 대비 {formatPct(stats.weekChangePct)}
            </span>
          )
        }
      >
        최근 7일 조회수
      </CardTitle>

      <div className="flex h-40 items-end gap-2">
        {stats.daily.map((d, i) => (
          <div key={d.date} className="flex flex-1 flex-col items-center gap-2">
            <span className="text-[10px] tabular-nums text-gray-500">{d.count}</span>
            <div
              className={cx(
                "w-full rounded-t-md transition-colors",
                i === stats.daily.length - 1 ? "bg-gold-500" : "bg-emerald-600/70",
              )}
              // 0인 날도 자리를 남긴다 — 막대가 사라지면 그날이 없어 보인다.
              style={{ height: `${Math.max((d.count / max) * 100, 2)}%` }}
            />
            <span className="text-[10px] tabular-nums text-gray-600">
              {d.date.slice(5).replace("-", "/")}
            </span>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-gray-600">
        쿠키를 심지 않아 사람을 구분하지 않습니다. <strong>방문자 수가 아니라 조회수</strong>이고,
        크롤러는 빼고 셉니다.
      </p>

      {stats.top.length > 0 && (
        <div className="mt-4 border-t border-border/70 pt-3">
          <p className="mb-2 text-[11px] text-muted">최근 7일 많이 본 화면</p>
          <ul className="space-y-1">
            {stats.top.map((t) => (
              <li key={t.path} className="flex items-center justify-between gap-3 text-[12px]">
                <Link href={t.path} className="truncate text-gray-300 hover:text-gold-400">
                  {t.path}
                </Link>
                <span className="shrink-0 tabular-nums text-gray-500">
                  {t.count.toLocaleString("ko-KR")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

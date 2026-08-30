import { Card, CardTitle } from "@/components/ui/Card";
import { ExternalIcon } from "@/components/icons";
import { loadClickStats } from "@/lib/outbound-repo";

/**
 * 티스토리로 넘어간 클릭 — 이 사이트의 **1순위 성과 지표**.
 *
 * 페이지뷰나 체류시간이 아니라 "몇 명이 블로그로 갔나"를 본다.
 * 사이트의 목적이 트래픽 유도이므로, 이 숫자가 늘지 않으면 다른 지표가 좋아도 의미가 없다.
 */
export async function OutboundStats() {
  const stats = await loadStats();

  if (!stats) {
    return (
      <Card>
        <CardTitle>티스토리 유입</CardTitle>
        <p className="text-[12.5px] text-muted">집계를 불러오지 못했습니다.</p>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <CardTitle>티스토리로 넘어간 클릭</CardTitle>
        <ExternalIcon size={15} className="text-gold-400" />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Metric label="오늘" value={stats.today} tone="gold" />
        <Metric label="최근 7일" value={stats.week} />
        <Metric label="누적" value={stats.total} />
      </div>

      {stats.recent.length > 0 && (
        <ul className="mt-4 space-y-1.5 border-t border-border/70 pt-3">
          {stats.recent.map((row) => (
            <li key={row.date} className="flex items-center justify-between text-[12px]">
              <span className="text-muted tabular-nums">{row.date}</span>
              <span className="tabular-nums text-gray-300">{row.count.toLocaleString("ko-KR")}회</span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 border-t border-border/70 pt-3 text-[11px] leading-relaxed text-gray-500">
        개인 식별 정보(IP·쿠키)를 저장하지 않고 날짜별 합계만 셉니다. 사이트 체류가 아니라
        <strong className="text-gray-400"> 블로그로 넘어간 수</strong>가 판단 기준입니다.
      </p>
    </Card>
  );
}

function Metric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "gold";
}) {
  return (
    <div>
      <p className="text-[11px] text-muted">{label}</p>
      <p
        className={`mt-1 text-xl font-bold tabular-nums ${
          tone === "gold" ? "text-gold-400" : "text-ink"
        }`}
      >
        {value.toLocaleString("ko-KR")}
      </p>
    </div>
  );
}

async function loadStats() {
  try {
    return await loadClickStats();
  } catch (error) {
    // 집계를 못 읽는 것과 "클릭이 0인 것"은 다르다. 화면에도 구분해 보여준다.
    console.error("[outbound] 집계 조회 실패", error);
    return null;
  }
}

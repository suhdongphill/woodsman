import { Badge } from "@/components/ui/Badge";
import { Emphasis } from "@/components/ui/Emphasis";
import { cx, profitColor } from "@/lib/format";
import { formatFlowMillions, type Group, type Member } from "@/lib/leaders/view";
import { LeaderBadge } from "./LeaderBadge";

/**
 * 레이어별 종목 — 볼트 화면은 열 12개짜리 표였다. 휴대폰에서 가로로 밀어야 읽혀서 **카드**로 바꿨다(2026-09-25).
 * 카드 한 장의 순서: 판정 → 성장(매출 YoY·가속) → 가격(3개월 상대강도·고점 대비) → 경고. 판정이 이 화면의 답이고, 나머지는 그 근거다.
 * ⚠ 값이 없으면 「—」와 사유(재무 미수집 등)를 적는다. 0으로 채우지 않는다.
 */
function pct(v: number | null | undefined, digits = 1, unit = "%") {
  if (v == null || !Number.isFinite(v)) return null;
  return `${v >= 0 ? "+" : ""}${v.toFixed(digits)}${unit}`;
}

function Metric({ label, value, signed }: { label: string; value: string | null; signed?: number | null }) {
  return (
    <div className="rounded-lg bg-bg px-2 py-1.5 text-center">
      <dt className="text-[10px] text-gray-500">{label}</dt>
      <dd className={cx("mt-0.5 text-[12.5px] font-semibold tabular-nums", value == null ? "text-gray-500" : signed != null ? profitColor(signed) : "text-ink")}>
        {value ?? "—"}
      </dd>
    </div>
  );
}

function MemberCard({ m }: { m: Member }) {
  const f = m.detail.fund;
  const missing = m.revYoy == null ? (f?.why_missing ?? "재무 미수집") : null;
  return (
    <article className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="truncate text-[14px] font-semibold text-ink">{m.name}</h4>
          <p className="mt-0.5 truncate text-[11px] text-gray-500">
            <span className="font-mono">{m.ticker}</span>
            {m.role && ` · ${m.role}`}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <LeaderBadge cls={m.cls} tier={m.tier} />
          {m.held && <Badge tone="gold">운영 포트폴리오 보유</Badge>}
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-4 gap-1.5">
        <Metric label="매출 YoY" value={pct(m.revYoy)} />
        <Metric label="가속" value={pct(m.accel, 1, "%p")} signed={m.accel} />
        <Metric label="RS 3M" value={pct(m.rs3m, 1, "")} signed={m.rs3m} />
        <Metric label="고점 대비" value={pct(m.offHigh, 1)} />
      </dl>
      {missing && <p className="mt-1.5 text-[11px] text-gray-500">재무: {missing}</p>}
      {/* 한국 종목만 수급 실측이 있다(KIS). 나머지는 레이어 ETF 프록시라 종목 카드에 싣지 않는다. */}
      {formatFlowMillions(m.detail.flow?.fi20) && (
        <p className="mt-1.5 text-[11px] text-gray-500">
          외국인+기관 20일{" "}
          <strong className={cx("tabular-nums", profitColor(m.detail.flow?.fi20 ?? 0))}>
            {formatFlowMillions(m.detail.flow?.fi20)}
          </strong>
          {m.detail.flow?.pct20 != null && ` (시총의 ${m.detail.flow.pct20.toFixed(1)}%)`}
          {m.detail.flow?.as_of && ` · ${m.detail.flow.as_of} 기준`}
        </p>
      )}

      {m.flags.length > 0 && (
        <ul className="mt-2.5 space-y-1 text-[11.5px] leading-snug text-gray-500">
          {m.flags.map((flag) => (
            <li key={flag}>⚑ {flag}</li>
          ))}
        </ul>
      )}
    </article>
  );
}

export function LayerMembers({ group }: { group: Group }) {
  return (
    <section id={`layer-${group.groupId}`} className="scroll-mt-24">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[17px] font-bold text-ink">{group.name}</h3>
        <span className="text-[12px] text-gray-500">
          주도주 {group.leaders} / {group.members.length}곳
          {group.rsMedianM3 != null && ` · 3M 상대강도 중앙값 ${pct(group.rsMedianM3, 1, "%p")}`}
        </span>
      </div>
      {/* 볼트 설명글도 **강조**를 품을 수 있다 — 날것으로 그리면 별표가 보인다(design-policy 테스트) */}
      {group.why && (
        <p className="mb-3 text-[13px] leading-relaxed text-muted">
          <Emphasis text={group.why} />
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {group.members.map((m) => (
          <MemberCard key={m.ticker} m={m} />
        ))}
      </div>
    </section>
  );
}

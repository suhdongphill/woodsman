/**
 * 화면별 소비 지표 표.
 *
 * ## 열을 이렇게 고른 이유
 * 화면을 **고칠지 말지**를 판단하는 표다. 그래서 "얼마나 왔나"(조회) 다음에
 * "왜 나갔나"(이탈·체류·깊이)를, 마지막에 "목적을 달성했나"(티스토리)를 둔다.
 *
 * ⚠ 표본이 없으면 `—`다. 0%로 적으면 "재 봤더니 0"으로 읽힌다.
 */
import { Table, Th, Td, Tr } from "@/components/ui/Table";
import { cx } from "@/lib/format";
import { redesignPriority, type EngagementView } from "@/lib/engagement";

/** 이탈률이 높으면 붉게 — 첫 화면이 답을 못 주고 있다는 뜻이다. */
function bounceTone(pct?: number): string {
  if (pct === undefined) return "text-gray-600";
  if (pct >= 60) return "text-red-400";
  if (pct >= 40) return "text-yellow-400";
  return "text-gray-300";
}

function readTone(pct?: number): string {
  if (pct === undefined) return "text-gray-600";
  if (pct >= 50) return "text-emerald-400";
  if (pct >= 25) return "text-gray-300";
  return "text-yellow-400";
}

function num(value?: number, suffix = "%"): string {
  return value === undefined ? "—" : `${value}${suffix}`;
}

export function ScreenTable({ rows }: { rows: EngagementView[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-[12.5px] text-muted">
        아직 이 기간에 집계된 화면이 없습니다.
      </p>
    );
  }

  return (
    <Table>
        <thead>
          <Tr>
            <Th>화면</Th>
            <Th className="text-right">조회</Th>
            <Th className="text-right">표본</Th>
            <Th className="text-right">체류(중앙 구간)</Th>
            <Th className="text-right">이탈</Th>
            <Th className="text-right">끝까지</Th>
            <Th className="text-right">읽음</Th>
            <Th className="text-right">티스토리</Th>
            <Th className="text-right">우선순위</Th>
          </Tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <Tr key={r.path}>
              <Td>
                <span className="font-mono text-[12px] text-gray-300">{r.path}</span>
              </Td>
              <Td className="text-right tabular-nums text-ink">
                {r.views.toLocaleString()}
              </Td>
              <Td className="text-right tabular-nums text-gray-500">
                {r.samples.toLocaleString()}
              </Td>
              <Td className="text-right text-gray-300">
                {r.dwellLabel ?? "—"}
              </Td>
              <Td className={cx("text-right tabular-nums", bounceTone(r.bouncePct))}>
                {num(r.bouncePct)}
              </Td>
              <Td className="text-right tabular-nums text-gray-400">
                {num(r.fullScrollPct)}
              </Td>
              <Td className={cx("text-right tabular-nums", readTone(r.readPct))}>
                {num(r.readPct)}
              </Td>
              <Td className="text-right tabular-nums text-gold-400">
                {r.outboundClicks > 0
                  ? `${r.outboundClicks}건 · ${num(r.outboundPct)}`
                  : num(r.outboundPct)}
              </Td>
              <Td className="text-right tabular-nums text-gray-500">
                {redesignPriority(r).toLocaleString()}
              </Td>
            </Tr>
          ))}
        </tbody>
    </Table>
  );
}

import type { Metadata } from "next";
import { AdminPageHeader, AdminShell } from "@/components/layout/AdminPageHeader";
import { Card, CardTitle } from "@/components/ui/Card";
import { Table, Th, Td, Tr } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Toggle } from "@/components/ui/Toggle";
import { Button } from "@/components/ui/Button";
import { PlusIcon, EditIcon, AlertIcon } from "@/components/icons";
import { cx } from "@/lib/format";
import { aiConfig, aiProviders } from "@/lib/mock";

export const metadata: Metadata = { title: "AI 제공자" };

export default function AdminAiPage() {
  const sorted = [...aiProviders].sort((a, b) => a.priority - b.priority);
  const globalPct = (aiConfig.tokensUsedThisMonth / aiConfig.globalMonthlyTokenCap) * 100;

  return (
    <AdminShell>
      <AdminPageHeader
        title="AI 제공자"
        description="무료 제공자를 우선순위 앞에 두고, 실패·한도 초과 시 다음 제공자로 폴백합니다. API 키는 서버 .env에만 존재하며 화면에서 편집할 수 없습니다."
        action={
          <Button variant="gold" size="sm">
            <PlusIcon size={14} />
            제공자 추가
          </Button>
        }
      />

      <div className="grid lg:grid-cols-2 gap-5 mb-7">
        <Card>
          <CardTitle>실행 정책</CardTitle>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[13.5px] text-white">AI 실행 권한</p>
                <p className="text-[11.5px] text-muted mt-1">
                  비용 방어를 위해 기본값은 관리자 전용입니다.
                </p>
              </div>
              <select
                defaultValue={aiConfig.allowedRole}
                className="bg-[#12141c] border border-border rounded-xl px-3 py-2 text-sm text-ink shrink-0"
              >
                <option value="ADMIN">ADMIN</option>
                <option value="USER">USER</option>
              </select>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[13.5px] text-white">결과 캐시 TTL</p>
                <p className="text-[11.5px] text-muted mt-1">
                  같은 질의는 이 시간 동안 재호출하지 않습니다.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <input
                  type="number"
                  defaultValue={aiConfig.cacheTtlHours}
                  className="w-20 bg-[#12141c] border border-border rounded-xl px-3 py-2 text-sm text-white text-right"
                />
                <span className="text-xs text-muted">시간</span>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[13.5px] text-white">월 토큰 하드캡(전역)</p>
                <p className="text-[11.5px] text-muted mt-1">
                  초과 시 모든 AI 호출이 즉시 차단됩니다.
                </p>
              </div>
              <input
                type="number"
                defaultValue={aiConfig.globalMonthlyTokenCap}
                className="w-32 bg-[#12141c] border border-border rounded-xl px-3 py-2 text-sm text-white text-right shrink-0"
              />
            </div>
          </div>
        </Card>

        <Card>
          <CardTitle>이번 달 사용량</CardTitle>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white tabular-nums">
              {(aiConfig.tokensUsedThisMonth / 1000).toFixed(0)}K
            </span>
            <span className="text-sm text-muted">
              / {(aiConfig.globalMonthlyTokenCap / 1000).toFixed(0)}K 토큰
            </span>
          </div>
          <div className="mt-3 h-2.5 rounded-full bg-[#12141c] overflow-hidden">
            <div
              className={cx(
                "h-full rounded-full",
                globalPct > 80 ? "bg-red-400" : globalPct > 50 ? "bg-yellow-400" : "bg-emerald-500",
              )}
              style={{ width: `${Math.min(100, globalPct)}%` }}
            />
          </div>
          <ul className="mt-5 space-y-2.5">
            {sorted.map((p) => {
              const cap = p.monthlyTokenCap;
              const pct = cap ? (p.tokensUsedThisMonth / cap) * 100 : 0;
              return (
                <li key={p.id} className="flex items-center gap-2.5">
                  <span className="text-[12px] text-gray-300 w-32 shrink-0 truncate">
                    {p.name}
                  </span>
                  <div className="flex-1 h-1.5 rounded-full bg-[#12141c] overflow-hidden">
                    <div
                      className={cx("h-full rounded-full", p.free ? "bg-emerald-500" : "bg-gold-500")}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-gray-500 tabular-nums w-20 text-right">
                    {(p.tokensUsedThisMonth / 1000).toFixed(0)}K
                    {cap ? ` / ${(cap / 1000).toFixed(0)}K` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 pt-3 border-t border-border/70 flex items-start gap-2 text-[11px] text-gray-600">
            <AlertIcon size={13} className="text-yellow-500 shrink-0 mt-0.5" />
            모든 AI 호출은 서버 라우트를 경유합니다. 키가 브라우저로 전달되지 않습니다.
          </p>
        </Card>
      </div>

      <Table>
        <thead>
          <tr>
            <Th className="w-14 text-center">순서</Th>
            <Th>제공자</Th>
            <Th className="w-44">모델</Th>
            <Th className="w-36">API 키(env)</Th>
            <Th className="w-24 text-center">연결</Th>
            <Th className="w-20 text-center">활성</Th>
            <Th className="w-16 text-right">편집</Th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <Tr key={p.id}>
              <Td className="text-center tabular-nums text-gray-500">{p.priority}</Td>
              <Td>
                <div className="flex items-center gap-2">
                  <span className="text-white text-[13px]">{p.name}</span>
                  {p.free ? <Badge tone="emerald">무료</Badge> : <Badge tone="gold">유료</Badge>}
                </div>
                <span className="text-[11px] text-gray-600 font-mono">
                  {p.baseUrl ?? "anthropic sdk"}
                </span>
              </Td>
              <Td className="font-mono text-[11.5px] text-gray-400">{p.model}</Td>
              <Td className="font-mono text-[11.5px] text-gray-400">{p.apiKeyEnv}</Td>
              <Td className="text-center">
                {p.connected ? (
                  <Badge tone="emerald">연결됨</Badge>
                ) : (
                  <Badge tone="neutral">미설정</Badge>
                )}
              </Td>
              <Td>
                <div className="flex justify-center">
                  <Toggle defaultOn={p.enabled} size="sm" />
                </div>
              </Td>
              <Td>
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-cardHover transition-colors"
                    aria-label="편집"
                  >
                    <EditIcon size={15} />
                  </button>
                </div>
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>

      <p className="mt-5 text-[11px] text-gray-600 leading-relaxed">
        폴백 순서: 우선순위(숫자 오름차순) → 활성 &amp; 연결됨 &amp; 월 캡 미초과인 제공자를 차례로
        시도합니다. 키 값 자체는 DB에 저장하지 않고 env 변수명만 기록합니다.
      </p>
    </AdminShell>
  );
}

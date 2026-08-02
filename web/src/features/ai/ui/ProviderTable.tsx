/**
 * 제공자 목록 — "지금 부를 수 있는가"를 한 화면에서 판단할 수 있게.
 *
 * 화면에 절대 나오지 않는 것: 키 값. 나오는 것은 **어느 env 변수에 넣어야 하는지**와
 * **지금 그 변수가 채워져 있는지**뿐이다.
 */
import { Badge } from "@/components/ui/Badge";
import { Table, Th, Td, Tr } from "@/components/ui/Table";
import { cx } from "@/lib/format";
import { AI_PROVIDERS } from "@/lib/ai/catalog";
import type { ProviderUsage } from "@/lib/ai/routing";
import { toggleProviderAction, updateCapAction } from "../actions";

export function ProviderTable({
  usage,
  connected,
}: {
  usage: ProviderUsage[];
  /** env에 키가 채워진 제공자 id 집합 (키 '값'은 넘기지 않는다) */
  connected: string[];
}) {
  const usageById = new Map(usage.map((u) => [u.providerId, u]));

  return (
    <Table>
      <thead>
        <tr>
          <Th className="w-12 text-center">순서</Th>
          <Th>제공자</Th>
          <Th className="w-56">기본 모델 · 요금</Th>
          <Th className="w-44">키를 넣을 곳</Th>
          <Th className="w-40">이번 달 / 상한</Th>
          <Th className="w-20 text-center">사용</Th>
        </tr>
      </thead>
      <tbody>
        {AI_PROVIDERS.map((p, index) => {
          const u = usageById.get(p.id);
          const isConnected = connected.includes(p.id);
          const cap = u?.monthlyTokenCap ?? null;
          const used = u?.tokensUsedThisMonth ?? 0;
          const pct = cap ? (used / cap) * 100 : 0;
          const enabled = u?.enabled ?? true;

          return (
            <Tr key={p.id}>
              <Td className="text-center tabular-nums text-gray-500">{index}</Td>

              <Td>
                <div className="flex items-center gap-2">
                  <span className="text-white text-[13px]">{p.label}</span>
                  {p.free ? <Badge tone="emerald">무료</Badge> : <Badge tone="gold">유료</Badge>}
                  {isConnected ? (
                    <Badge tone="emerald">연결됨</Badge>
                  ) : (
                    <Badge tone="neutral">미설정</Badge>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-gray-600 leading-relaxed">{p.note}</p>
                <a
                  href={p.consoleUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-1 inline-block text-[11px] text-gold-500 hover:underline"
                >
                  키 발급 페이지 ↗
                </a>
              </Td>

              <Td>
                <ul className="space-y-1">
                  {p.models.map((m) => (
                    <li key={m.id} className="leading-tight">
                      <span className="font-mono text-[11.5px] text-gray-300">{m.id}</span>
                      <span className="ml-2 text-[10.5px] text-gray-600">
                        {m.price
                          ? `$${m.price.inputPerMTok}/$${m.price.outputPerMTok} per 1M`
                          : "요금 미확인"}
                      </span>
                    </li>
                  ))}
                </ul>
              </Td>

              <Td>
                <code className="text-[11.5px] text-gray-300">{p.apiKeyEnv}</code>
                <p className="mt-1 text-[10.5px] text-gray-600">
                  {isConnected ? "서버에 값이 있습니다" : ".env에 추가 후 ai:sync"}
                </p>
              </Td>

              <Td>
                <form action={updateCapAction} className="flex items-center gap-1.5">
                  <input type="hidden" name="apiKeyEnv" value={p.apiKeyEnv} />
                  <input
                    type="number"
                    name="cap"
                    defaultValue={cap ?? ""}
                    placeholder="무제한"
                    min={0}
                    step={10000}
                    className="w-24 bg-[#12141c] border border-border rounded-lg px-2 py-1 text-[11.5px] text-white text-right"
                  />
                  <button
                    type="submit"
                    className="text-[11px] px-2 py-1 rounded-lg border border-border text-gray-400 hover:text-white hover:border-gold-600/50 transition-colors"
                  >
                    저장
                  </button>
                </form>
                <div className="mt-1.5 h-1.5 rounded-full bg-[#12141c] overflow-hidden">
                  <div
                    className={cx(
                      "h-full rounded-full",
                      pct > 80 ? "bg-red-400" : p.free ? "bg-emerald-500" : "bg-gold-500",
                    )}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
                <p className="mt-1 text-[10.5px] text-gray-600 tabular-nums">
                  {(used / 1000).toFixed(0)}K {cap ? `/ ${(cap / 1000).toFixed(0)}K` : "/ 무제한"}
                  {!p.free && cap === null && (
                    <span className="ml-1.5 text-red-400">⚠ 유료인데 상한 없음</span>
                  )}
                </p>
              </Td>

              <Td>
                <form action={toggleProviderAction} className="flex justify-center">
                  <input type="hidden" name="apiKeyEnv" value={p.apiKeyEnv} />
                  <input type="hidden" name="enabled" value={String(!enabled)} />
                  <button
                    type="submit"
                    aria-label={`${p.label} ${enabled ? "끄기" : "켜기"}`}
                    className={cx(
                      "px-2.5 py-1 rounded-full text-[11px] border transition-colors",
                      enabled
                        ? "border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10"
                        : "border-border text-gray-500 hover:text-white",
                    )}
                  >
                    {enabled ? "켜짐" : "꺼짐"}
                  </button>
                </form>
              </Td>
            </Tr>
          );
        })}
      </tbody>
    </Table>
  );
}

import type { Metadata } from "next";
import { AdminPageHeader, AdminShell } from "@/components/layout/AdminPageHeader";
import { Card, CardTitle } from "@/components/ui/Card";
import { KnowledgePanel } from "@/features/ai/ui/KnowledgePanel";
import { ProviderTable } from "@/features/ai/ui/ProviderTable";
import { TaskRouting } from "@/features/ai/ui/TaskRouting";
import { KeySetupGuide } from "@/features/ai/ui/KeySetupGuide";
import { loadAiConfig, loadProviderUsage, loadTaskModes } from "@/features/ai/repository";
import { credentialStatuses, masterKeyStatus } from "@/features/ai/credentials";
import { AI_PROVIDERS } from "@/lib/ai/catalog";
import { requireAdmin } from "@/lib/session";
import { cx } from "@/lib/format";

export const metadata: Metadata = { title: "AI 제공자" };

/**
 * ⚠ 정적 생성 금지. 키 보유 여부와 사용량은 런타임 값이라
 * 빌드 시점에 굳으면 "키를 넣었는데 화면은 계속 미설정"이 된다.
 */
export const dynamic = "force-dynamic";

export default async function AdminAiPage() {
  await requireAdmin("/admin/ai");

  const [usage, config, statuses, master, taskModes] = await Promise.all([
    loadProviderUsage(),
    loadAiConfig(),
    credentialStatuses(),
    masterKeyStatus(),
    loadTaskModes(),
  ]);

  /**
   * ⚠ 키 '값'은 이 경계를 넘지 않는다. 아래로는 **어디에 저장돼 있는지**만 내려간다.
   * ⚠ DB와 env를 함께 본다 — 둘 중 하나에 있으면 부를 수 있다(DB가 우선).
   */
  const connectedEnv = statuses.filter((s) => s.source !== "NONE").map((s) => s.name);
  const connectedIds = AI_PROVIDERS.filter((p) => connectedEnv.includes(p.apiKeyEnv)).map(
    (p) => p.id,
  );

  const globalPct = (config.tokensUsedThisMonth / config.globalMonthlyTokenCap) * 100;
  const freeConnected = AI_PROVIDERS.filter(
    (p) => p.free && connectedEnv.includes(p.apiKeyEnv),
  ).length;

  return (
    <AdminShell>
      <AdminPageHeader
        title="AI 제공자"
        description="무료 제공자를 앞에 세우고, 작업이 요구하는 급을 만족하는 가장 싼 모델을 고릅니다. 키는 아래에서 등록하면 암호화되어 저장되고, 이 화면에 다시 표시되지 않습니다."
      />

      <div className="mb-7 grid gap-4 lg:grid-cols-3">
        <Card>
          <p className="text-[11px] text-muted">연결된 제공자</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-ink">
            {connectedIds.length}
            <span className="ml-1 text-sm font-normal text-gray-500">/ {AI_PROVIDERS.length}</span>
          </p>
          <p className="mt-1.5 text-[11px] text-gray-600">
            그중 무료 <span className="text-emerald-400">{freeConnected}곳</span>
            {freeConnected === 0 && " — 무료 키를 먼저 등록하면 유료 호출이 줄어듭니다"}
          </p>
        </Card>

        <Card>
          <p className="text-[11px] text-muted">이번 달 전역 사용량</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-ink">
            {(config.tokensUsedThisMonth / 1000).toFixed(0)}K
            <span className="ml-1 text-sm font-normal text-gray-500">
              / {(config.globalMonthlyTokenCap / 1000).toFixed(0)}K
            </span>
          </p>
          <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-bg">
            <div
              className={cx(
                "h-full rounded-full",
                globalPct > 80 ? "bg-red-400" : globalPct > 50 ? "bg-gold-500" : "bg-emerald-500",
              )}
              style={{ width: `${Math.min(100, globalPct)}%` }}
            />
          </div>
          {/*
            ⚠ 전에는 "초과하면 모든 AI 호출이 차단됩니다"라고 적혀 있었다. 두 가지가 틀렸다 —
            (1) 그때는 이 상한을 **아무도 검사하지 않았고**, (2) 지금 검사하는 것도 유료만이다.
            화면이 하지 않는 일을 한다고 적어 두면 그게 가장 위험한 거짓말이 된다.
          */}
          <p className="mt-1.5 text-[11px] text-gray-600">
            초과하면 <strong className="text-gray-400">유료 제공자가 후보에서 빠집니다.</strong>{" "}
            무료는 계속 돕니다.
          </p>
        </Card>

        <Card>
          <p className="text-[11px] text-muted">실행 권한 · 캐시</p>
          <p className="mt-1 text-2xl font-bold text-ink">{config.allowedRole}</p>
          <p className="mt-1.5 text-[11px] text-gray-600">
            같은 질의는 {config.cacheTtlHours}시간 동안 재호출하지 않습니다. 비용 방어를 위해
            기본값은 관리자 전용입니다.
          </p>
        </Card>
      </div>

      <Card className="mb-7">
        <CardTitle>사이트 기록 검색 (RAG)</CardTitle>
        <p className="mb-4 text-[12px] leading-relaxed text-gray-500">
          AI가 답할 때 참고하는 것은 <strong>이 사이트에 쌓인 기록</strong>입니다 —
          글·투자일지·보유 종목·거시 지표·버블 채점. 질문을 넣어 <strong>무엇이 뽑히는지 먼저
          확인</strong>하세요. RAG는 조용히 틀리기 때문에, 엉뚱한 기록을 골라도 답변은 그럴듯하게
          나옵니다.
        </p>
        <KnowledgePanel />
      </Card>

      <Card className="mb-7">
        <CardTitle>작업별 라우팅</CardTitle>
        <TaskRouting
          connectedEnv={connectedEnv}
          usage={usage}
          modes={taskModes}
          global={{
            tokensUsedThisMonth: config.tokensUsedThisMonth,
            globalMonthlyTokenCap: config.globalMonthlyTokenCap,
          }}
        />
      </Card>

      <div className="mb-7">
        <h2 className="mb-3 text-sm font-semibold text-ink">제공자</h2>
        <ProviderTable usage={usage} connected={connectedIds} />
      </div>

      <KeySetupGuide statuses={statuses} master={master} />
    </AdminShell>
  );
}

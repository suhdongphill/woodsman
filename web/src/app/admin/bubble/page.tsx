import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader, AdminShell } from "@/components/layout/AdminPageHeader";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { requireAdmin } from "@/lib/session";
import { ALL_BUBBLE_INDICATORS, BUBBLE_LAYERS, BUBBLE_TRIGGERS } from "@/lib/bubble/catalog";
import { scoreBubble } from "@/lib/bubble/score";
import { loadReadings, loadTriggerStates } from "@/features/bubble/repository";
import { ScoreGauge } from "@/features/bubble/ui/ScoreGauge";
import { ReadingForm } from "@/features/bubble/ui/ReadingForm";
import { TriggerForm } from "@/features/bubble/ui/TriggerForm";

export const metadata: Metadata = { title: "버블 모니터" };

/** ⚠ 정적 생성 금지 — 채점해도 화면이 안 바뀐다. */
export const dynamic = "force-dynamic";

/**
 * 버블 모니터 채점.
 *
 * 30개 지표를 0·1·2로 매기고 근거를 한 줄 적는다. 자동으로 받아 올 수 있는 값이 거의 없는
 * 모델이라(설계서가 정성 판단을 절반 두었다) **손으로 채점하는 화면**이 본체다.
 * 분기 1회 점검을 전제로 만들었다.
 */
export default async function AdminBubblePage() {
  await requireAdmin("/admin/bubble");

  const [readings, triggers] = await Promise.all([loadReadings(), loadTriggerStates()]);
  const score = scoreBubble(readings);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <AdminShell>
      <AdminPageHeader
        title="버블 모니터 채점"
        description={`다섯 층 ${ALL_BUBBLE_INDICATORS.length}개 지표를 0·1·2로 매깁니다. 근거를 함께 적어야 나중에 왜 그렇게 봤는지 알 수 있습니다.`}
        action={
          <Link
            href="/macro/bubble"
            className="rounded-xl border border-border px-3 py-2 text-[12.5px] text-gray-300 transition-colors hover:border-gold-600/40 hover:text-white"
          >
            공개 화면 보기
          </Link>
        }
      />

      <div className="mb-6">
        <ScoreGauge score={score} />
      </div>

      <p className="mb-6 rounded-xl border border-border bg-card px-4 py-3 text-[12px] leading-relaxed text-gray-400">
        ⚠ 채점을 <strong>지우면 0점이 아니라 결측</strong>이 됩니다. 결측은 분모에서 빠지고,
        공개 화면에는 &ldquo;미채점&rdquo;으로 표시됩니다. 확신이 없으면 0점을 주지 말고
        비워 두세요 — 0점은 &ldquo;확인했고 안정적&rdquo;이라는 뜻입니다.
      </p>

      {BUBBLE_LAYERS.map((layer) => {
        const layerScore = score.layers.find((l) => l.layer.id === layer.id);
        return (
          <Card key={layer.id} className="mb-5" padding="p-0">
            <div className="px-5 pt-5">
              <CardTitle
                action={
                  <div className="flex items-center gap-2">
                    <Badge tone="neutral">가중치 {layer.weight}</Badge>
                    <Badge tone={layerScore?.average === undefined ? "neutral" : "gold"}>
                      {layerScore?.average === undefined
                        ? "미채점"
                        : `평균 ${layerScore.average.toFixed(1)}`}
                    </Badge>
                  </div>
                }
              >
                {layer.id} · {layer.name}
              </CardTitle>
              <p className="pb-3 text-[12px] text-muted">{layer.note}</p>
            </div>

            {layer.indicators.map((indicator) => (
              <ReadingForm
                key={indicator.key}
                indicator={indicator}
                reading={readings.get(indicator.key)}
                today={today}
              />
            ))}
          </Card>
        );
      })}

      <Card padding="p-0">
        <div className="px-5 pt-5">
          <CardTitle>하드 트리거 ({BUBBLE_TRIGGERS.length}건)</CardTitle>
          <p className="pb-3 text-[12px] text-muted">
            점수와 별개로 감시합니다. 하나라도 발생하면 공개 화면 맨 아래에 &ldquo;발생&rdquo;으로
            표시됩니다.
          </p>
        </div>
        {BUBBLE_TRIGGERS.map((trigger) => (
          <TriggerForm
            key={trigger.key}
            trigger={trigger}
            state={triggers.get(trigger.key)}
            today={today}
          />
        ))}
      </Card>
    </AdminShell>
  );
}

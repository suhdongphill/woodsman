import Link from "next/link";
import type { BubbleScore } from "@/lib/bubble/score";
import {
  BUBBLE_GUIDE,
  LIQUIDITY_PARTS,
  TIDE_GUIDES,
  levelWord,
  type TideDirection,
  type TideGuide,
  type TideReading,
} from "@/lib/scores/tide";

/**
 * 홈 앞줄 「조류」 — 돈은 어느 쪽으로 흐르나.
 *
 * ## 운영자 원칙 ④ · ⑤ (개발요구서 v2, 2026-09-14)
 * - 유동성 · AI 버블 점수는 **앞줄에**, 「어떻게 보나 · 어떻게 판단하나」를 **펼치지 않아도 보이게** 붙인다.
 *   (지표가 뒤에 있으면 도움을 못 받는다 — 접어 두면 다시 뒤에 숨는다.)
 * - **조류 · 바람 · 파도를 섞지 않는다.** 이 블록은 몇 달 단위의 흐름만 말한다. 이번 주 움직임은 「지금 부는 바람」(`MacroStrip`)이다.
 *
 * ## ⚠ 지키는 것
 * - 발행 기준 미달이면 **숫자 대신 「판정 보류」와 커버리지**를 낸다. 0으로도, 계산값으로도 채우지 않는다.
 * - 값과 기준일은 항상 함께. 사흘 넘게 새 점수가 없으면 **묵었다**고 적는다.
 * - 과거 점수가 나중의 수정 자료로 다시 계산한 값이면 그렇다고 적는다.
 * - 방향은 **색만으로 말하지 않는다**(화살표 + 글자). 등락색(적/청)을 쓰지 않는다 — 좋고 나쁨이 아니라 흐름이다.
 * - 판단 문장은 조건형이다. 버블 카탈로그의 「비중 확대」 같은 대응 문구는 홈에 올리지 않는다.
 */

const ARROW: Record<TideDirection, string> = { up: "↑", down: "↓", flat: "→", unknown: "·" };

function directionText(dir: TideDirection, guide: Pick<TideGuide, "up" | "down">): string {
  if (dir === "up") return guide.up;
  if (dir === "down") return guide.down;
  if (dir === "flat") return "보합";
  return "비교할 과거 점수 없음";
}

function Guide({ how, judge }: { how: string; judge: string }) {
  return (
    <dl className="mt-3 space-y-1.5 border-t border-border/60 pt-3 text-[12px] leading-relaxed">
      <div>
        <dt className="inline font-semibold text-ink">어떻게 보나 </dt>
        <dd className="inline text-muted">{how}</dd>
      </div>
      <div>
        <dt className="inline font-semibold text-ink">어떻게 판단하나 </dt>
        <dd className="inline text-muted">{judge}</dd>
      </div>
    </dl>
  );
}

function ScoreCard({
  reading,
  guide,
  parts,
  href,
}: {
  reading: TideReading;
  guide: TideGuide;
  /** 판정 보류일 때 보여 줄 하위 계기 */
  parts?: { label: string; reading: TideReading }[];
  href: string;
}) {
  const latest = reading.latest;
  const published = latest && latest.value !== null && latest.state !== "DO_NOT_PUBLISH";
  const publishedParts = (parts ?? []).filter((p) => p.reading.latest?.value != null && p.reading.latest.state !== "DO_NOT_PUBLISH");

  return (
    <article className="flex flex-col rounded-2xl border border-border bg-card p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[13px] font-semibold text-ink">{guide.title}</h3>
        {latest && (
          <span className="text-[10.5px] text-ink-3">
            {latest.asOf} 기준 · 커버리지 {latest.coverage}%{latest.state === "LOW_CONFIDENCE" ? " · 낮은 신뢰" : ""}
          </span>
        )}
      </div>

      {!latest ? (
        <p className="mt-3 text-[13px] text-muted">첫 점수는 다음 자료 수집 뒤에 계산됩니다.</p>
      ) : published ? (
        <>
          <p className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums text-ink">{Math.round(latest.value!)}</span>
            <span className="text-[12px] text-muted">{levelWord(latest.value!)}</span>
          </p>
          <ul className="mt-2 space-y-0.5 text-[12px] text-ink">
            <li>
              <span aria-hidden>{ARROW[reading.dir4]} </span>4주 전 대비 {directionText(reading.dir4, guide)}
            </li>
            <li>
              <span aria-hidden>{ARROW[reading.dir13]} </span>13주 전 대비 {directionText(reading.dir13, guide)}
            </li>
          </ul>
        </>
      ) : (
        <>
          <p className="mt-2 text-[15px] font-semibold text-ink">판정 보류</p>
          <p className="mt-1 text-[12px] leading-relaxed text-muted">
            채울 수 있는 계기가 {latest.coverage}%라 숫자를 내지 않습니다(60% 미만은 발행하지 않는 규칙).
          </p>
          {publishedParts.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-ink">
              {publishedParts.map((p) => (
                <li key={p.label}>
                  {p.label} <span className="font-semibold tabular-nums">{Math.round(p.reading.latest!.value!)}</span>
                  <span className="text-ink-3"> {ARROW[p.reading.dir4]}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {reading.stale && <p className="mt-2 text-[11px] text-gold-500">⚠ 사흘 넘게 새 점수가 없습니다 — 수집이 멈췄을 수 있습니다.</p>}
      {published && reading.pastRecomputed && (
        <p className="mt-1 text-[10.5px] text-ink-3">과거 점수는 지금의 (수정된) 자료로 다시 계산한 값입니다.</p>
      )}

      <Guide how={guide.how} judge={guide.judge} />
      <Link href={href} className="mt-3 text-[12px] text-gold-500 hover:text-gold-400">
        근거 자세히 보기 →
      </Link>
    </article>
  );
}

function BubbleCard({ score }: { score: BubbleScore }) {
  return (
    <article className="flex flex-col rounded-2xl border border-border bg-card p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[13px] font-semibold text-ink">{BUBBLE_GUIDE.title}</h3>
        <span className="text-[10.5px] text-ink-3">
          {score.asOf.oldest ? `${score.asOf.oldest}~${score.asOf.newest} 채점` : "채점 기준일 없음"} · {score.coverage.scored}/
          {score.coverage.total}개
        </span>
      </div>
      {score.score === undefined ? (
        <p className="mt-3 text-[13px] text-muted">아직 채점한 지표가 없습니다.</p>
      ) : (
        <>
          <p className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums text-ink">{Math.round(score.score)}</span>
            {/* ⚠ 국면 이름만 — 카탈로그의 대응 문구(stance)는 홈에 올리지 않는다 */}
            <span className="text-[12px] text-muted">{score.band?.regime} 국면</span>
          </p>
          {/* ⚠ 버블 채점은 분기마다 덮어써서 과거 점수가 없다 — 방향을 지어내지 않는다 */}
          <p className="mt-2 text-[12px] text-ink-3">방향: 과거 채점 기록이 없어 아직 내지 않습니다.</p>
          {score.priorityFired && <p className="mt-1 text-[12px] font-semibold text-gold-500">⚠ {score.priorityText}</p>}
        </>
      )}
      <Guide how={BUBBLE_GUIDE.how} judge={BUBBLE_GUIDE.judge} />
      <Link href="/macro/bubble" className="mt-3 text-[12px] text-gold-500 hover:text-gold-400">
        채점 근거 보기 →
      </Link>
    </article>
  );
}

export function TideSection({ tides, bubble }: { tides: Map<string, TideReading>; bubble: BubbleScore }) {
  const empty = (key: string): TideReading => tides.get(key) ?? { scoreKey: key, dir4: "unknown", dir13: "unknown", pastRecomputed: false, stale: false };
  return (
    <section aria-labelledby="tide-heading" className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
      <div className="mb-3">
        <h2 id="tide-heading" className="text-[13px] font-semibold tracking-tight text-ink">
          조류 — 돈은 어느 쪽으로 흐르나
        </h2>
        <p className="mt-0.5 text-[11.5px] text-ink-3">
          몇 달 단위의 흐름입니다. 이번 주의 움직임은 위 「지금 부는 바람」에서 봅니다. 점수는 프로그램이 규칙대로 계산하며 예측이 아닙니다.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <ScoreCard
          reading={empty("global_liquidity")}
          guide={TIDE_GUIDES.global_liquidity!}
          parts={LIQUIDITY_PARTS.map((p) => ({ label: p.label, reading: empty(p.key) }))}
          href="/macro/liquidity"
        />
        <BubbleCard score={bubble} />
        <ScoreCard reading={empty("engine_heat")} guide={TIDE_GUIDES.engine_heat!} href="/macro/inflation" />
      </div>
    </section>
  );
}

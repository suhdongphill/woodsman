import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { ChevronRightIcon } from "@/components/icons";
import { JsonLd } from "@/components/seo/JsonLd";
import { TistoryCta } from "@/features/site/ui/TistoryCta";
import { OverlayChart, OVERLAY_COLORS, OVERLAY_MARKS } from "@/features/macro/ui/OverlayChart";
import { FreshnessBadge, HealthNotice, LayerChip } from "@/features/macro/ui/Freshness";
import { loadMacroOverlay } from "@/features/macro/service";
import { MACRO_INDICATORS, MACRO_SECTORS } from "@/lib/macro/catalog";
import {
  OVERLAY_MAX,
  OVERLAY_MODES,
  OVERLAY_SPANS,
  isOverlayMode,
  overlayTable,
  parseOverlayKeys,
  type OverlayMode,
} from "@/lib/macro/overlay";
import { breadcrumbJsonLd } from "@/lib/seo";
import { getSiteBasics } from "@/lib/site-settings";
import { cx, profitColor } from "@/lib/format";

export const metadata: Metadata = {
  title: "지표 겹쳐 보기 — 같은 시간축 위에 세워 괴리를 본다",
  description:
    "금리·유동성·물가·주가 지표를 최대 4개까지 한 그림에 겹쳐 봅니다. 단위가 다르면 축을 두 개 그리는 대신 척도를 환산합니다 — 축을 조정하는 것만으로 아무 결론이나 만들 수 있기 때문입니다.",
  alternates: { canonical: "/macro/compare" },
};

/** ⚠ 정적 생성 금지 — 고른 지표와 DB 값에 따라 매번 달라진다. */
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const one = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

/** 체크박스는 같은 이름으로 여러 개가 온다. 문자열 하나로도, 배열로도 받는다. */
function keysParam(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v.join(",");
  return v ?? "";
}

/** 처음 온 사람에게 빈 화면을 주지 않는다 — 읽을 만한 조합 하나를 미리 세워 둔다. */
const DEFAULT_KEYS = ["ust10y", "real10", "bei10"];

/**
 * 지표 겹쳐 보기.
 *
 * 볼트 `_apps/지표 오버레이 비교.html`을 사이트로 옮긴 화면이다(2026-08-22).
 *
 * ## ⚠ 스크립트 없이 동작한다
 * 고르기는 **체크박스 + GET 폼**이다. 자바스크립트로 상태를 들고 있으면 크롤러와
 * 느린 기기에서 빈 화면이 되고, 주소를 복사해 남에게 보낼 수도 없다.
 * 지금 보고 있는 조합이 곧 주소다.
 *
 * ## ⚠ 여기서 내는 것은 "같이 움직였다"까지다
 * 겹쳐 보인다고 인과가 아니다. 문구에서 그 선을 넘지 않는다.
 */
export default async function MacroComparePage({ searchParams }: Props) {
  const sp = await searchParams;

  const allKeys = MACRO_INDICATORS.map((i) => i.key);
  const picked = parseOverlayKeys(keysParam(sp.keys), allKeys);
  const keys = picked.length > 0 ? picked : DEFAULT_KEYS.filter((k) => allKeys.includes(k));

  const modeRaw = one(sp.mode) ?? "rebase";
  const mode: OverlayMode = isOverlayMode(modeRaw) ? modeRaw : "rebase";

  const yearsRaw = Number(one(sp.years));
  const years = (OVERLAY_SPANS as readonly number[]).includes(yearsRaw) ? yearsRaw : 3;

  const [{ views, result, health }, basics] = await Promise.all([
    loadMacroOverlay({ keys, mode, years }),
    getSiteBasics(),
  ]);

  const table = overlayTable(result.lines, 12);
  const modeDef = OVERLAY_MODES.find((m) => m.key === result.mode)!;

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "홈", path: "/" },
          { name: "거시 지표", path: "/macro" },
          { name: "겹쳐 보기", path: "/macro/compare" },
        ])}
      />

      <PageHeader
        eyebrow="OVERLAY"
        title="지표 겹쳐 보기"
        description="따로 보면 안 보이는 것이 나란히 놓으면 보입니다. 최대 4개까지 같은 시간축 위에 세워 어디서 벌어졌는지를 봅니다."
      />

      <div className="mx-auto max-w-5xl space-y-8 px-4 py-10 sm:px-6">
        <nav aria-label="현재 위치" className="flex items-center gap-1.5 text-[12px] text-gray-500">
          <Link href="/macro" className="hover:text-gold-400">
            거시 지표
          </Link>
          <ChevronRightIcon size={12} />
          <span className="text-gray-400">겹쳐 보기</span>
        </nav>

        <HealthNotice health={health} />

        {/* ── 그림 ── */}
        <Card padding="p-5 sm:p-6">
          <OverlayChart lines={result.lines} />

          {/* 범례 — ⚠ 색 옆에 모양과 이름을 함께 낸다 */}
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {result.lines.map((line, i) => {
              const view = views.find((v) => v.indicator.key === line.key);
              return (
                <li
                  key={line.key}
                  className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-bg px-3 py-2"
                >
                  <span
                    aria-hidden="true"
                    style={{ color: OVERLAY_COLORS[i % OVERLAY_COLORS.length] }}
                    className="text-[12px]"
                  >
                    {OVERLAY_MARKS[i % OVERLAY_MARKS.length]}
                  </span>
                  {view && <LayerChip layer={view.indicator.layer} />}
                  <span className="text-[12.5px] text-gray-300">{line.label}</span>
                  <span className="ml-auto flex items-center gap-1.5">
                    {view && <FreshnessBadge freshness={view.freshness} />}
                    <span className="text-[12px] font-semibold tabular-nums text-ink">
                      {view ? view.display : "—"}
                    </span>
                    {line.changePct !== undefined && (
                      <span
                        className={cx(
                          "text-[11px] tabular-nums",
                          profitColor(line.changePct),
                        )}
                      >
                        {line.changePct > 0 ? "▲" : "▼"} {Math.abs(line.changePct).toFixed(1)}%
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>

          <p className="mt-3 text-[11.5px] leading-relaxed text-gray-600">
            {result.from && result.to ? `${result.from} ~ ${result.to} · ` : ""}
            {modeDef.label} — {modeDef.desc}
          </p>

          {result.modeNotice && (
            <p className="mt-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.05] px-3 py-2 text-[11.5px] leading-relaxed text-amber-200/90">
              ⚠ {result.modeNotice}
            </p>
          )}

          {result.tooShort.length > 0 && (
            <p className="mt-2 text-[11.5px] text-gray-500">
              값이 모자라 그리지 못한 지표: {result.tooShort.join(", ")} — 조용히 빼지 않고
              알립니다.
            </p>
          )}
        </Card>

        {/* ── 고르기 (스크립트 없이 동작하는 GET 폼) ── */}
        <Card padding="p-5 sm:p-6">
          <h2 className="text-[15px] font-semibold text-ink">무엇을 겹쳐 볼까요</h2>
          <p className="mt-1 text-[12px] text-gray-500">
            최대 {OVERLAY_MAX}개까지 그립니다(더 고르면 앞에서부터 {OVERLAY_MAX}개). 고른 조합이
            곧 이 페이지 주소라, 그대로 복사해 두거나 공유할 수 있습니다.
          </p>

          <form method="get" className="mt-4 space-y-5">
            <fieldset>
              <legend className="text-[12px] font-semibold text-gold-400">기간</legend>
              <div className="mt-2 flex flex-wrap gap-3">
                {OVERLAY_SPANS.map((y) => (
                  <label key={y} className="flex items-center gap-1.5 text-[12.5px] text-gray-300">
                    <input type="radio" name="years" value={y} defaultChecked={y === years} />
                    {y}년
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-[12px] font-semibold text-gold-400">척도</legend>
              <div className="mt-2 space-y-1.5">
                {OVERLAY_MODES.map((m) => (
                  <label key={m.key} className="flex items-start gap-2 text-[12.5px] text-gray-300">
                    <input
                      type="radio"
                      name="mode"
                      value={m.key}
                      defaultChecked={m.key === mode}
                      className="mt-1"
                    />
                    <span>
                      <strong className="text-ink">{m.label}</strong>
                      <span className="ml-1.5 text-gray-500">{m.desc}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-[12px] font-semibold text-gold-400">지표</legend>
              <div className="mt-2 space-y-4">
                {MACRO_SECTORS.map((sector) => (
                  <div key={sector.group.key}>
                    <p className="text-[11.5px] text-gray-500">
                      <span aria-hidden="true">{sector.group.emoji}</span> {sector.group.name}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1.5">
                      {sector.indicators.map((ind) => (
                        <label
                          key={ind.key}
                          className="flex items-center gap-1.5 text-[12.5px] text-gray-300"
                        >
                          <input
                            type="checkbox"
                            name="keys"
                            value={ind.key}
                            defaultChecked={keys.includes(ind.key)}
                          />
                          {ind.name}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </fieldset>

            <button
              type="submit"
              className="rounded-lg bg-gold-500 px-4 py-2 text-[13px] font-semibold text-[#1a1400] transition-colors hover:bg-gold-400"
            >
              겹쳐 보기
            </button>
          </form>
        </Card>

        {/* ── 표 — ⚠ 색만으로 계열을 식별하지 않기 위한 대체 표현 ── */}
        {table.length > 0 && (
          <Card padding="p-5 sm:p-6">
            <h2 className="text-[15px] font-semibold text-ink">표로 보기</h2>
            <p className="mt-1 text-[12px] text-gray-500">
              그림을 색으로 구분하기 어려운 분과 화면 낭독기를 위한 같은 내용입니다. 값은{" "}
              <strong className="text-gray-300">{modeDef.label}</strong> 기준으로 환산된 숫자입니다
              — 원래 단위의 최근값은 위 범례에 있습니다.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse text-[12px]">
                <thead>
                  <tr className="border-b border-border text-left text-gray-500">
                    <th className="py-2 pr-3 font-medium">날짜</th>
                    {result.lines.map((l, i) => (
                      <th key={l.key} className="py-2 pr-3 font-medium">
                        <span
                          aria-hidden="true"
                          style={{ color: OVERLAY_COLORS[i % OVERLAY_COLORS.length] }}
                          className="mr-1"
                        >
                          {OVERLAY_MARKS[i % OVERLAY_MARKS.length]}
                        </span>
                        {l.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.map((row) => (
                    <tr key={row.date} className="border-b border-border/50">
                      <td className="py-1.5 pr-3 tabular-nums text-gray-400">{row.date}</td>
                      {row.values.map((v, i) => (
                        <td key={i} className="py-1.5 pr-3 tabular-nums text-gray-200">
                          {v === undefined ? <span className="text-gray-600">—</span> : v.toFixed(2)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* ⚠ 읽는 법의 선 */}
        <Card className="border-gold-600/30 bg-gold-500/[0.04]">
          <h2 className="text-[15px] font-semibold text-ink">이 그림을 어떻게 읽나요</h2>
          <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-gray-300">
            <li>
              <strong className="text-gold-400">축은 하나뿐입니다.</strong> 단위가 다른 지표를
              겹칠 때 축을 두 개 그리면, 눈금을 조금 옮기는 것만으로 &ldquo;같이 움직였다&rdquo;와
              &ldquo;무관하다&rdquo;를 둘 다 만들 수 있습니다. 그래서 축을 늘리는 대신 척도를
              환산합니다.
            </li>
            <li>
              <strong className="text-gold-400">겹쳐 보인다고 원인은 아닙니다.</strong> 여기서 낼
              수 있는 것은 &ldquo;같은 시기에 같이 움직였다&rdquo;까지입니다.
            </li>
            <li>
              <strong className="text-gold-400">기준일을 함께 보세요.</strong> 갱신 기한을 넘긴
              지표에는 범례에 표시가 붙습니다. 낡은 선이 섞인 그림을 오늘 그림으로 읽으면
              결론이 통째로 옛것이 됩니다.
            </li>
          </ul>
        </Card>

        <TistoryCta
          headline="겹쳐 본 것을 실제 판단에 어떻게 썼는지 블로그에 적었습니다"
          postTitle={basics.featuredTitle}
          postExcerpt={basics.featuredExcerpt}
        />
      </div>
    </>
  );
}

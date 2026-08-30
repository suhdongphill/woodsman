"use client";

/**
 * 사이트 기본값 편집 — 처음 개발할 때 코드에 박아 둔 값을 화면에서 고친다.
 *
 * 빈 칸으로 두면 코드의 기본값으로 되돌아간다(실수로 비웠을 때 링크가 죽지 않게).
 */
import { useActionState } from "react";
import { saveSiteBasicsAction } from "../actions";
import { emptySiteFormState } from "../form-state";
import type { SiteBasics } from "@/lib/site-basics";

const field =
  "w-full bg-bg border border-border rounded-xl px-3 py-2 text-[13px] text-ink placeholder:text-gray-600";
const label = "block text-[11px] text-muted mb-1";
const hint = "mt-1 text-[11px] text-gray-600 leading-relaxed";

export function SiteBasicsForm({ basics }: { basics: SiteBasics }) {
  const [state, formAction, pending] = useActionState(saveSiteBasicsAction, emptySiteFormState);

  return (
    <form action={formAction} className="space-y-7">
      <section>
        <h3 className="mb-3 text-sm font-semibold text-ink">계좌 성격</h3>
        <div className="space-y-2">
          {(
            [
              {
                value: "PAPER",
                title: "모의 투자 (시뮬레이션)",
                desc: "매매와 납입은 가상, 종목 시세는 실제 시장가격. 원칙대로 목표 비중을 채워 가는 과정을 보여줍니다.",
              },
              {
                value: "LIVE",
                title: "실계좌",
                desc: "실제 자금으로 운용한 기록. 매매·납입·평가액 모두 실제일 때만 고릅니다.",
              },
            ] as const
          ).map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-bg px-3.5 py-3 transition-colors hover:border-gold-600/40"
            >
              <input
                type="radio"
                name="dataMode"
                value={option.value}
                defaultChecked={basics.dataMode === option.value}
                className="mt-0.5 h-4 w-4 accent-gold-500"
              />
              <span className="min-w-0">
                <span className="block text-[13px] text-ink">{option.title}</span>
                <span className="mt-0.5 block text-[11.5px] leading-relaxed text-muted">
                  {option.desc}
                </span>
              </span>
            </label>
          ))}
        </div>
        <p className={hint}>
          계좌 숫자가 나오는 모든 화면(홈·포트폴리오·투자일지)에 이 표시가 함께 나갑니다.
        </p>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-ink">기준 환율</h3>
        <label className="block max-w-[220px]">
          <span className={label}>1달러 = ? 원</span>
          <input
            name="usdKrwRate"
            type="number"
            step="1"
            min="1"
            defaultValue={basics.usdKrwRate}
            className={`${field} text-right tabular-nums`}
          />
        </label>
        <p className={hint}>
          달러 종목과 원화 종목을 한 축에서 비교하려면 필요합니다. 실시간 시세가 아니라 운영자가
          정하는 기준값이고, 포트폴리오 화면에 그렇게 밝혀 둡니다.
        </p>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-ink">홈 문구</h3>
        <div className="space-y-3">
          <label className="block">
            <span className={label}>제목</span>
            <input name="heroTitle" defaultValue={basics.heroTitle} className={field} />
          </label>
          <label className="block">
            <span className={label}>부제</span>
            <textarea
              name="heroSubtitle"
              rows={2}
              defaultValue={basics.heroSubtitle}
              className={field}
            />
          </label>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-ink">티스토리 대표 글</h3>
        <p className={`${hint} mb-3 mt-0`}>
          홈·본문 끝의 블로그 카드에 <strong className="text-gray-400">주소 대신 이 제목과 요약</strong>이
          나옵니다. 주소만 보이면 무슨 글인지 알 수 없어 누를 이유가 없습니다.
        </p>
        <div className="space-y-3">
          <label className="block">
            <span className={label}>글 제목</span>
            <input name="featuredTitle" defaultValue={basics.featuredTitle} className={field} />
          </label>
          <label className="block">
            <span className={label}>요약 (2줄까지 표시)</span>
            <textarea
              name="featuredExcerpt"
              rows={2}
              defaultValue={basics.featuredExcerpt}
              className={field}
            />
          </label>
          <label className="block">
            <span className={label}>글 주소</span>
            <input
              name="tistoryFeaturedUrl"
              defaultValue={basics.tistoryFeaturedUrl}
              className={field}
            />
          </label>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-ink">연락처 · 블로그</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className={label}>문의 메일</span>
            <input name="contactEmail" defaultValue={basics.contactEmail} className={field} />
          </label>
          <label className="block">
            <span className={label}>블로그 대문</span>
            <input name="tistoryBlogUrl" defaultValue={basics.tistoryBlogUrl} className={field} />
          </label>
          <label className="block">
            <span className={label}>RSS 주소</span>
            <input name="tistoryRssUrl" defaultValue={basics.tistoryRssUrl} className={field} />
          </label>
        </div>
        <p className={hint}>
          문의 메일은 소개·개인정보·투자 책임 고지 페이지와 푸터에 함께 반영됩니다.
        </p>
      </section>

      <div className="flex items-center justify-end gap-3 border-t border-border/70 pt-4">
        {state.error && (
          <span role="alert" className="text-[12px] text-red-400">
            {state.error}
          </span>
        )}
        {state.savedAt && !state.error && (
          <span className="text-[12px] text-emerald-400">저장했습니다</span>
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-gold-600/90 px-5 py-2 text-[13px] font-medium text-onAccent transition-colors hover:bg-gold-600 disabled:opacity-50"
        >
          {pending ? "저장 중…" : "기본값 저장"}
        </button>
      </div>
    </form>
  );
}

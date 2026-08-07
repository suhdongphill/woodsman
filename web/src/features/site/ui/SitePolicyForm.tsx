"use client";

/**
 * 사이트 개방 · 댓글 정책 스위치.
 *
 * 전에는 이 토글들이 화면에서만 움직이는 목업이었다. 켜도 저장되지 않아
 * **관리자가 "커뮤니티를 열었다"고 잘못 믿는** 것이 실제 피해였다.
 *
 * 스위치 다섯 개와 금지어를 **한 폼 한 번에** 저장한다. 토글마다 즉시 저장하면
 * 가입만 켜지고 커뮤니티는 안 켜진 어중간한 상태가 화면 조작 중에 생긴다.
 */
import { useActionState } from "react";
import { saveSiteFlagsAction } from "../actions";
import { emptySiteFormState } from "../form-state";
import { Card, CardTitle } from "@/components/ui/Card";
import { Toggle } from "@/components/ui/Toggle";
import type { SiteFlags } from "@/lib/site-policy";

export function SitePolicyForm({ flags }: { flags: SiteFlags }) {
  const [state, formAction, pending] = useActionState(saveSiteFlagsAction, emptySiteFormState);

  return (
    <form action={formAction}>
      <Card className="mb-5 border-gold-600/30">
        <CardTitle>사이트 개방</CardTitle>
        <p className="mb-3 text-[12px] leading-relaxed text-muted">
          지금 Woodsman은 <strong className="text-gray-300">운영자 1인 콘텐츠 사이트</strong>로
          동작합니다. 회원가입·게시판·댓글 기능은 지워진 게 아니라 아래 스위치로 잠겨 있으며,
          켜는 즉시 준비된 화면이 그대로 살아납니다.
        </p>
        <div className="divide-y divide-border">
          <Toggle
            name="signupEnabled"
            label="공개 회원가입 받기"
            description="끄면 /register가 '가입 미지원' 안내로 바뀌고 상단 로그인·회원가입 링크가 사라집니다. 관리자는 로고를 더블클릭해 로그인합니다."
            defaultOn={flags.signupEnabled}
          />
          <Toggle
            name="communityEnabled"
            label="커뮤니티(게시판) 열기"
            description="끄면 /board가 404로 응답하고 메뉴에서 사라집니다. 댓글도 함께 닫힙니다."
            defaultOn={flags.communityEnabled}
          />
        </div>
        <p className="mt-3 border-t border-border/70 pt-3 text-[11px] leading-relaxed text-gray-500">
          ⚠ 가입을 열기 전에 <strong className="text-gray-400">개인정보 처리방침</strong>의 수집
          항목·목적·보유기간을 먼저 갱신하세요. 현재 방침에는 &ldquo;회원정보를 수집하지
          않는다&rdquo;고 명시돼 있습니다.
        </p>
      </Card>

      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardTitle>댓글 전역 설정</CardTitle>
          <div className="divide-y divide-border">
            <Toggle
              name="commentsGloballyEnabled"
              label="사이트 전체 댓글 사용"
              description="끄면 모든 글에서 댓글 작성 폼이 사라집니다."
              defaultOn={flags.commentsGloballyEnabled}
            />
            <Toggle
              name="requireLoginToComment"
              label="댓글 작성 시 로그인 필요"
              description="비로그인 사용자는 열람만 가능합니다."
              defaultOn={flags.requireLoginToComment}
            />
            <Toggle
              name="moderationOn"
              label="승인제(모더레이션)"
              description="켜면 새 댓글이 승인대기 상태로 저장되고, 승인해야 노출됩니다."
              defaultOn={flags.moderationOn}
            />
          </div>
        </Card>

        <Card>
          <CardTitle>금지어 필터</CardTitle>
          <p className="mb-3 text-[12px] text-muted">
            쉼표로 구분해 입력합니다. 포함된 댓글은 자동으로 숨김 처리됩니다.
          </p>
          <textarea
            name="bannedWords"
            rows={4}
            defaultValue={flags.bannedWords}
            className="w-full resize-none rounded-xl border border-border bg-[#12141c] px-3.5 py-3 text-sm text-white focus:border-emerald-500 focus:outline-none"
          />
          <p className="mt-2 text-[11px] leading-relaxed text-gray-600">
            ⚠ 승인제를 꺼도 금지어는 계속 걸립니다. 대소문자는 구분하지 않습니다.
          </p>
        </Card>
      </div>

      <div className="mb-7 flex items-center justify-end gap-3">
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
          className="rounded-xl bg-gold-600/90 px-5 py-2 text-[13px] font-medium text-black transition-colors hover:bg-gold-600 disabled:opacity-50"
        >
          {pending ? "저장 중…" : "정책 저장"}
        </button>
      </div>
    </form>
  );
}

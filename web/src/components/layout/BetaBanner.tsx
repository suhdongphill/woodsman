import Link from "next/link";
import { AlertIcon } from "@/components/icons";
import { BETA_NOTICE, isBeta } from "@/lib/site-status";

/**
 * 베타 고지 바.
 *
 * 헤더 위에 얇게 깔아 어느 화면에서 들어와도 "개발 중"이라는 사실이 먼저 보이게 한다.
 * 닫기 버튼을 두지 않은 건 의도다 — 수치와 기능이 계속 바뀌는 동안에는
 * 방문자가 한 번 닫고 잊는 것보다 계속 보이는 편이 정직하다.
 * 단계가 끝나면 `SITE_STAGE`를 "OPEN"으로 바꾸는 것만으로 사라진다.
 */
export function BetaBanner() {
  if (!isBeta) return null;

  return (
    <div className="border-b border-gold-600/25 bg-gold-500/[0.07]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-2.5 gap-y-1 px-4 py-2 sm:px-6">
        <span className="inline-flex items-center gap-1.5 rounded-md border border-gold-600/40 bg-gold-500/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-gold-400">
          <AlertIcon size={11} />
          {BETA_NOTICE.badge}
        </span>
        <p className="text-[11.5px] leading-relaxed text-muted">
          <span className="text-gray-300">{BETA_NOTICE.short}.</span> {BETA_NOTICE.long}{" "}
          <Link href="/about" className="text-gold-400 underline-offset-2 hover:underline">
            발전 방향 보기
          </Link>
        </p>
      </div>
    </div>
  );
}

import { enabledSocialProviders, type SocialProviderId } from "@/lib/auth-providers";
import { socialLoginAction } from "../actions";

/**
 * env에 ID/SECRET이 모두 있는 소셜만 렌더한다.
 * 키가 없으면 프로바이더 자체가 등록되지 않으므로, 눌러도 실패하는 버튼을 남기지 않는다.
 */
const STYLES: Record<SocialProviderId, string> = {
  google: "bg-white text-[#1f1f1f] hover:bg-gray-100",
  kakao: "bg-[#FEE500] text-[#191600] hover:brightness-95",
};

export function SocialButtons({ next }: { next: string }) {
  const providers = enabledSocialProviders();
  if (providers.length === 0) return null;

  return (
    <>
      <div className="flex items-center gap-3 my-5">
        <span className="h-px flex-1 bg-border" />
        <span className="text-[11px] text-gray-600">또는</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <div className="space-y-2.5">
        {providers.map((p) => (
          <form key={p.id} action={socialLoginAction}>
            <input type="hidden" name="provider" value={p.id} />
            <input type="hidden" name="next" value={next} />
            <button
              type="submit"
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${STYLES[p.id]}`}
            >
              {p.label}
            </button>
          </form>
        ))}
      </div>
    </>
  );
}

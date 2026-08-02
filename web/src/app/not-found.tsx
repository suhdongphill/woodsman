import { LinkButton } from "@/components/ui/Button";
import { LogoMark } from "@/components/brand/Logo";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <LogoMark size={48} />
      <p className="mt-6 text-3xl font-bold text-white">404</p>
      <p className="mt-2 text-sm text-muted">요청하신 페이지를 찾을 수 없습니다.</p>
      <LinkButton href="/" variant="gold" className="mt-6">
        홈으로 돌아가기
      </LinkButton>
    </div>
  );
}

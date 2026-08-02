/**
 * 키 등록 안내 + (로컬에서만) 등록 폼.
 *
 * 요구사항은 "내가 등록한 것을 프로그램이 .env에 저장해서 매번 다시 입력하지 않게"였다.
 * 그래서 **로컬 개발 서버에서는 화면에서 입력받아 프로그램이 `.env`에 써 준다.**
 *
 * ⚠ 배포본에서는 이 폼이 뜨지 않는다. Workers에는 파일 시스템이 없어
 * `.env`라는 파일이 존재할 수 없다. 배포본 반영은 `npm run ai:sync`가 담당한다.
 * (기술적 제약이지 정책이 아니다 — 그래서 화면에도 그 이유를 그대로 적어 둔다.)
 */
import { Card, CardTitle } from "@/components/ui/Card";
import { AI_PROVIDERS } from "@/lib/ai/catalog";
import { KeyRegisterForm } from "./KeyRegisterForm";

export function KeySetupGuide({
  missing,
  connected,
  canWriteEnv,
}: {
  missing: string[];
  connected: string[];
  /** 이 실행 환경이 `.env`를 쓸 수 있는가(= 로컬 개발 서버인가) */
  canWriteEnv: boolean;
}) {
  return (
    <Card>
      <CardTitle>키 등록</CardTitle>

      {canWriteEnv ? (
        <>
          <p className="mb-4 text-[12.5px] leading-relaxed text-gray-300">
            여기에 붙여넣으면 <code className="text-gray-400">web/.env</code> 파일에 프로그램이
            직접 기록합니다. 파일을 손으로 열 필요가 없고, 한 번 넣으면 다시 입력하지 않습니다.
          </p>
          <KeyRegisterForm connected={connected} />

          <div className="mt-5 border-t border-border/70 pt-4">
            <p className="text-[12.5px] text-white">배포된 사이트에도 반영하려면</p>
            <pre className="mt-2 rounded-xl border border-border bg-[#12141c] px-3 py-2.5 text-[11px] text-emerald-400">
              npm run ai:sync
            </pre>
            <p className="mt-1 text-[11.5px] text-muted">
              `.env`에 값이 있는 키만 Cloudflare 시크릿으로 올립니다. 이 단계를 자동으로 돌리지
              않는 이유는, 실수로 넣은 키가 곧바로 운영에 올라가지 않게 하기 위해서입니다.
            </p>
          </div>
        </>
      ) : (
        <>
          <p className="mb-3 text-[12.5px] leading-relaxed text-gray-300">
            <span className="text-white">배포된 사이트에서는 키를 입력받지 않습니다.</span>{" "}
            Cloudflare Workers에는 파일 시스템이 없어 <code>.env</code> 파일이 존재할 수 없기
            때문입니다. 내 PC에서 등록한 뒤 명령 하나로 올립니다.
          </p>
          <ol className="space-y-2 text-[12.5px] leading-relaxed text-gray-300">
            <li>
              1. 내 PC에서{" "}
              <code className="text-gray-400">cd web &amp;&amp; npm run dev</code> 로 띄운다
            </li>
            <li>
              2. <code className="text-gray-400">localhost:3000/admin/ai</code> 에서 키를 입력한다
              (프로그램이 <code>.env</code>에 기록)
            </li>
            <li>
              3. <code className="text-emerald-400">npm run ai:sync</code> 로 이 사이트에 올린다
            </li>
          </ol>
        </>
      )}

      <div className="mt-5 border-t border-border/70 pt-4">
        <p className="text-[11.5px] text-muted">
          아직 비어 있는 키:{" "}
          {missing.length === 0 ? (
            <span className="text-emerald-400">없음 — 전부 등록됨</span>
          ) : (
            <code className="text-gray-400">{missing.join(", ")}</code>
          )}
        </p>
        <p className="mt-1 text-[11.5px] text-muted">
          발급 페이지 링크는 위 표의 제공자마다 붙어 있습니다. 무료(
          {AI_PROVIDERS.filter((p) => p.free).length}곳)부터 등록하면 유료 호출이 줄어듭니다.
        </p>
      </div>

      <p className="mt-4 border-t border-border/70 pt-3 text-[11px] leading-relaxed text-gray-600">
        ⚠ 등록한 키는 화면에 다시 표시되지 않고, <span className="text-gray-500">DB에도
        저장하지 않습니다</span>. 저장소는 `.env`와 Cloudflare 시크릿뿐입니다. 모든 AI 호출은
        서버를 거치므로 브라우저로 키가 내려가지 않습니다.
      </p>
    </Card>
  );
}

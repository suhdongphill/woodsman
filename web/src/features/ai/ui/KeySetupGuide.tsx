/**
 * 키 등록 절차 안내.
 *
 * 요구사항은 "한 번 등록하면 매번 다시 입력하지 않게"였다.
 * 그 답은 화면에 입력칸을 두는 게 아니라 **.env에 한 번 적고 스크립트로 밀어 넣는 것**이다.
 * 화면 입력칸을 두면 키가 DB·로그·폼 상태를 타고 돌아다닌다.
 */
import { Card, CardTitle } from "@/components/ui/Card";
import { AI_PROVIDERS } from "@/lib/ai/catalog";

export function KeySetupGuide({ missing }: { missing: string[] }) {
  return (
    <Card>
      <CardTitle>키를 등록하는 방법 (한 번만)</CardTitle>

      <ol className="space-y-3 text-[12.5px] text-gray-300 leading-relaxed">
        <li>
          <span className="text-white">1. 로컬 `.env`에 적는다.</span>
          <p className="mt-1 text-[11.5px] text-muted">
            아래 목록에서 발급받은 것만 채우면 됩니다. 없는 줄은 지워도 됩니다.
          </p>
          <pre className="mt-2 overflow-x-auto rounded-xl border border-border bg-[#12141c] px-3 py-2.5 text-[11px] leading-relaxed text-gray-400">
            {AI_PROVIDERS.map((p) => `${p.apiKeyEnv}=`).join("\n")}
          </pre>
        </li>
        <li>
          <span className="text-white">2. 서버로 밀어 넣는다.</span>
          <pre className="mt-2 rounded-xl border border-border bg-[#12141c] px-3 py-2.5 text-[11px] text-emerald-400">
            npm run ai:sync
          </pre>
          <p className="mt-1 text-[11.5px] text-muted">
            `.env`에 값이 있는 키만 Cloudflare 시크릿으로 올립니다. 다음부터는 이 단계만 다시
            돌리면 되고, 화면에서 재입력할 일은 없습니다.
          </p>
        </li>
        <li>
          <span className="text-white">3. 이 화면에서 &ldquo;연결됨&rdquo;을 확인한다.</span>
          <p className="mt-1 text-[11.5px] text-muted">
            배포 후에도 &ldquo;미설정&rdquo;이면 시크릿이 올라가지 않은 것입니다.
          </p>
        </li>
      </ol>

      {missing.length > 0 && (
        <p className="mt-4 border-t border-border/70 pt-3 text-[11.5px] text-muted">
          아직 비어 있는 키: <code className="text-gray-400">{missing.join(", ")}</code>
        </p>
      )}

      <p className="mt-4 border-t border-border/70 pt-3 text-[11px] leading-relaxed text-gray-600">
        ⚠ 키 값은 이 화면 어디에도 표시되지 않고, DB에도 저장하지 않습니다. 모든 AI 호출은 서버
        라우트를 거치므로 브라우저로 키가 내려가지 않습니다.
      </p>
    </Card>
  );
}

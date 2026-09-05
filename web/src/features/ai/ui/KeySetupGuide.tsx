/**
 * 키 등록 — 화면에서 넣고, 어디에 들어갔는지 보여준다.
 *
 * ## 2026-09-05에 바뀐 것
 * 전에는 로컬 개발 서버에서만 입력받아 `.env`에 썼다(Workers에 파일 시스템이 없어서).
 * 이제 **암호화해서 DB에 넣는다** — 배포된 화면에서도 등록된다.
 *
 * ⚠ 이 화면은 키 값을 절대 보여주지 않는다. 보여주는 것은
 *   **어디에 저장됐는지(DB/env) · 언제 · 누가 · 암호문 지문**까지다.
 * ⚠ **마스터 키의 출처를 그대로 밝힌다.** `AUTH_SECRET`에서 파생 중이라면 그렇게 적는다 —
 *   세션 키를 바꾸면 저장된 키를 못 풀게 되기 때문이다. 조용한 폴백을 만들지 않는다.
 */
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { seoulDay } from "@/lib/kst";
import type { CredentialStatus } from "../credentials";
import { KeyRegisterForm } from "./KeyRegisterForm";
import { deleteAiKeyAction } from "../actions";

export function KeySetupGuide({
  statuses,
  master,
}: {
  statuses: CredentialStatus[];
  master: { ok: true; source: string } | { ok: false; reason: string };
}) {
  const stored = statuses.filter((s) => s.source === "DB");
  const fromEnv = statuses.filter((s) => s.source === "ENV");
  const missing = statuses.filter((s) => s.source === "NONE");

  return (
    <Card>
      <CardTitle>키 등록</CardTitle>

      {master.ok ? (
        <p className="mb-4 text-[12.5px] leading-relaxed text-gray-300">
          여기에 붙여넣으면 <strong className="text-ink">암호화해서 저장</strong>합니다(AES-GCM
          256). 암호를 푸는 마스터 키는 데이터베이스 안에 없고, 값은 제공자를 부르는 자리에서만
          풀립니다.
          {master.source === "AUTH_SECRET" && (
            <>
              {" "}
              <span className="text-gold-500">
                ⚠ 지금은 마스터 키로 <code>AUTH_SECRET</code>을 쓰고 있습니다 — 세션 키를 바꾸면
                저장된 키를 다시 넣어야 합니다. <code>KEY_ENCRYPTION_KEY</code>를 따로 등록하면
                그 걱정이 없어집니다.
              </span>
            </>
          )}
        </p>
      ) : (
        <p role="alert" className="mb-4 text-[12.5px] leading-relaxed text-red-400">
          ⚠ {master.reason}. 마스터 키가 없으면 <strong>저장하지 않습니다</strong> — 평문으로
          떨어지는 길을 만들지 않기 위해서입니다.
        </p>
      )}

      <KeyRegisterForm stored={stored.map((s) => s.name)} />

      {stored.length > 0 && (
        <div className="mt-5 border-t border-border/70 pt-4">
          <p className="mb-2 text-[12.5px] text-ink">저장된 키</p>
          <ul className="space-y-1.5">
            {stored.map((s) => (
              <li key={s.name} className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <code className="text-[12px] text-gray-300">{s.name}</code>
                <Badge tone="neutral">DB</Badge>
                <span className="text-[11px] text-ink-3">
                  {s.updatedAt ? seoulDay(s.updatedAt) : ""} · {s.updatedBy ?? ""} · 지문{" "}
                  <code>{s.fingerprint}</code>
                </span>
                <form action={deleteAiKeyAction} className="ml-auto">
                  <input type="hidden" name="apiKeyEnv" value={s.name} />
                  <button
                    type="submit"
                    className="rounded-lg border border-border px-2.5 py-1 text-[11.5px] text-muted transition-colors hover:border-danger/40 hover:text-danger"
                  >
                    지우기
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 border-t border-border/70 pt-4">
        {fromEnv.length > 0 && (
          <p className="text-[11.5px] text-muted">
            서버 시크릿(env)에서 오는 키:{" "}
            <code className="text-gray-400">{fromEnv.map((s) => s.name).join(", ")}</code> — DB에
            같은 이름을 저장하면 <strong className="text-gray-300">그쪽이 우선</strong>합니다.
          </p>
        )}
        <p className="mt-1 text-[11.5px] text-muted">
          아직 비어 있는 키:{" "}
          {missing.length === 0 ? (
            <span className="text-emerald-400">없음 — 전부 등록됨</span>
          ) : (
            <code className="text-gray-400">{missing.map((s) => s.name).join(", ")}</code>
          )}
        </p>
      </div>

      <p className="mt-4 border-t border-border/70 pt-3 text-[11px] leading-relaxed text-gray-600">
        ⚠ 등록한 키는 화면에 다시 표시되지 않습니다. DB에는 <span className="text-gray-500">
        암호문만</span> 들어가고, 모든 호출은 서버를 거치므로 브라우저로 키가 내려가지 않습니다.
        ⚠ 다만 서버 자체를 장악당하면 서버가 풀 수 있는 것은 공격자도 풉니다 — 이 저장고가 막는
        것은 <span className="text-gray-500">데이터베이스 유출</span>입니다.
      </p>
    </Card>
  );
}

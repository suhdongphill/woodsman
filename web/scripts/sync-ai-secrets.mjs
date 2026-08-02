/**
 * .env의 AI API 키를 Cloudflare Workers 시크릿으로 밀어 넣는다.
 *
 *   npm run ai:sync
 *
 * ## 왜 화면 입력칸이 아니라 이 방식인가
 * "한 번 등록하면 매번 다시 입력하지 않게 해 달라"는 요구의 답이다.
 * 키를 관리자 화면에서 받으면 폼 값 → 서버 액션 → DB를 타고 다니면서
 * 로그·에러 리포트·백업에 남는다. 이 저장소는 공개라 한 번 새면 되돌릴 수 없다.
 * 그래서 키가 사는 곳은 딱 두 군데다: 로컬 `.env`(git 무시)와 Cloudflare 시크릿 저장소.
 *
 * ## 안전장치
 * - 키 '값'을 출력하지 않는다. 화면에는 변수명과 길이만 찍는다.
 * - `.env`에 비어 있는 키는 건드리지 않는다(서버에 이미 있는 값을 지우지 않기 위해).
 * - 목록은 `src/lib/ai/catalog.ts`에서 가져온다 — 여기에 다시 적지 않는다.
 */
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AI_PROVIDERS } from "../src/lib/ai/catalog.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const ok = (msg) => console.log(`  ✓ ${msg}`);
const skip = (msg) => console.log(`  · ${msg}`);

/** 값이 로그에 찍히지 않도록 stdin으로 넘긴다(명령줄 인자는 프로세스 목록에 노출된다). */
function putSecret(name, value) {
  execFileSync("npx", ["wrangler", "secret", "put", name], {
    cwd: ROOT,
    input: value,
    stdio: ["pipe", "inherit", "inherit"],
    shell: process.platform === "win32",
  });
}

console.log("\nAI API 키를 Cloudflare 시크릿으로 동기화합니다.");
console.log("(.env에 값이 있는 것만 올립니다. 키 값은 출력되지 않습니다.)\n");

let uploaded = 0;
const missing = [];

for (const provider of AI_PROVIDERS) {
  const name = provider.apiKeyEnv;
  const value = (process.env[name] ?? "").trim();

  if (!value) {
    missing.push(name);
    skip(`${name} — .env에 값이 없어 건너뜁니다 (${provider.label})`);
    continue;
  }

  try {
    putSecret(name, value);
    ok(`${name} 업로드 (${provider.label}, ${value.length}자)`);
    uploaded += 1;
  } catch (error) {
    // ⚠ 조용히 넘어가지 않는다. 하나라도 실패하면 그 제공자는 배포본에서 "미설정"이 된다.
    console.error(`  ✗ ${name} 업로드 실패 — ${error.message}`);
    process.exitCode = 1;
  }
}

console.log(`\n완료: ${uploaded}개 업로드, ${missing.length}개 미설정`);
if (missing.length) {
  console.log(`미설정 키: ${missing.join(", ")}`);
  console.log("발급 페이지는 /admin/ai 화면 하단에 링크가 있습니다.");
}
console.log("\n확인: /admin/ai 에서 '연결됨' 뱃지를 보세요.\n");

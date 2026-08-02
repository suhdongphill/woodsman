/**
 * Cloudflare 최초 설정 — D1 생성부터 첫 배포까지 한 번에.
 *
 *   npx wrangler login          ← 이건 브라우저 인증이라 사람이 먼저 해야 한다
 *   npm run cf:setup            ← 그 다음 이 스크립트
 *
 * 하는 일
 *   1. D1 데이터베이스 생성 (이미 있으면 그대로 씀)
 *   2. 받은 database_id를 wrangler.jsonc에 써넣음
 *   3. 마이그레이션 적용
 *   4. 시드 SQL 생성·적용 (관리자 계정 포함)
 *   5. Workers에 배포
 *
 * 여러 번 실행해도 안전하다 — 각 단계가 이미 끝났으면 건너뛴다.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WRANGLER_CONFIG = join(ROOT, "wrangler.jsonc");
const DB_NAME = "woodsman-db";
const PLACEHOLDER = "REPLACE_WITH_D1_DATABASE_ID";

const step = (n, msg) => console.log(`\n[${n}/5] ${msg}`);
const ok = (msg) => console.log(`  ✓ ${msg}`);
const warn = (msg) => console.log(`  ! ${msg}`);

function run(args, { capture = false, allowFail = false } = {}) {
  try {
    const out = execFileSync("npx", ["wrangler", ...args], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
      shell: process.platform === "win32",
    });
    return out ?? "";
  } catch (error) {
    if (allowFail) return String(error.stdout ?? "") + String(error.stderr ?? "");
    console.error("\n실패한 명령: wrangler " + args.join(" "));
    if (error.stdout) console.error(String(error.stdout));
    if (error.stderr) console.error(String(error.stderr));
    process.exit(1);
  }
}

// ── 0. 인증 확인 ──
const who = run(["whoami"], { capture: true, allowFail: true });
if (/not authenticated/i.test(who)) {
  console.error("\nCloudflare 인증이 필요합니다. 먼저 아래를 실행하세요:\n");
  console.error("    npx wrangler login\n");
  console.error("(브라우저 대시보드 로그인과 별개입니다 — CLI가 자기 인증을 받아야 합니다.)");
  process.exit(1);
}

// ── 1. D1 생성 ──
step(1, `D1 데이터베이스 '${DB_NAME}' 준비`);
let databaseId = null;

const listOut = run(["d1", "list", "--json"], { capture: true, allowFail: true });
try {
  const existing = JSON.parse(listOut.slice(listOut.indexOf("["))).find((d) => d.name === DB_NAME);
  if (existing) {
    databaseId = existing.uuid ?? existing.database_id ?? null;
    ok(`이미 있습니다 (${databaseId})`);
  }
} catch {
  // 목록 파싱 실패는 무시하고 생성 시도로 넘어간다
}

if (!databaseId) {
  const created = run(["d1", "create", DB_NAME], { capture: true, allowFail: true });
  const match = created.match(/"database_id"\s*:\s*"([0-9a-f-]{36})"/i) ?? created.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  if (!match) {
    console.error("\nD1 생성 결과에서 database_id를 찾지 못했습니다. 출력:\n" + created);
    process.exit(1);
  }
  databaseId = match[1];
  ok(`생성했습니다 (${databaseId})`);
}

// ── 2. wrangler.jsonc 반영 ──
step(2, "wrangler.jsonc에 database_id 반영");
const config = readFileSync(WRANGLER_CONFIG, "utf8");
if (config.includes(PLACEHOLDER)) {
  writeFileSync(WRANGLER_CONFIG, config.replace(PLACEHOLDER, databaseId), "utf8");
  ok("자리표시자를 실제 ID로 교체했습니다");
} else if (config.includes(databaseId)) {
  ok("이미 반영돼 있습니다");
} else {
  warn("다른 ID가 적혀 있습니다. 직접 확인하세요.");
}

// ── 3. 마이그레이션 ──
step(3, "D1 마이그레이션 적용");
run(["d1", "migrations", "apply", DB_NAME, "--remote"]);
ok("스키마 적용 완료");

// ── 4. 시드 ──
step(4, "시드 데이터 적용 (관리자 계정 포함)");
const seedSql = join(ROOT, "prisma", "seed.d1.sql");
if (!existsSync(seedSql)) {
  console.error("\nprisma/seed.d1.sql이 없습니다. 먼저 실행하세요:  npm run d1:seed:generate");
  process.exit(1);
}
run(["d1", "execute", DB_NAME, "--remote", "--file=./prisma/seed.d1.sql", "-y"]);
ok("시드 완료");

// ── 5. 배포 ──
step(5, "Workers 배포");
console.log("  (OpenNext 변환 후 업로드 — 몇 분 걸립니다)");
execFileSync("npm", ["run", "cf:deploy"], {
  cwd: ROOT,
  stdio: "inherit",
  shell: process.platform === "win32",
});

console.log(`
──────────────────────────────────────────────
설정 완료. 남은 일은 대시보드에서 해야 합니다.

1) 시크릿 입력
   Workers & Pages → woodsman → Settings → Variables and Secrets
     AUTH_SECRET      32자 이상 난수 (없으면 로그인 자체가 안 됩니다)
     ADMIN_EMAIL      관리자 이메일
     ADMIN_PASSWORD   관리자 비밀번호
     AUTH_URL         방금 배포된 workers.dev 주소 (https://...)
   ※ SITE_URL은 지금 비워 둡니다 — 검색 색인을 막아 둔 상태입니다.

1-1) 확인이 끝나고 도메인을 옮길 때
   wrangler.jsonc의 routes 주석을 풀고 다시 배포하거나,
   Settings → Domains & Routes 에서 portfolio-solutions.net 추가.
   그 다음 AUTH_URL·SITE_URL을 https://portfolio-solutions.net 으로 교체하면
   로그인 정상화 + 검색 색인이 열립니다.

2) 자동 배포용 GitHub 시크릿
   github.com/suhdongphill/woodsman → Settings → Secrets and variables → Actions
     CLOUDFLARE_API_TOKEN     대시보드 → API Tokens → "Edit Cloudflare Workers"(D1 Edit 포함)
     CLOUDFLARE_ACCOUNT_ID    Workers 페이지 우측의 Account ID
   이 둘을 넣으면 그때부터 push할 때마다 자동 배포됩니다.

3) 관리자 진입: 사이트에서 Woodsman 로고를 더블클릭
──────────────────────────────────────────────
`);

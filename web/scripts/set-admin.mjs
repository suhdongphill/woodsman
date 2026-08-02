/**
 * 관리자 계정(이메일·비밀번호)을 바꾼다.
 *
 *   npm run admin:set                 ← 물어보고 받는다 (실제 터미널 필요)
 *   npm run admin:apply               ← 묻지 않고 `.env`에 적힌 값을 그대로 적용한다
 *   npm run admin:set -- --remote     ← 운영(Cloudflare D1 + 시크릿)까지
 *
 * `--from-env`(= admin:apply)는 **비대화식**이다. 사람이 `.env`의 ADMIN_EMAIL·ADMIN_PASSWORD를
 * 직접 고친 뒤 이 명령으로 DB에 반영한다. 프롬프트를 띄울 수 없는 환경(스크립트·에이전트)에서
 * 쓰라고 만들었다 — 비밀번호가 명령줄 인자로 노출되지 않는다는 성질은 그대로다.
 *
 * ## 왜 필요했나
 * 최초 시드는 `npm run setup`이 만든 `.env` 값(`admin@woodsman.local` + 자동 생성 비밀번호)을
 * 그대로 썼다. 사람이 정한 적이 없는 계정이라 **나중에 로그인하려고 하면 뭘 넣어야 할지 모른다.**
 * 실제로 그 일이 났다(2026-08-02).
 *
 * 하는 일
 *   1. 새 이메일·비밀번호를 입력받는다 (비밀번호는 화면에 찍히지 않는다)
 *   2. `.env`의 ADMIN_EMAIL·ADMIN_PASSWORD를 갱신한다  ← 다음 시드도 같은 값을 쓴다
 *   3. D1의 관리자 행을 새 이메일·해시로 갱신한다      ← 지금 당장 로그인이 된다
 *   4. --remote면 Cloudflare 시크릿도 같이 올린다
 *
 * ⚠ 비밀번호를 화면·로그·명령줄 인자에 남기지 않는다. 입력은 가려서 받고 해시만 DB에 넣는다.
 * ⚠ role은 물어보지 않는다. 이 스크립트는 **기존 ADMIN 행만** 고친다.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createInterface } from "node:readline";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { hash } from "bcryptjs";
import { upsertEnvLines } from "../src/lib/env-file.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_PATH = join(ROOT, ".env");
const REMOTE = process.argv.includes("--remote");
const FROM_ENV = process.argv.includes("--from-env");

const ok = (msg) => console.log(`  ✓ ${msg}`);
const die = (msg) => {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
};

/** 평범한 한 줄 입력. */
function ask(question, fallback = "") {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim() || fallback);
    });
  });
}

/** 가려서 받는 입력 — 타이핑한 글자가 터미널에 남지 않는다. */
function askSecret(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    // readline이 매 키 입력마다 다시 그리는 것을 가로채 별표조차 남기지 않는다.
    const onWrite = (chunk, encoding, callback) => {
      if (!chunk.toString().includes(question)) return callback();
      return process.stdout.constructor.prototype.write.call(
        process.stdout,
        chunk,
        encoding,
        callback,
      );
    };
    rl.output.write = onWrite;
    process.stdout.write(question);
    rl.question("", (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer.trim());
    });
  });
}

function wrangler(args, { input } = {}) {
  return execFileSync("npx", ["wrangler", ...args], {
    cwd: ROOT,
    encoding: "utf8",
    input,
    stdio: input === undefined ? ["ignore", "pipe", "inherit"] : ["pipe", "inherit", "inherit"],
    shell: process.platform === "win32",
  });
}

// ── 1. 입력 ──
console.log(`\n관리자 계정을 설정합니다 (${REMOTE ? "운영 + 로컬" : "로컬만"}).\n`);

const currentEmail = process.env.ADMIN_EMAIL ?? "";
let email;
let password;

if (FROM_ENV) {
  // `.env`에 사람이 적어 둔 값을 그대로 쓴다. 화면에 비밀번호를 찍지 않는다.
  email = currentEmail;
  password = process.env.ADMIN_PASSWORD ?? "";
  console.log(`  .env의 값을 사용합니다 (이메일: ${email || "없음"}).`);
} else {
  email = await ask(`이메일${currentEmail ? ` [${currentEmail}]` : ""}: `, currentEmail);
  password = await askSecret("새 비밀번호(화면에 표시되지 않음): ");
  const again = await askSecret("한 번 더: ");
  if (password !== again) die("두 입력이 다릅니다.");
}

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) die("이메일 형식이 올바르지 않습니다.");
if (password.length < 8) die("비밀번호는 8자 이상이어야 합니다.");

// ── 2. .env 갱신 ──
if (!existsSync(ENV_PATH)) die(".env 파일이 없습니다. 먼저 `npm run setup`을 실행하세요.");
if (FROM_ENV) {
  ok(".env는 이미 사람이 고쳐 둔 상태 — 건드리지 않습니다");
} else {
  const envText = readFileSync(ENV_PATH, "utf8");
  writeFileSync(
    ENV_PATH,
    upsertEnvLines(envText, { ADMIN_EMAIL: email, ADMIN_PASSWORD: password }),
    "utf8",
  );
  ok(".env의 ADMIN_EMAIL·ADMIN_PASSWORD 갱신");
}

// ── 3. D1의 관리자 행 갱신 ──
const passwordHash = await hash(password, 10);
// 값은 SQL 리터럴로 감싼다. 이메일과 해시 모두 작은따옴표를 이스케이프한다.
const lit = (v) => `'${String(v).replace(/'/g, "''")}'`;
const sql =
  `UPDATE User SET email = ${lit(email)}, passwordHash = ${lit(passwordHash)}, ` +
  `updatedAt = ${lit(new Date().toISOString())} WHERE role = 'ADMIN'`;

wrangler(["d1", "execute", "woodsman-db", "--local", "--command", sql, "-y"]);
ok("로컬 D1의 관리자 계정 갱신");

if (REMOTE) {
  wrangler(["d1", "execute", "woodsman-db", "--remote", "--command", sql, "-y"]);
  ok("운영 D1의 관리자 계정 갱신");

  // 시드를 다시 돌릴 때를 대비해 시크릿도 맞춰 둔다(값은 stdin으로만 넘긴다).
  wrangler(["secret", "put", "ADMIN_EMAIL"], { input: email });
  wrangler(["secret", "put", "ADMIN_PASSWORD"], { input: password });
  ok("Cloudflare 시크릿 갱신");
}

console.log(`\n완료. 이제 ${email} 로 로그인합니다.`);
console.log(REMOTE ? "  운영: https://portfolio-solutions.net/login" : "  로컬: http://localhost:3000/login");
console.log("  (로컬 개발 서버는 .env를 다시 읽도록 재시작하세요.)\n");

#!/usr/bin/env node
/**
 * `npm run setup` — 초보자용 원커맨드 설치.
 *
 *   1) .env 생성 (.env.example 기준, 이미 있으면 빠진 키만 추가)
 *   2) AUTH_SECRET 자동 생성, 관리자 계정 초기값 준비
 *   3) prisma generate
 *   4) 마이그레이션 적용 (최초 1회 init, 이후 deploy)
 *   5) 시드 실행
 *
 * 비밀번호는 .env(서버 전용)에만 저장되며, 새로 생성한 경우에만 콘솔에 1회 안내한다.
 */
import { randomBytes } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_PATH = join(ROOT, ".env");
const ENV_EXAMPLE_PATH = join(ROOT, ".env.example");
const MIGRATIONS_DIR = join(ROOT, "prisma", "migrations");

/** KEY="value" 형태의 아주 단순한 .env 파서 (값에 개행 없음 전제) */
function parseEnv(text) {
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function serializeEnv(values, template) {
  // .env.example의 주석·순서를 유지하면서 값만 채운다
  const seen = new Set();
  const lines = template.split(/\r?\n/).map((raw) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return raw;
    const eq = line.indexOf("=");
    if (eq === -1) return raw;
    const key = line.slice(0, eq).trim();
    seen.add(key);
    return `${key}="${values[key] ?? ""}"`;
  });
  // 템플릿에 없는 추가 키는 끝에 붙인다
  const extra = Object.keys(values).filter((k) => !seen.has(k));
  if (extra.length) {
    lines.push("", "# 추가 설정", ...extra.map((k) => `${k}="${values[k]}"`));
  }
  return lines.join("\n");
}

function randomSecret(bytes = 48) {
  return randomBytes(bytes).toString("base64");
}

function randomPassword() {
  // 사람이 옮겨 적기 쉬운 문자만 사용 (혼동되는 0/O, 1/l 제외)
  const alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const buf = randomBytes(20);
  return Array.from(buf, (b) => alphabet[b % alphabet.length]).join("");
}

/** shell 없이 node로 로컬 CLI를 직접 실행한다(윈도우 .cmd 이슈·인자 이스케이프 문제 회피) */
function run(label, args, env) {
  console.log(`\n$ ${label}`);
  const res = spawnSync(process.execPath, args, {
    cwd: ROOT,
    stdio: "inherit",
    shell: false,
    env: { ...process.env, ...env },
  });
  if (res.status !== 0) {
    console.error(`\n✗ 실패: ${label}`);
    process.exit(res.status ?? 1);
  }
}

const PRISMA_BIN = join(ROOT, "node_modules", "prisma", "build", "index.js");

// ── 1. .env 준비 ────────────────────────────────────────────
const template = readFileSync(ENV_EXAMPLE_PATH, "utf8");
const defaults = parseEnv(template);
const current = existsSync(ENV_PATH) ? parseEnv(readFileSync(ENV_PATH, "utf8")) : {};

const values = { ...defaults, ...current };
const created = [];

if (!values.DATABASE_URL) values.DATABASE_URL = "file:./dev.db";

if (!values.AUTH_SECRET) {
  values.AUTH_SECRET = randomSecret();
  created.push("AUTH_SECRET");
}

if (!values.ADMIN_EMAIL) {
  values.ADMIN_EMAIL = "admin@woodsman.local";
  created.push("ADMIN_EMAIL");
}

let generatedPassword = null;
if (!values.ADMIN_PASSWORD) {
  generatedPassword = randomPassword();
  values.ADMIN_PASSWORD = generatedPassword;
  created.push("ADMIN_PASSWORD");
}

writeFileSync(ENV_PATH, serializeEnv(values, template) + "\n", "utf8");
console.log(
  existsSync(ENV_PATH) && Object.keys(current).length
    ? "✓ .env 갱신 완료"
    : "✓ .env 생성 완료",
);
if (created.length) console.log(`  자동 생성한 값: ${created.join(", ")}`);

// ── 2. Prisma ───────────────────────────────────────────────
const childEnv = { ...values };

run("prisma generate", [PRISMA_BIN, "generate"], childEnv);

const hasMigrations =
  existsSync(MIGRATIONS_DIR) &&
  readdirSync(MIGRATIONS_DIR).some((n) => !n.startsWith("."));

if (hasMigrations) {
  run("prisma migrate deploy", [PRISMA_BIN, "migrate", "deploy"], childEnv);
} else {
  run(
    "prisma migrate dev --name init",
    [PRISMA_BIN, "migrate", "dev", "--name", "init", "--skip-seed"],
    childEnv,
  );
}

// ── 3. 시드 ─────────────────────────────────────────────────
run("prisma db seed", ["--import", "tsx", join(ROOT, "prisma", "seed.ts")], childEnv);

// ── 4. 안내 ─────────────────────────────────────────────────
console.log("\n─────────────────────────────────────────────");
console.log("설치가 끝났습니다. 이제 다음 명령으로 실행하세요:\n");
console.log("  npm run dev      →  http://localhost:3000\n");
if (generatedPassword) {
  console.log("관리자 로그인 정보 (이 메시지는 다시 표시되지 않습니다):");
  console.log(`  이메일   : ${values.ADMIN_EMAIL}`);
  console.log(`  비밀번호 : ${generatedPassword}`);
  console.log("\n  ↳ 값은 .env에 저장되어 있습니다. 바꾸려면 .env의 ADMIN_PASSWORD를");
  console.log("    수정한 뒤 `npm run db:seed`를 다시 실행하세요.");
} else {
  console.log("관리자 계정은 .env의 ADMIN_EMAIL / ADMIN_PASSWORD 값을 사용합니다.");
}
console.log("─────────────────────────────────────────────");

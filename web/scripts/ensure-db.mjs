#!/usr/bin/env node
/**
 * `predev` 훅 — dev 서버를 켜기 전에 최소 준비 상태를 보장한다.
 * .env 또는 로컬 DB가 없으면 setup을 자동 실행하고, 이미 준비됐으면 즉시 통과한다.
 */
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const ready =
  existsSync(join(ROOT, ".env")) &&
  existsSync(join(ROOT, "prisma", "dev.db")) &&
  existsSync(join(ROOT, "src", "generated", "prisma"));

if (ready) process.exit(0);

console.log("첫 실행을 감지했습니다. npm run setup 을 대신 실행합니다...\n");
const res = spawnSync(process.execPath, [join(ROOT, "scripts", "setup.mjs")], {
  cwd: ROOT,
  stdio: "inherit",
  shell: false,
});
process.exit(res.status ?? 1);

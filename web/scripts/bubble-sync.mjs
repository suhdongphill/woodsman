/**
 * 볼트 자동 산출값 → 운영 D1 `BubbleReading` 동기화 (2026-10-26 운영자 「동기화 스크립트도 만들어 주세요」).
 *
 *   npm run bubble:sync              # 계획만 보여준다(쓰지 않는다)
 *   npm run bubble:sync -- --apply   # 운영 D1에 쓴다 + AdminLog 한 줄
 *   npm run bubble:sync -- --vault <볼트 대시보드 HTML 경로>
 *
 * 무엇을 넘기고 무엇을 건너뛰는지는 **순수 함수**가 정한다(`src/lib/bubble/sync.ts` — 테스트 있음).
 * 이 스크립트는 읽고(볼트 HTML · 운영 D1) 쓰는 일만 한다.
 *
 * ⚠ 운영 D1에 쓰는 일이다. `--apply` 없이는 쓰지 않는다. 쓰는 SQL은 `/admin/bubble` 저장(`saveReading`)과 같은 upsert다.
 * ⚠ `--command`만 쓴다(`--file`은 DB를 잠근다 — CLAUDE.md §4). 셸을 거치지 않고 wrangler를 직접 부른다(따옴표가 깨지지 않게).
 * 종료코드: 0 = 정상(쓸 것 없음 포함) · 1 = 실패.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const { planBubbleSync } = await import("../src/lib/bubble/sync.ts");

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const vaultPath = args.includes("--vault")
  ? args[args.indexOf("--vault") + 1]
  : "D:/Woodsman/Investor/_apps/메모리 버블 트리거.html";

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

// 1. 볼트 대시보드의 `bubble-data` JSON 아일랜드
let vault;
try {
  const html = readFileSync(vaultPath, "utf8");
  const m = html.match(/id="bubble-data"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) fail(`bubble-data 아일랜드가 없다: ${vaultPath}`);
  vault = JSON.parse(m[1]).layers.flatMap((l) => l.indicators);
} catch (e) {
  fail(`볼트 대시보드를 읽지 못했다(${vaultPath}): ${e.message}`);
}

// 2. 운영 D1 — 지금 판정
const sql = (s) => (s === undefined || s === null ? "NULL" : `'${String(s).replace(/'/g, "''")}'`);
const require = createRequire(import.meta.url);
const wranglerPkg = require.resolve("wrangler/package.json");
const wranglerBin = join(dirname(wranglerPkg), require(wranglerPkg).bin.wrangler);
function d1(command) {
  const raw = execFileSync(process.execPath, [wranglerBin, "d1", "execute", "woodsman-db", "--remote", "--json", "--command", command], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const at0 = raw.indexOf("[");
  if (at0 < 0) throw new Error(`wrangler가 JSON을 내지 않았다: ${raw.slice(0, 300)}`);
  return JSON.parse(raw.slice(at0));
}

let site;
try {
  site = d1("SELECT indicatorKey, points, value, substr(asOf, 1, 10) AS asOf FROM BubbleReading")[0].results;
} catch (e) {
  fail(`운영 D1을 읽지 못했다: ${e.message}`);
}

// 3. 계획 — 오늘은 서울 날짜
const today = new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);
const plan = planBubbleSync(vault, site, today);
const writes = plan.filter((d) => d.action === "write");

console.log(`볼트 ${vaultPath}`);
console.log(`오늘 ${today} · 쓸 것 ${writes.length} · 건너뜀 ${plan.length - writes.length}\n`);
for (const d of plan) {
  console.log(`${d.action === "write" ? "→ 쓴다 " : "  건너뜀"}  ${d.key.padEnd(20)} ${d.reason}`);
}

if (!apply) {
  console.log("\n(계획만) 쓰려면 --apply");
  process.exit(0);
}
if (writes.length === 0) {
  console.log("\n쓸 것이 없다.");
  process.exit(0);
}

// 4. 쓰기 — 판정 upsert + AdminLog 한 줄
const now = new Date().toISOString();
try {
  for (const w of writes) {
    d1(
      `INSERT INTO BubbleReading (indicatorKey, points, value, asOf, note, updatedAt) VALUES (` +
        [w.key, w.points, w.value, `${w.asOf}T12:00:00.000Z`, w.note, now].map((x) => (typeof x === "number" ? x : sql(x))).join(", ") +
        `) ON CONFLICT(indicatorKey) DO UPDATE SET points = excluded.points, value = excluded.value, asOf = excluded.asOf, note = excluded.note, updatedAt = excluded.updatedAt`,
    );
    console.log(`✓ ${w.key} ${w.points}점 (${w.asOf})`);
  }
  d1(
    `INSERT INTO AdminLog (id, at, actor, action, target, summary) VALUES (` +
      [`al_${now}_bubble_sync`, now, "bubble-sync 스크립트", "bubble.sync", `${writes.length}건`, writes.map((w) => `${w.key}=${w.points}`).join(" · ")]
        .map(sql)
        .join(", ") +
      `)`,
  );
} catch (e) {
  fail(`쓰다가 멈췄다 — 위에 ✓가 찍힌 것까지 들어갔다. upsert라 다시 돌려도 안전하다: ${e.message}`);
}
console.log(`\n✓ ${writes.length}건을 썼다 — /admin/bubble · /macro/bubble에서 보인다.`);

/**
 * 배포 기록(`/admin/releases`)을 운영 D1에 한 줄 넣는다 — `release-log` 스킬이 부른다.
 *
 * ## 왜 있나 (2026-09-26)
 * 「배포할 때마다 `/admin/releases`에 가설과 함께 기록한다」(web/CLAUDE.md §7)는 **사람이 붙이는** 일이었다.
 * 9/19 뒤로 한 건도 붙지 않았다 — 9/20 GCRM 운영 배포부터 9/26 (70)까지. 손으로 하기로 한 일은 결국 안 된다
 * (수동 지표 일곱 개가 비어 있던 것과 같은 모양). 운영자 결정: 「붙이는 것은 스킬에 담아 둬요.」
 *
 * ## 쓰는 법
 *   node scripts/release-log.mjs --id rel_20260926_cofer --at 2026-09-26T13:11:00Z \
 *     --title "…" --kind CONTENT --metric TISTORY_CLICK --commit 6845fd5 --hypothesis "1. … 2. …" [--dry-run]
 *
 * ⚠ 값은 화면 폼(`features/release/actions.ts`)과 **같은 규칙**으로 검사한다 — 종류·지표는 목록에 있는 것만.
 * ⚠ `wrangler d1 execute --command`는 바인딩(?)을 받지 않는다. 그래서 문자열은 작은따옴표를 두 번 써서 넣고,
 *   **셸을 거치지 않고** wrangler를 직접 부른다(따옴표·줄바꿈이 셸에서 깨지지 않게). `--file`은 쓰지 않는다(DB를 잠근다 — CLAUDE.md §4).
 * ⚠ 같은 `id` 또는 같은 커밋이 이미 있으면 넣지 않고 멈춘다 — 두 번 기록되면 효과 창이 겹쳐 보인다.
 */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const KINDS = ["LAYOUT", "COPY", "NAV", "VISUAL", "CONTENT", "FIX"];
const METRICS = ["TISTORY_CLICK", "VIEWS"];

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const dryRun = argv.includes("--dry-run");

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

const input = {
  id: flag("id"),
  at: flag("at"),
  title: flag("title")?.trim(),
  kind: flag("kind"),
  metric: flag("metric") ?? "TISTORY_CLICK",
  commit: flag("commit"),
  hypothesis: flag("hypothesis")?.trim(),
};

if (!input.id || !/^rel_\d{8}_[a-z0-9_]+$/.test(input.id)) fail("--id는 rel_YYYYMMDD_이름 꼴이어야 한다(소문자·숫자·밑줄)");
if (!input.at || Number.isNaN(Date.parse(input.at)) || !/^\d{4}-\d{2}-\d{2}T/.test(input.at)) fail("--at은 ISO 시각이어야 한다(예: 2026-09-26T13:11:00Z)");
if (!input.title || input.title.length < 2) fail("--title — 무엇을 바꿨는지 한 줄");
if (!KINDS.includes(input.kind)) fail(`--kind는 ${KINDS.join("·")} 중 하나`);
if (!METRICS.includes(input.metric)) fail(`--metric은 ${METRICS.join("·")} 중 하나`);
if (input.commit && !/^[0-9a-f]{7,40}$/.test(input.commit)) fail("--commit은 커밋 해시");
// ⚠ 가설은 스킬에서 필수다. 비우면 나중에 결과 해석이 사후 정당화가 된다(스키마 주석).
if (!input.hypothesis) fail("--hypothesis — 배포 전 가설. 비워 두지 않는다");

const at = new Date(input.at).toISOString();
const sql = (s) => (s === undefined || s === null ? "NULL" : `'${String(s).replace(/'/g, "''")}'`);

const require = createRequire(import.meta.url);
// ⚠ wrangler는 `exports`로 내부 경로를 막아 둔다 — package.json 위치에서 `bin`을 따라간다.
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

const dup = d1(
  `SELECT id, at, title FROM SiteRelease WHERE id = ${sql(input.id)}` +
    (input.commit ? ` OR commitHash = ${sql(input.commit)}` : ""),
)[0].results;
if (dup.length > 0) {
  console.error("✗ 이미 기록돼 있다 — 넣지 않았다:");
  for (const d of dup) console.error(`   ${d.id} · ${d.at} · ${d.title}`);
  process.exit(2);
}

const now = new Date().toISOString();
const insert =
  `INSERT INTO SiteRelease (id, at, title, kind, hypothesis, metric, commitHash) VALUES (` +
  [input.id, at, input.title, input.kind, input.hypothesis, input.metric, input.commit].map(sql).join(", ") +
  `); INSERT INTO AdminLog (id, at, actor, action, target, summary) VALUES (` +
  [`al_${now}_release_log`, now, "claude (release-log 스킬)", "release.create", input.id, input.title].map(sql).join(", ") +
  `);`;

console.log(`기록할 것 — ${input.id}`);
console.log(`  시각   ${at}`);
console.log(`  제목   ${input.title}`);
console.log(`  종류   ${input.kind} · 지표 ${input.metric} · 커밋 ${input.commit ?? "—"}`);
console.log(`  가설   ${input.hypothesis}`);
if (dryRun) {
  console.log("\n(--dry-run) 넣지 않았다.");
  process.exit(0);
}

const res = d1(insert);
if (!res.every((r) => r.success)) fail(`넣기 실패: ${JSON.stringify(res).slice(0, 300)}`);
const back = d1(`SELECT id, at, kind, metric FROM SiteRelease WHERE id = ${sql(input.id)}`)[0].results;
if (back.length !== 1) fail("넣었다는 응답은 왔는데 다시 읽으니 없다");
console.log(`\n✓ 기록했다 — /admin/releases 에서 보인다 (${back[0].at})`);

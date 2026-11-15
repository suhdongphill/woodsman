/**
 * 발행된 글의 문구 정정(2026-11-15 · 운영자 요청 「오타는 직접 수정」) — fix-insight-source-labels.ts와 같은 경로.
 * ⚠ 본문(body)만 고치고, bodyHtml은 **글 저장 경로와 같은** 변환·정화로 다시 만든다(직접 쓰지 않는다).
 * ⚠ 바꿀 말은 본문에 **정확히 한 번** 있어야 한다 — 0번이나 여러 번이면 아무것도 쓰지 않는다(엉뚱한 곳을 고치지 않게).
 * ⚠ 운영 D1에는 `--command` 한 줄로만 쓴다(`--file` 금지 — CLAUDE.md §4).
 *
 * 쓰는 법: npx tsx scripts/fix-post-text.ts <slug> "틀린말=>바른말" ["…=>…"] [--apply]
 */
import { execFileSync } from "node:child_process";
import { markdownToHtml } from "../src/lib/markdown";
import { sanitizeHtml } from "../src/lib/sanitize-html";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const [slug, ...pairs] = args.filter((a) => a !== "--apply");
if (!slug || !/^[a-z0-9-]+$/.test(slug)) throw new Error("slug가 필요하다([a-z0-9-])");
const fixes = pairs.map((p) => {
  const [from, to] = p.split("=>");
  if (!from || to === undefined) throw new Error(`「틀린말=>바른말」 꼴이 아니다: ${p}`);
  return { from, to };
});
if (!fixes.length) throw new Error("고칠 말이 없다");

const d1 = (sql: string) =>
  JSON.parse(
    // ⚠ 셸을 거치지 않는다 — Windows 셸이 SQL을 공백에서 쪼갰다
    execFileSync(process.execPath, ["node_modules/wrangler/bin/wrangler.js", "d1", "execute", "woodsman-db", "--remote", "--json", "--command", sql], {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    }),
  );

const rows = d1(`SELECT id, body FROM Post WHERE slug = '${slug}'`)[0].results as { id: string; body: string }[];
if (rows.length !== 1) throw new Error(`글이 ${rows.length}개`);
let body = rows[0].body;
for (const { from, to } of fixes) {
  const n = body.split(from).length - 1;
  if (n !== 1) throw new Error(`「${from}」이 ${n}번 나온다 — 정확히 한 번일 때만 고친다`);
  const at = body.indexOf(from);
  console.log(`「${from}」 → 「${to}」 : …${body.slice(Math.max(0, at - 20), at + from.length + 20).replace(/\n/g, " ")}…`);
  body = body.replace(from, to);
}
const html = sanitizeHtml(markdownToHtml(body));
const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const now = new Date().toISOString();
if (!apply) {
  console.log("(--apply 없이) 쓰지 않았다.");
  process.exit(0);
}
d1(`UPDATE Post SET body = ${q(body)}, bodyHtml = ${q(html)}, updatedAt = ${q(now)} WHERE id = ${q(rows[0].id)}`);
const summary = `글 문구 정정 ${fixes.length}곳: ${fixes.map((f) => `${f.from}→${f.to}`).join(", ")}`;
d1(
  `INSERT INTO AdminLog (id, at, actor, action, target, summary) VALUES (${q(`al_${now}_fixtext`)}, ${q(now)}, ${q(
    "Claude Code (정정 스크립트)",
  )}, 'post.fix-text', ${q(rows[0].id)}, ${q(summary)})`,
);
console.log("적용했다");

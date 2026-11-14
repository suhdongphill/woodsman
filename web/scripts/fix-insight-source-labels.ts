/**
 * 한 번 쓰는 정정 스크립트(2026-11-14) — 발행된 인사이트 「참고한 자료」에 나간 내부 출처 코드(BLS_CPI · FED_SPEECH …)를
 * 한글 이름으로 바꾼다. ⚠ 본문(body)만 고치고, bodyHtml은 **글 저장 경로와 같은** 변환·정화로 다시 만든다(직접 쓰지 않는다).
 * ⚠ 운영 D1에는 `--command` 한 줄로만 쓴다(`--file` 금지 — CLAUDE.md §4).
 *
 * 쓰는 법: npx tsx scripts/fix-insight-source-labels.ts <slug> [--apply]
 */
import { execFileSync } from "node:child_process";
import { markdownToHtml } from "../src/lib/markdown";
import { sanitizeHtml } from "../src/lib/sanitize-html";
import { NEWS_SOURCE_LABEL } from "../src/lib/news/feeds";

const [slug, flag] = process.argv.slice(2);
if (!slug || !/^[a-z0-9-]+$/.test(slug)) throw new Error("slug가 필요하다([a-z0-9-])");
const apply = flag === "--apply";

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
let changed = 0;
for (const [code, label] of Object.entries(NEWS_SOURCE_LABEL)) {
  const re = new RegExp(`· ${code} ·`, "g");
  const n = (body.match(re) ?? []).length;
  if (n) {
    body = body.replace(re, `· ${label} ·`);
    changed += n;
  }
}
console.log(`바꿀 곳 ${changed}개`);
if (!changed) process.exit(0);
const html = sanitizeHtml(markdownToHtml(body));
const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const now = new Date().toISOString();
const sql = `UPDATE Post SET body = ${q(body)}, bodyHtml = ${q(html)}, updatedAt = ${q(now)} WHERE id = ${q(rows[0].id)}`;
if (!apply) {
  console.log("(--apply 없이) 쓰지 않았다. 바뀐 「참고한 자료」:");
  console.log(body.slice(body.indexOf("## 참고한 자료"), body.indexOf("---")));
  process.exit(0);
}
d1(sql);
d1(
  `INSERT INTO AdminLog (id, at, actor, action, target, summary) VALUES (${q(`al_${now}_fixlabels`)}, ${q(now)}, ${q(
    "Claude Code (정정 스크립트)",
  )}, 'post.fix-source-labels', ${q(rows[0].id)}, ${q(`인사이트 「참고한 자료」 내부 출처 코드 ${changed}곳 → 한글 이름`)})`,
);
console.log("적용했다");

/**
 * D1(운영 DB)용 시드 SQL 생성기.
 *
 * 왜 따로 필요한가: `npm run db:seed`는 Prisma로 **파일 SQLite**에 직접 쓴다.
 * D1은 파일이 아니라 원격 서비스라 같은 방식으로 붙을 수 없어서,
 * 같은 시드 데이터(`src/lib/seed-data.ts`)로 SQL을 만들어
 * `wrangler d1 execute`로 밀어 넣는다.
 *
 * 출력 파일에는 **관리자 비밀번호 해시가 들어간다.** 커밋하지 않는다(.gitignore 처리).
 *
 *   node --env-file=.env --import tsx scripts/generate-d1-seed.mjs
 *   npx wrangler d1 execute woodsman-db --remote --file=./prisma/seed.d1.sql
 */
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { hash } from "bcryptjs";
import { parseServerEnv, hasEnvKey } from "../src/lib/env.ts";
import {
  buildAiProviderSeeds,
  seedAccountSnapshots,
  seedAiConfig,
  seedComments,
  seedFeeds,
  seedJournalEntries,
  seedModelHoldings,
  seedPosts,
  seedRebalances,
  seedSiteConfig,
} from "../src/lib/seed-data.ts";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "prisma", "seed.d1.sql");

/** SQL 리터럴로 안전하게 바꾼다. 값은 전부 여기를 거친다. */
function lit(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  if (typeof v === "boolean") return v ? "1" : "0";
  if (v instanceof Date) return `'${v.toISOString()}'`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

/** KST 자정 기준 시각 (seed.ts와 같은 규칙) */
const kst = (date) => new Date(`${date}T00:00:00+09:00`);
const now = new Date("2026-08-02T00:00:00+09:00");

const lines = [];
function upsert(table, row) {
  const cols = Object.keys(row);
  const values = cols.map((c) => lit(row[c]));
  const updates = cols.filter((c) => c !== "id").map((c) => `"${c}" = excluded."${c}"`);
  lines.push(
    `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${values.join(", ")})\n` +
      `  ON CONFLICT("id") DO UPDATE SET ${updates.join(", ")};`,
  );
}

const env = parseServerEnv();
const passwordHash = await hash(env.ADMIN_PASSWORD, 12);

lines.push("-- 자동 생성 파일 — 직접 고치지 말고 scripts/generate-d1-seed.mjs를 고치세요.");
lines.push("-- 여러 번 실행해도 안전합니다(전부 upsert).");
lines.push("");

// ── 관리자 ──
lines.push("-- 관리자 계정 (.env의 ADMIN_EMAIL/ADMIN_PASSWORD 기준)");
lines.push(
  `INSERT INTO "User" ("id","email","name","role","passwordHash","createdAt","updatedAt")\n` +
    `  VALUES (${lit("seed_admin")}, ${lit(env.ADMIN_EMAIL)}, ${lit("관리자")}, ${lit("ADMIN")}, ${lit(passwordHash)}, ${lit(now)}, ${lit(now)})\n` +
    `  ON CONFLICT("email") DO UPDATE SET "passwordHash" = excluded."passwordHash", "role" = excluded."role", "updatedAt" = excluded."updatedAt";`,
);
lines.push("");

// ── 사이트 · AI 설정 ──
lines.push("-- 사이트 설정 (가입·커뮤니티는 닫힌 상태로 시작)");
upsert("SiteConfig", { id: "singleton", ...seedSiteConfig, updatedAt: now });
upsert("AiConfig", { id: "singleton", ...seedAiConfig, tokensUsedThisMonth: 0, updatedAt: now });
lines.push("");

// ── AI 제공자 ──
lines.push("-- AI 제공자 (키가 있는 것만 enabled)");
for (const p of buildAiProviderSeeds((name) => hasEnvKey(name, process.env))) {
  upsert("AiProvider", {
    id: `seed_ai_${p.apiKeyEnv.toLowerCase()}`,
    name: p.name,
    kind: p.kind,
    baseUrl: p.baseUrl ?? null,
    model: p.model,
    apiKeyEnv: p.apiKeyEnv,
    free: p.free,
    enabled: p.enabled,
    priority: p.priority,
    monthlyTokenCap: p.monthlyTokenCap ?? null,
    tokensUsedThisMonth: 0,
    createdAt: now,
    updatedAt: now,
  });
}
lines.push("");

// ── 대표 포트폴리오 ──
lines.push("-- 대표 포트폴리오");
for (const h of seedModelHoldings) {
  const { key, ...rest } = h;
  upsert("ModelHolding", {
    id: `seed_mh_${key.toLowerCase()}`,
    ...rest,
    ticker: rest.ticker ?? null,
    market: rest.market ?? null,
    avgCost: rest.avgCost ?? null,
    shares: rest.shares ?? null,
    canslim: rest.canslim ?? null,
    blogUrl: null,
    published: true,
    createdAt: now,
    updatedAt: now,
  });
}
for (const r of seedRebalances) {
  upsert("Rebalance", { id: `seed_rb_${r.date}`, date: kst(r.date), memo: r.memo, createdAt: now });
}
lines.push("");

// ── 계좌 스냅샷 · 투자일지 ──
lines.push("-- 계좌 스냅샷 · 투자일지 (주력 콘텐츠)");
for (const s of seedAccountSnapshots) {
  upsert("AccountSnapshot", {
    id: `seed_as_${s.date}`,
    date: kst(s.date),
    principal: s.principal,
    value: s.value,
    income: s.income,
    memo: s.memo ?? null,
    createdAt: now,
  });
}
for (const [i, j] of seedJournalEntries.entries()) {
  upsert("JournalEntry", {
    id: `seed_jn_${String(i + 1).padStart(2, "0")}`,
    date: kst(j.date),
    action: j.action,
    title: j.title,
    body: j.body,
    ticker: j.ticker ?? null,
    name: j.name ?? null,
    shares: j.shares ?? null,
    price: j.price ?? null,
    currency: j.currency ?? "KRW",
    postSlug: j.postSlug ?? null,
    published: true,
    createdAt: now,
    updatedAt: now,
  });
}
lines.push("");

// ── 콘텐츠 · 댓글 · 피드 ──
lines.push("-- 콘텐츠 · 댓글 · RSS");
for (const [i, p] of seedPosts.entries()) {
  const { publishedAt, ...rest } = p;
  upsert("Post", {
    id: `seed_po_${String(i + 1).padStart(2, "0")}`,
    ...rest,
    category: rest.category ?? null,
    excerpt: rest.excerpt ?? null,
    bodyHtml: rest.bodyHtml ?? null,
    thumbnailUrl: null,
    externalUrl: rest.externalUrl ?? null,
    ticker: rest.ticker ?? null,
    tags: rest.tags ?? null,
    viewCount: 0,
    publishedAt: new Date(publishedAt),
    createdAt: now,
    updatedAt: now,
  });
}
lines.push("");
lines.push("-- 댓글은 글 slug로 연결한다(Post id를 하드코딩하지 않기 위해)");
for (const [i, c] of seedComments.entries()) {
  lines.push(
    `INSERT INTO "Comment" ("id","postId","authorName","body","status","reported","createdAt")\n` +
      `  SELECT ${lit(`seed_cm_${i + 1}`)}, "id", ${lit(c.authorName)}, ${lit(c.body)}, ${lit(c.status)}, ${lit(c.reported)}, ${lit(now)}\n` +
      `  FROM "Post" WHERE "slug" = ${lit(c.postSlug)}\n` +
      `  ON CONFLICT("id") DO UPDATE SET "body" = excluded."body", "status" = excluded."status";`,
  );
}
lines.push("");
for (const [i, f] of seedFeeds.entries()) {
  upsert("Feed", {
    id: `seed_fd_${i + 1}`,
    name: f.name,
    url: f.url,
    active: f.active,
    lastFetchedAt: null,
    createdAt: now,
  });
}

writeFileSync(OUT, lines.join("\n") + "\n", "utf8");
console.log(`✓ D1 시드 SQL 생성: prisma/seed.d1.sql (${lines.length}줄)`);
console.log("  적용:  npx wrangler d1 execute woodsman-db --remote --file=./prisma/seed.d1.sql");
console.log("  ⚠ 이 파일에는 관리자 비밀번호 해시가 들어 있습니다. 커밋하지 마세요(.gitignore 처리됨).");

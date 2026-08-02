/**
 * 시드 스크립트 — 여러 번 실행해도 안전한 upsert 방식.
 *
 * 관리자 계정 정책:
 *   .env의 ADMIN_EMAIL / ADMIN_PASSWORD 로 upsert 한다(최초 설정값이 그대로 지속).
 *   비밀번호를 잊었다면 .env 값을 바꾸고 다시 시드하면 갱신된다. 이메일 복구는 없다.
 *   비밀번호는 어떤 경우에도 콘솔·DB 평문으로 남기지 않는다.
 */
import { hash } from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma";
import { hasEnvKey, parseServerEnv } from "../src/lib/env";
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
} from "../src/lib/seed-data";

const db = new PrismaClient();

async function main() {
  const env = parseServerEnv();

  // ── 1. 관리자 계정 (env 기준 upsert) ──
  const passwordHash = await hash(env.ADMIN_PASSWORD, 12);
  const admin = await db.user.upsert({
    where: { email: env.ADMIN_EMAIL },
    update: { passwordHash, role: "ADMIN" },
    create: {
      email: env.ADMIN_EMAIL,
      name: "관리자",
      role: "ADMIN",
      passwordHash,
    },
  });
  console.log(`✓ 관리자 계정 준비 완료: ${admin.email}`);

  // ── 2. 사이트 · AI 전역 설정 ──
  await db.siteConfig.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton", ...seedSiteConfig },
  });
  await db.aiConfig.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton", ...seedAiConfig },
  });
  console.log("✓ SiteConfig · AiConfig 기본값");

  // ── 3. AI 제공자 (env에 키가 있는 것만 활성화) ──
  const providers = buildAiProviderSeeds((name) => hasEnvKey(name, process.env));
  for (const p of providers) {
    await db.aiProvider.upsert({
      where: { name: p.name },
      // 사용량(tokensUsedThisMonth)은 보존하고 연결 상태만 갱신한다
      update: { enabled: p.enabled, baseUrl: p.baseUrl, model: p.model, priority: p.priority },
      create: {
        name: p.name,
        kind: p.kind,
        baseUrl: p.baseUrl,
        model: p.model,
        apiKeyEnv: p.apiKeyEnv,
        free: p.free,
        enabled: p.enabled,
        priority: p.priority,
        monthlyTokenCap: p.monthlyTokenCap,
      },
    });
  }
  const connected = providers.filter((p) => p.enabled).map((p) => p.name);
  console.log(
    `✓ AI 제공자 ${providers.length}개 등록 (연결됨: ${connected.length ? connected.join(", ") : "없음 — .env에 키를 넣으면 자동 활성화"})`,
  );

  // ── 4. 대표 포트폴리오 ──
  for (const h of seedModelHoldings) {
    const id = `seed_mh_${h.key.toLowerCase()}`;
    const { key: _key, ...rest } = h;
    void _key;
    await db.modelHolding.upsert({
      where: { id },
      update: rest,
      create: { id, ...rest },
    });
  }
  for (const r of seedRebalances) {
    const id = `seed_rb_${r.date}`;
    await db.rebalance.upsert({
      where: { id },
      update: { memo: r.memo },
      create: { id, date: new Date(`${r.date}T00:00:00+09:00`), memo: r.memo },
    });
  }
  console.log(`✓ 대표 포트폴리오 ${seedModelHoldings.length}종목 · 리밸런싱 ${seedRebalances.length}건`);

  // ── 4-1. 계좌 스냅샷 · 투자일지 (공개 콘텐츠) ──
  for (const s of seedAccountSnapshots) {
    const date = new Date(`${s.date}T00:00:00+09:00`);
    const data = { principal: s.principal, value: s.value, income: s.income, memo: s.memo ?? null };
    await db.accountSnapshot.upsert({ where: { date }, update: data, create: { date, ...data } });
  }
  for (const [i, j] of seedJournalEntries.entries()) {
    const id = `seed_jn_${String(i + 1).padStart(2, "0")}`;
    const { date, ...rest } = j;
    const data = { ...rest, date: new Date(`${date}T00:00:00+09:00`) };
    await db.journalEntry.upsert({ where: { id }, update: data, create: { id, ...data } });
  }
  console.log(
    `✓ 계좌 스냅샷 ${seedAccountSnapshots.length}개월 · 투자일지 ${seedJournalEntries.length}건`,
  );

  // ── 5. 콘텐츠 · 댓글 ──
  for (const p of seedPosts) {
    const { publishedAt, ...rest } = p;
    await db.post.upsert({
      where: { slug: p.slug },
      update: { ...rest, publishedAt: new Date(publishedAt) },
      create: { ...rest, publishedAt: new Date(publishedAt) },
    });
  }

  for (const [i, c] of seedComments.entries()) {
    const post = await db.post.findUnique({ where: { slug: c.postSlug } });
    if (!post) continue;
    const id = `seed_cm_${i + 1}`;
    await db.comment.upsert({
      where: { id },
      update: { status: c.status, body: c.body },
      create: {
        id,
        postId: post.id,
        authorName: c.authorName,
        body: c.body,
        status: c.status,
        reported: c.reported,
      },
    });
  }
  console.log(`✓ 콘텐츠 ${seedPosts.length}건 · 댓글 ${seedComments.length}건`);

  // ── 6. RSS 피드 ──
  for (const f of seedFeeds) {
    await db.feed.upsert({
      where: { url: f.url },
      update: { name: f.name, active: f.active },
      create: f,
    });
  }
  console.log(`✓ RSS 피드 ${seedFeeds.length}건`);
}

main()
  .then(async () => {
    await db.$disconnect();
    console.log("\n시드 완료.");
  })
  .catch(async (e: unknown) => {
    await db.$disconnect();
    console.error("\n시드 실패:", e instanceof Error ? e.message : e);
    process.exit(1);
  });

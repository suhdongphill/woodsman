/**
 * 시스템 점검 — 「항상 자동으로 해 주고, 어색한 것은 알려 달라」(운영자, 2026-09-27).
 *
 * `system-check` 스킬이 **배포 뒤와 세션 시작 때** 부른다. 운영 D1·공개 화면·GitHub Actions·볼트 파일을
 * **읽기만** 하고, 어색한 것(⚠)과 정상(✓)을 한 줄씩 낸다. 고치지 않는다 — 고치는 것은 보고를 본 뒤 따로.
 *
 * 실행: node scripts/system-check.mjs          (web 폴더에서)
 * 종료코드: 0 = 어색한 것 없음 · 1 = ⚠ 있음 · 2 = 점검 자체가 실패
 *
 * ⚠ 기준(몇 시간이면 늦었다 등)은 여기 적고 이유를 붙인다. 판단이 코드에 숨지 않게.
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";

const SITE = "https://portfolio-solutions.net";
const VAULT = "D:/Woodsman/Investor";
const PAGES = ["/", "/blog", "/macro", "/leaders", "/portfolio", "/insights", "/stocks"];
/** 06:00 KST 예약 수집 뒤 이만큼 지나도 새 기록이 없으면 늦었다 — 하루 한 번 + 여유 6시간. */
const CRON_STALE_HOURS = 30;
/** 볼트 잔고 수집이 이보다 오래되면 알린다 — 증권사 잔고는 날마다 바뀐다. */
const VAULT_STALE_HOURS = 48;

const out = [];
const warn = (area, msg) => out.push({ ok: false, area, msg });
const ok = (area, msg) => out.push({ ok: true, area, msg });

function d1(sql) {
  const raw = execSync(`npx wrangler d1 execute woodsman-db --remote --json --command "${sql}"`, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"],
  });
  const parsed = JSON.parse(raw.slice(raw.indexOf("[")));
  return parsed.map((p) => p.results ?? []);
}

const hoursSince = (iso) => (Date.now() - Date.parse(iso)) / 3_600_000;

// 1. 공개 화면
for (const p of PAGES) {
  try {
    const res = await fetch(`${SITE}${p}`, { redirect: "manual" });
    if (res.status === 200) ok("화면", `${p} 200`);
    else warn("화면", `${p} 응답 ${res.status}`);
  } catch (e) {
    warn("화면", `${p} 요청 실패 — ${e.message}`);
  }
}

// 2. 배포
try {
  const runs = JSON.parse(
    execSync(`gh run list --workflow "Deploy to Cloudflare Workers" --limit 1 --json conclusion,headSha,updatedAt,displayTitle`, { encoding: "utf8" }),
  );
  const r = runs[0];
  if (r?.conclusion === "success") ok("배포", `마지막 배포 성공 ${r.headSha.slice(0, 7)} ${r.updatedAt}`);
  else warn("배포", `마지막 배포 ${r?.conclusion || "진행 중/없음"} — ${r?.displayTitle ?? ""}`);
} catch (e) {
  warn("배포", `gh로 배포 상태를 읽지 못했다 — ${e.message.split("\n")[0]}`);
}

// 3. 운영 D1 — 예약 수집 · GCRM · 블로그 · 포트폴리오 · 주도주 · 기록
try {
  const [macro, gcrm, blog, holdings, leader, releases, size] = d1(
    [
      "SELECT MAX(startedAt) t, (SELECT failCount FROM MacroIngest WHERE trigger='CRON' ORDER BY startedAt DESC LIMIT 1) f FROM MacroIngest WHERE trigger='CRON'",
      "SELECT MAX(asOf) asOf FROM GcrmRun",
      "SELECT startedAt t, found, failCount f, error FROM BlogSync ORDER BY startedAt DESC LIMIT 1",
      "SELECT COUNT(*) n, SUM(published) pub, MAX(updatedAt) u FROM ModelHolding WHERE id LIKE 'bk!_%' ESCAPE '!'",
      "SELECT MAX(collectedAt) c FROM LeaderRun",
      "SELECT MAX(at) at FROM SiteRelease",
      "SELECT 1 x",
    ].join("; "),
  );
  const m = macro[0];
  if (!m?.t) warn("수집", "거시 예약 수집 기록이 없다");
  else if (hoursSince(m.t) > CRON_STALE_HOURS) warn("수집", `거시 예약 수집이 ${hoursSince(m.t).toFixed(0)}시간째 없다(마지막 ${m.t})`);
  else if (m.f > 0) warn("수집", `거시 예약 수집 실패 ${m.f}건(마지막 ${m.t}) — /admin/macro`);
  else ok("수집", `거시 예약 수집 ${m.t} 실패 0`);

  const g = gcrm[0]?.asOf;
  const todayKst = new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);
  if (!g) warn("GCRM", "run이 없다");
  else if (g < todayKst && new Date(Date.now() + 9 * 3_600_000).getUTCHours() >= 7) warn("GCRM", `오늘(${todayKst}) run이 없다 — 마지막 ${g}`);
  else ok("GCRM", `마지막 run ${g}`);

  const b = blog[0];
  if (!b) warn("블로그", "수집 기록이 없다");
  else if (b.error) warn("블로그", `마지막 수집 실패 — ${b.error}`);
  else if (hoursSince(b.t) > CRON_STALE_HOURS) warn("블로그", `수집이 ${hoursSince(b.t).toFixed(0)}시간째 없다(마지막 ${b.t})`);
  else if (b.f > 0) warn("블로그", `마지막 수집 일부 실패 ${b.f}건 — /admin/blog`);
  else ok("블로그", `마지막 수집 ${b.t} · ${b.found}편 · 실패 0`);

  const h = holdings[0];
  if (!h?.n) warn("포트폴리오", "운영 포트폴리오(ModelHolding bk_ 행)가 0행 — 볼트 잔고가 사이트에 안 실렸다(apply-portfolio.ps1)");
  else ok("포트폴리오", `bk_ 행 ${h.n} · 공개 ${h.pub ?? 0} · 마지막 갱신 ${h.u}`);

  // 볼트와 대조
  const leadersFile = `${VAULT}/_data/leaders.json`;
  if (existsSync(leadersFile)) {
    const updated = JSON.parse(readFileSync(leadersFile, "utf8")).updated;
    const c = leader[0]?.c;
    if (!c) warn("주도주", "운영에 실린 판정이 없다");
    else if (c !== updated) warn("주도주", `볼트 판정(${updated})과 운영(${c})이 다르다 — 주간 파이프라인 적재 확인`);
    else ok("주도주", `볼트와 운영이 같다 (${c})`);
  } else warn("주도주", `볼트 파일이 없다 — ${leadersFile}`);

  const pf = `${VAULT}/_data/portfolio.json`;
  if (existsSync(pf)) {
    const p = JSON.parse(readFileSync(pf, "utf8"));
    for (const [broker, st] of Object.entries(p.brokers ?? {})) {
      if (st.ok) ok("볼트 잔고", `${broker} ${st.n}종목 (${p.updated})`);
      else warn("볼트 잔고", `${broker} 수집 안 됨 — ${st.why ?? "이유 없음"}`);
    }
    if (hoursSince(p.updated.replace(" ", "T") + ":00+09:00") > VAULT_STALE_HOURS) warn("볼트 잔고", `잔고 수집이 오래됐다(${p.updated})`);
    const sql = `${VAULT}/_data/portal-handoff/model-holdings.sql`;
    if (existsSync(sql) && statSync(sql).mtimeMs < statSync(pf).mtimeMs)
      warn("볼트 잔고", "적재용 SQL이 최신 잔고보다 오래됐다 — export-portal-portfolio.py를 다시 돌린 뒤 적재");
  }

  const rel = releases[0]?.at;
  ok("기록", `마지막 릴리스 기록 ${rel ?? "없음"}`);
  void size;
} catch (e) {
  warn("D1", `운영 D1을 읽지 못했다 — ${e.message.split("\n")[0]}`);
}

// 4. 저장소
try {
  execSync("git fetch -q", { stdio: "ignore" });
  const ahead = execSync("git log --oneline origin/main..main", { encoding: "utf8" }).trim();
  const dirty = execSync("git status --porcelain", { encoding: "utf8" }).trim();
  if (ahead) warn("저장소", `push 안 한 커밋 ${ahead.split("\n").length}개`);
  else ok("저장소", "push 안 한 커밋 없음");
  if (dirty) warn("저장소", `커밋 안 한 변경 ${dirty.split("\n").length}개`);
} catch (e) {
  warn("저장소", `git 상태를 읽지 못했다 — ${e.message.split("\n")[0]}`);
}

const warns = out.filter((o) => !o.ok);
for (const o of [...warns, ...out.filter((x) => x.ok)]) console.log(`${o.ok ? "✓" : "⚠"} [${o.area}] ${o.msg}`);
console.log(`\n어색한 것 ${warns.length}개 · 정상 ${out.length - warns.length}개`);
process.exit(warns.length ? 1 : 0);

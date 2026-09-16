/**
 * 재무부 계열 수집 — **워커 밖에서** 돌린다 (S2-c, 2026-09-16).
 *
 * 실행:
 *   node --import tsx scripts/treasury-daily.mjs --dry-run    # 받아서 세기만 한다(D1을 건드리지 않음)
 *   node --import tsx scripts/treasury-daily.mjs --remote     # 운영 D1
 *
 * ## 왜 워커가 아니라 여기인가
 * 2026-09-13부터 **매 수집마다 재무부 네 계열이 전부 실패**했다 — Fiscal Data `525`, TreasuryDirect도 `525`,
 * 나머지는 시간 초과. 두 경로 모두 **로컬에서는 받아진다.** 주소 하나의 문제가 아니라 워커 → treasury.gov
 * 연결이 막히는 것으로 보인다(원인 미확정). 그래서 이 수집만 GitHub Actions에서 돌려 결과를 D1에 밀어 넣는다.
 * ⚠ 받는 코드는 **워커가 쓰던 것 그대로**다(`lib/macro/treasury-fetch.ts`) — 워커에서 다시 열리면 그쪽만 되살린다.
 *
 * ## ⚠ 규칙 (`alfred-backfill.mjs`에서 데인 것들)
 * - 운영 D1에는 **`--file`을 쓰지 않는다.** 가져오기 경로는 DB를 잠근다("your D1 database will be unavailable").
 *   보통 쿼리 경로(`--command`)로 작은 묶음씩 보낸다. 느리지만 잠그지 않는다.
 * - **L1(`MacroObservation`) 먼저, L2(`MacroPoint`) 다음.** 순서가 뒤집히면 수정 전 값이 사라진다 —
 *   과거 시점의 판정을 다시 계산할 때 그때는 몰랐던 수정치가 섞인다(look-ahead bias).
 * - 같은 값은 L1에 쌓지 않는다. 처음 보는 관측일과 **값이 바뀐 관측일**만 쌓는다(`diffObservations`).
 * - D1 호출은 **두 번까지 다시 보낸다**(5초·15초). 7403 「권한 없음」이 일시적 오류였던 적이 다섯 번 있다.
 * - ⚠ **한 계열이 실패해도 나머지는 간다.** 다만 실패는 `MacroIngest.detail`과 종료 코드에 남는다 —
 *   조용히 성공으로 끝나는 것이 이 프로젝트에서 가장 크게 데인 사고다.
 * - ⚠ 결과를 **반드시** `MacroIngest`에 남긴다(`trigger = GITHUB_TREASURY`). 남기지 않으면 관리자 화면에서
 *   "도는 줄 알았는데 몇 달째 안 들어온" 상태를 아무도 모른다.
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const { MACRO_INDICATORS } = await import("../src/lib/macro/catalog.ts");
const { fetchTreasury } = await import("../src/lib/macro/treasury-fetch.ts");
const { diffObservations } = await import("../src/lib/macro/vintage.ts");

const args = new Set(process.argv.slice(2));
const dryRun = !args.has("--remote");

/** 이미 가진 값에서 며칠까지 되돌려 다시 받을 것인가. 수집기(`ingest.ts`)의 REFRESH_DAYS와 같은 뜻. */
const REFRESH_DAYS = 500;
/** 한 `--command`에 담는 행 수. SQL 길이를 명령줄 한도(3.2만 자) 안쪽으로 둔다. */
const ROWS_PER_COMMAND = 60;

const sqlStr = (v) => `'${String(v).replaceAll("'", "''")}'`;
const stored = (day) => `${day}T12:00:00.000Z`;
const daysAgo = (n) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
const sleepSync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/**
 * ⚠ `npx wrangler`를 셸로 부르지 않는다(2026-09-16). 윈도우에서 셸을 끼면 SQL의 공백·따옴표가 깨져
 *   「Unknown arguments」로 죽는다. `alfred-backfill.mjs`와 같은 방식으로 **wrangler를 직접 실행**한다 —
 *   셸이 없으니 인자가 그대로 전달된다.
 */
const WRANGLER_JS = fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url));
function wrangler(argv) {
  const out = execFileSync(process.execPath, [WRANGLER_JS, ...argv], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const start = out.indexOf("[");
  if (start < 0) return [];
  return JSON.parse(out.slice(start));
}

/** ⚠ 실패하면 두 번까지 다시 보낸다 — 「권한이 없다」는 말을 그대로 믿지 않는다. */
function d1Query(sql) {
  for (let attempt = 1; ; attempt++) {
    try {
      return wrangler(["d1", "execute", "woodsman-db", "--remote", "--json", "--command", sql]);
    } catch (error) {
      const detail = String(error.stdout ?? error.stderr ?? error.message).replace(/\s+/g, " ");
      if (attempt >= 3) throw error;
      const wait = attempt === 1 ? 5000 : 15000;
      console.error(`  ⚠ D1 호출 실패(${attempt}회) — ${wait / 1000}초 뒤 다시 보낸다: ${detail.slice(0, 160)}`);
      sleepSync(wait);
    }
  }
}

const rowsOf = (res) => res?.[0]?.results ?? [];

/**
 * L1에 남긴다 — **L2를 덮어쓰기 전에.**
 * `features/macro/repository.ts`의 `recordObservations`와 **같은 판단**이다(그쪽은 D1 바인딩, 여기는 쿼리 경로).
 * @returns 값이 바뀐 관측일 수(= 통계 수정)
 */
function recordObservations(seriesKey, source, points, vintageDate) {
  if (points.length === 0) return 0;
  const from = points.reduce((min, p) => (p.date < min ? p.date : min), points[0].date);

  const rows = rowsOf(
    d1Query(
      `SELECT observationDate, vintageDate, value FROM MacroObservation
       WHERE seriesKey = ${sqlStr(seriesKey)} AND observationDate >= ${sqlStr(stored(from))}`,
    ),
  );
  const latest = new Map();
  for (const r of rows) {
    const day = String(r.observationDate).slice(0, 10);
    const cur = latest.get(day);
    if (!cur || r.vintageDate > cur.vintageDate) latest.set(day, { vintageDate: r.vintageDate, value: r.value });
  }

  const { firstSeen, revised } = diffObservations(points, new Map([...latest].map(([d, v]) => [d, v.value])));
  const toAppend = [...firstSeen, ...revised.map((r) => ({ date: r.date, value: r.to }))];
  if (toAppend.length === 0) return 0;

  const now = new Date().toISOString();
  for (let i = 0; i < toAppend.length; i += ROWS_PER_COMMAND) {
    const chunk = toAppend.slice(i, i + ROWS_PER_COMMAND);
    const values = chunk
      .map(
        (p) =>
          `(${sqlStr(seriesKey)}, ${sqlStr(stored(p.date))}, ${sqlStr(vintageDate)}, ${p.value}, ` +
          `${sqlStr(source)}, 'INGEST', ${sqlStr(now)})`,
      )
      .join(", ");
    /**
     * ⚠ `INSERT OR IGNORE`가 아니라 UPDATE다 — 빈티지 단위는 **날짜**라, 같은 날 두 번 받아 값이 또 바뀌면
     *   그날 행을 고쳐야 한다. IGNORE로 두면 같은 날의 두 번째 수정이 조용히 버려진다.
     */
    d1Query(
      `INSERT INTO MacroObservation (seriesKey, observationDate, vintageDate, value, source, origin, retrievedAt)
       VALUES ${values}
       ON CONFLICT(seriesKey, observationDate, vintageDate) DO UPDATE SET
         value = excluded.value, source = excluded.source, origin = excluded.origin, retrievedAt = excluded.retrievedAt`,
    );
  }
  return revised.length;
}

/** L2 — 화면과 점수가 읽는 층. 같은 날짜를 다시 받으면 덮어쓴다(통계는 사후에 수정된다). */
function upsertPoints(seriesKey, source, points) {
  const now = new Date().toISOString();
  for (let i = 0; i < points.length; i += ROWS_PER_COMMAND) {
    const chunk = points.slice(i, i + ROWS_PER_COMMAND);
    const values = chunk
      .map((p) => `(${sqlStr(seriesKey)}, ${sqlStr(stored(p.date))}, ${p.value}, ${sqlStr(source)}, ${sqlStr(now)})`)
      .join(", ");
    d1Query(
      `INSERT INTO MacroPoint (seriesKey, date, value, source, updatedAt)
       VALUES ${values}
       ON CONFLICT(seriesKey, date) DO UPDATE SET
         value = excluded.value, source = excluded.source, updatedAt = excluded.updatedAt`,
    );
  }
}

// ── 실행 ────────────────────────────────────────────────────────────────────

const indicators = MACRO_INDICATORS.filter((i) => i.source === "TREASURY");
if (indicators.length === 0) {
  console.error("카탈로그에 TREASURY 지표가 없습니다 — 스크립트가 할 일이 없습니다.");
  process.exit(1);
}

console.log(`재무부 계열 ${indicators.length}개 · ${dryRun ? "받기만(dry-run)" : "운영 D1에 쓴다"}`);

const startedAt = new Date().toISOString();
const detail = [];
let okCount = 0;
let failCount = 0;
let addedPoints = 0;

for (const indicator of indicators) {
  const label = `${indicator.key}(${indicator.sourceId})`;
  try {
    const points = await fetchTreasury(indicator.sourceId, daysAgo(REFRESH_DAYS));
    console.log(`  ✓ ${label} — ${points.length}점 (최신 ${points.at(-1)?.date})`);
    okCount += 1;

    if (dryRun) {
      detail.push({ key: indicator.key, ok: true, points: points.length, dryRun: true });
      continue;
    }

    const vintageDate = new Date().toISOString().slice(0, 10);
    const revised = recordObservations(indicator.key, "TREASURY", points, vintageDate);
    upsertPoints(indicator.key, "TREASURY", points);
    addedPoints += points.length;
    detail.push({ key: indicator.key, ok: true, points: points.length, revised });
    if (revised > 0) console.log(`    · 통계 수정 ${revised}건 — 수정 전 값은 L1에 남았습니다`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`  ✗ ${label} — ${message}`);
    failCount += 1;
    detail.push({ key: indicator.key, ok: false, error: message });
  }
}

if (!dryRun) {
  /**
   * ⚠ 성공·실패와 무관하게 **항상** 남긴다. 관리자 「최근 수집 이력」이 외부 작업의 상태를 대신 보여 준다 —
   *   워커 수집에서 재무부를 뺐기 때문에, 이 줄이 없으면 아무 데도 안 보인다.
   */
  d1Query(
    `INSERT INTO MacroIngest (id, startedAt, finishedAt, trigger, okCount, failCount, addedPoints, detail)
     VALUES (${sqlStr(`gh_${Date.now().toString(36)}`)}, ${sqlStr(startedAt)}, ${sqlStr(new Date().toISOString())},
             'GITHUB_TREASURY', ${okCount}, ${failCount}, ${addedPoints}, ${sqlStr(JSON.stringify(detail))})`,
  );
}

console.log(`끝 — 성공 ${okCount} · 실패 ${failCount} · 쓴 점 ${addedPoints}`);
// ⚠ 하나라도 실패하면 종료 코드 1. 스케줄러가 성공으로 넘기면 「도는 줄 알았는데」가 된다.
if (failCount > 0) process.exit(1);

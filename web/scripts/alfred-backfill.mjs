/**
 * ALFRED 빈티지 백필 — 수정이 잦은 계열의 **과거 발표값**을 L1(`MacroObservation`)에 한 번 채운다.
 * Capital Regime Engine R1 (2026-09-13).
 *
 * 실행:
 *   node --env-file=.env --import tsx scripts/alfred-backfill.mjs --dry-run     # 세기만 한다
 *   node --env-file=.env --import tsx scripts/alfred-backfill.mjs --local       # 로컬 D1
 *   node --env-file=.env --import tsx scripts/alfred-backfill.mjs --remote      # 운영 D1
 *
 * ## 왜 로컬 스크립트인가
 * ALFRED는 FRED API 키가 필요하다. 사이트(Worker)는 FRED를 **키 없이** CSV로 받고 있고, 키는 이 PC의
 * `.env`에만 있다. 백필은 **한 번** 하는 일이라 Worker에 키를 올릴 이유가 없다. 이후의 수정은
 * 매일 수집이 L1과 대조해 잡는다(`ingest.ts`).
 *
 * ## ⚠ 운영 D1에는 `--file`을 쓰지 않는다 (2026-09-13 사고)
 * `wrangler d1 execute --remote --file`은 **가져오기(import) 경로**로 가고, wrangler가 이렇게 경고한다 —
 * 「This process may take some time, **during which your D1 database will be unavailable to serve queries.**」
 * 처음 판이 그걸로 20계열을 한 파일씩 올리다가 **9계열째에서 멈췄다**(사이트가 읽는 DB를 매번 잠근다).
 * 그래서 운영은 **보통 쿼리 경로(`--command`)로 작은 묶음씩** 보낸다. 느리지만 잠그지 않는다.
 * 로컬은 잠겨도 상관없으니 `--file` 그대로 둔다.
 *
 * ## ⚠ 규칙
 * - 결측(".")은 버린다. 빈티지보다 뒤의 관측일(그 시점의 전망)은 버린다(`alfredToRows`).
 * - `INSERT OR IGNORE` — 이미 있는 (계열, 관측일, 빈티지)는 건드리지 않는다. 몇 번 돌려도 같다.
 * - 이미 다 들어간 계열은 **건너뛴다**(운영에서 ALFRED 행 수를 세어 본다).
 * - 묶음이 실패하면 **한 번만** 다시 보낸다(7403 「권한 없음」이 일시적 오류였던 적이 두 번 있다).
 *   두 번째도 실패하면 **멈추고 이유를 찍는다** — 건너뛰고 계속 가지 않는다.
 * - ⚠ 성공을 **말로** 한다. 계열마다 받은 행·쓴 행을 찍고, 끝에 D1에서 다시 센다.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const { MACRO_INDICATORS } = await import("../src/lib/macro/catalog.ts");
const { alfredToRows, sameValue } = await import("../src/lib/macro/vintage.ts");

/**
 * 수정이 잦은 계열만. 시장가격(일별 금리·유가·주가)은 발표 뒤 고쳐지지 않으므로 넣지 않는다.
 * ⚠ 키가 아니라 FRED 시리즈 ID로 적는다 — 카탈로그에서 키를 찾아 쓴다(카탈로그에 없으면 멈춘다).
 */
const REVISED_SERIES = [
  "GDP", "OPHNFB", "ULCNFB", "COMPRNFB", "GDPPOT",
  "PAYEMS", "UNRATE", "JTSJOL", "ICSA",
  "CPIAUCSL", "CPILFESL", "PCEPILFE", "PPIACO",
  "INDPRO", "IPG3344S", "CAPUTLG3344S", "A34SNO",
  "RSAFS", "HOUST", "M2SL",
];

/** 운영 `--command` 한 번에 보내는 행 수. SQL 약 1.6만 자 — 명령줄 한도(3.2만) 안쪽이다. */
const REMOTE_ROWS_PER_COMMAND = 150;

const args = new Set(process.argv.slice(2));
const mode = args.has("--remote") ? "remote" : args.has("--local") ? "local" : "dry-run";
const KEY = process.env.FRED_API_KEY;
if (!KEY) {
  console.error("FRED_API_KEY가 .env에 없습니다. ALFRED는 키가 필요합니다.");
  process.exit(1);
}

/**
 * wrangler를 **셸 없이** 직접 부른다. `cmd.exe`를 거치면 명령줄이 8,191자에서 잘려 SQL이 조용히
 * 깨지고, 인자가 이스케이프되지 않는다(Node DEP0190 경고가 그것이다).
 */
const WRANGLER_JS = fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url));
function wrangler(argv, { json = false } = {}) {
  const out = execFileSync(process.execPath, [WRANGLER_JS, ...argv], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
  return json ? JSON.parse(out.slice(out.indexOf("["))) : out;
}
/**
 * ⚠ 2026-09-13: 운영 D1이 **7403 「권한 없음」**을 일시적으로 낸다(이날만 세 번 — 다시 보내면 통했다).
 *   처음엔 INSERT 묶음에만 재시도를 걸었고, **건너뛸지 세는 SELECT에서 한 번 나자 스크립트 전체가 죽었다.**
 *   그래서 재시도를 **모든 D1 호출이 지나는 이 한 곳**에 둔다(5초·15초 뒤 두 번). 세 번째도 실패하면 던진다.
 *   ⚠ 이 함수는 동기(execFileSync)라 기다림도 동기로 한다 — 비동기 sleep을 끼우면 호출부가 전부 바뀐다.
 */
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
function d1Query(sql) {
  for (let attempt = 1; ; attempt++) {
    try {
      return wrangler(["d1", "execute", "woodsman-db", `--${mode}`, "--json", "--command", sql], { json: true });
    } catch (error) {
      const detail = String(error.stdout ?? error.stderr ?? error.message).replace(/\s+/g, " ");
      if (attempt >= 3) throw error;
      const wait = attempt === 1 ? 5000 : 15000;
      console.error(`  ⚠ D1 호출 실패(${attempt}회) — ${wait / 1000}초 뒤 다시 보낸다: ${detail.slice(0, 160)}`);
      sleepSync(wait);
    }
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const bySourceId = new Map(
  MACRO_INDICATORS.filter((i) => i.source === "FRED").map((i) => [i.sourceId, i]),
);

const sqlEscape = (s) => `'${String(s).replaceAll("'", "''")}'`;
const stored = (day) => `${day}T12:00:00.000Z`;

async function fetchAllVintages(seriesId) {
  const out = [];
  let offset = 0;
  const limit = 100000;
  for (;;) {
    const url =
      `https://api.stlouisfed.org/fred/series/observations?series_id=${encodeURIComponent(seriesId)}` +
      `&api_key=${KEY}&file_type=json&realtime_start=1776-07-04&realtime_end=9999-12-31` +
      `&limit=${limit}&offset=${offset}`;
    /**
     * ⚠ 2026-09-13: INDPRO(38,756행)을 다 쓴 뒤 다음 계열의 ALFRED 요청이 `fetch failed · ECONNABORTED`로 죽었다.
     *   D1 쓰기에는 재시도가 있었지만 **ALFRED 받기에는 없었다.** 네트워크 오류는 두 번까지 다시 받는다(5초·15초).
     *   세 번째도 실패하면 멈춘다 — 이미 들어간 계열은 다음 실행이 건너뛴다.
     */
    let res;
    for (let attempt = 1; ; attempt++) {
      try {
        res = await fetch(url);
        break;
      } catch (error) {
        if (attempt >= 3) throw new Error(`ALFRED ${seriesId} 받기 ${attempt}회 실패 — 멈춘다: ${error.cause?.code ?? error.message}`);
        const wait = attempt === 1 ? 5000 : 15000;
        console.error(`  ⚠ ALFRED ${seriesId} 받기 실패(${error.cause?.code ?? error.message}) — ${wait / 1000}초 뒤 다시 받는다`);
        await sleep(wait);
      }
    }
    if (!res.ok) throw new Error(`ALFRED ${seriesId} 응답 ${res.status}`);
    const json = await res.json();
    if (!Array.isArray(json.observations)) throw new Error(`ALFRED ${seriesId}: ${json.error_message ?? "관측치 없음"}`);
    out.push(...json.observations);
    if (out.length >= json.count || json.observations.length === 0) break;
    offset += json.observations.length;
  }
  return out;
}

const retrievedAt = new Date().toISOString();
const insertSql = (key, rows) =>
  `INSERT OR IGNORE INTO "MacroObservation" ("seriesKey","observationDate","vintageDate","value","source","origin","retrievedAt") VALUES ` +
  rows
    .map(
      (r) =>
        `(${sqlEscape(key)},${sqlEscape(stored(r.observationDate))},${sqlEscape(r.vintageDate)},${r.value},'FRED','ALFRED',${sqlEscape(retrievedAt)})`,
    )
    .join(",") +
  ";";

const dir = mode === "local" ? mkdtempSync(join(tmpdir(), "alfred-")) : null;
let totalRows = 0;
let totalWritten = 0;

for (const seriesId of REVISED_SERIES) {
  const indicator = bySourceId.get(seriesId);
  if (!indicator) {
    console.error(`⚠ 카탈로그에 ${seriesId}가 없습니다 — 목록을 고치세요. 멈춥니다.`);
    process.exit(1);
  }
  const obs = await fetchAllVintages(seriesId);
  const { rows, skippedMissing, skippedFuture } = alfredToRows(obs);
  totalRows += rows.length;
  const head = `${seriesId.padEnd(14)} → ${indicator.key.padEnd(16)} 받음 ${String(obs.length).padStart(6)} · 쓸 행 ${String(rows.length).padStart(6)} · 결측 ${skippedMissing} · 미래(전망) ${skippedFuture}`;
  if (mode === "dry-run" || rows.length === 0) {
    console.log(head);
    continue;
  }

  if (mode === "local") {
    const lines = [];
    for (let i = 0; i < rows.length; i += 200) lines.push(insertSql(indicator.key, rows.slice(i, i + 200)));
    const file = join(dir, `${indicator.key}.sql`);
    writeFileSync(file, lines.join("\n"));
    wrangler(["d1", "execute", "woodsman-db", "--local", `--file=${file}`, "-y"]);
    console.log(`${head} · 로컬 파일로 씀`);
    continue;
  }

  // ── 운영: 다른 출처(SEED_L2·INGEST·MANUAL)가 이미 차지한 (관측일, 빈티지)에는 ALFRED 행이 들어갈 수 없다 ──
  // ⚠ 2026-09-13 PPIACO: 발표일(9/10)에 우리가 수집한 SEED_L2 행이 같은 키를 갖고 있어 ALFRED 1행이
  //   IGNORE됐다. 값은 같았다(286.023) — 잃은 것이 없다. 그래서 목표 행 수에서 그 키를 뺀다.
  //   ⚠ 같은 키인데 **값이 다르면** 계산 문제가 아니라 데이터 충돌이다 — 멈추고 알린다.
  const others = d1Query(
    `SELECT substr(observationDate,1,10) AS d, vintageDate AS v, value, origin FROM "MacroObservation" WHERE seriesKey = ${sqlEscape(indicator.key)} AND origin <> 'ALFRED'`,
  )[0].results;
  const otherByKey = new Map(others.map((o) => [`${o.d}|${o.v}`, o]));
  let occupied = 0;
  for (const r of rows) {
    const o = otherByKey.get(`${r.observationDate}|${r.vintageDate}`);
    if (!o) continue;
    occupied += 1;
    if (!sameValue(o.value, r.value)) {
      console.error(
        `  ✖ ${indicator.key} ${r.observationDate}@${r.vintageDate}: ${o.origin} 값 ${o.value} ≠ ALFRED ${r.value} — 같은 날 다른 값이다. 멈춘다.`,
      );
      process.exit(1);
    }
  }
  const expected = rows.length - occupied;
  const occupiedNote = occupied ? ` · 다른 출처가 같은 키·같은 값으로 이미 ${occupied}행` : "";

  const existing = d1Query(
    `SELECT COUNT(*) AS n FROM "MacroObservation" WHERE seriesKey = ${sqlEscape(indicator.key)} AND origin = 'ALFRED'`,
  )[0].results[0].n;
  if (existing >= expected) {
    console.log(`${head} · 이미 있음(${existing})${occupiedNote} — 건너뜀`);
    continue;
  }

  const started = Date.now();
  for (let i = 0; i < rows.length; i += REMOTE_ROWS_PER_COMMAND) {
    const sql = insertSql(indicator.key, rows.slice(i, i + REMOTE_ROWS_PER_COMMAND));
    // ⚠ d1Query가 이미 두 번 재시도한다. 여기서 한 번 더 감싸는 것은 긴 장애(수십 초)를 버티려는 것이다.
    try {
      d1Query(sql);
    } catch (first) {
      console.error(`  ⚠ ${indicator.key} ${i}행째 묶음 실패 — 5초 뒤 한 번만 다시 보낸다: ${String(first.stderr ?? first.message).replace(/\s+/g, " ").slice(0, 200)}`);
      await sleep(5000);
      try {
        d1Query(sql);
      } catch (second) {
        console.error(`  ✖ 두 번째도 실패 — 멈춘다. 다시 돌리면 이미 들어간 행은 건너뛴다: ${String(second.stderr ?? second.message).replace(/\s+/g, " ").slice(0, 300)}`);
        process.exit(1);
      }
    }
  }
  const after = d1Query(
    `SELECT COUNT(*) AS n FROM "MacroObservation" WHERE seriesKey = ${sqlEscape(indicator.key)} AND origin = 'ALFRED'`,
  )[0].results[0].n;
  totalWritten += after - existing;
  console.log(`${head} · 운영에 ${after - existing}행 추가(지금 ${after})${occupiedNote} · ${Math.round((Date.now() - started) / 1000)}초`);
  if (after < expected) {
    console.error(`  ✖ ${indicator.key}: 들어가야 할 ALFRED 행 ${expected}(쓸 행 ${rows.length} − 다른 출처가 차지한 키 ${occupied})인데 운영에 ${after}행뿐이다 — 멈춘다.`);
    process.exit(1);
  }
}

console.log(`\n합계: 쓸 행 ${totalRows.toLocaleString()} · 이번에 추가 ${totalWritten.toLocaleString()} (${mode})`);
if (mode !== "dry-run") {
  const json = d1Query(`SELECT origin, COUNT(*) AS n FROM "MacroObservation" GROUP BY origin`);
  console.log("D1에서 다시 셌다:", JSON.stringify(json[0].results));
}

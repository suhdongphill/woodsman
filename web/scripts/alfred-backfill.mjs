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
 * ## ⚠ 규칙
 * - 결측(".")은 버린다. 빈티지보다 뒤의 관측일(그 시점의 전망)은 버린다(`alfredToRows`).
 * - `INSERT OR IGNORE` — 이미 있는 (계열, 관측일, 빈티지)는 건드리지 않는다. 몇 번 돌려도 같다.
 * - ⚠ 성공을 **말로** 한다. 계열마다 받은 행·버린 행·쓴 행을 찍고, 끝에 D1에서 다시 센다.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const { MACRO_INDICATORS } = await import("../src/lib/macro/catalog.ts");
const { alfredToRows } = await import("../src/lib/macro/vintage.ts");

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

const args = new Set(process.argv.slice(2));
const mode = args.has("--remote") ? "remote" : args.has("--local") ? "local" : "dry-run";
const KEY = process.env.FRED_API_KEY;
if (!KEY) {
  console.error("FRED_API_KEY가 .env에 없습니다. ALFRED는 키가 필요합니다.");
  process.exit(1);
}

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
    const res = await fetch(url);
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
const dir = mkdtempSync(join(tmpdir(), "alfred-"));
let totalRows = 0;

for (const seriesId of REVISED_SERIES) {
  const indicator = bySourceId.get(seriesId);
  if (!indicator) {
    console.error(`⚠ 카탈로그에 ${seriesId}가 없습니다 — 목록을 고치세요. 멈춥니다.`);
    process.exit(1);
  }
  const obs = await fetchAllVintages(seriesId);
  const { rows, skippedMissing, skippedFuture } = alfredToRows(obs);
  totalRows += rows.length;
  console.log(
    `${seriesId.padEnd(14)} → ${indicator.key.padEnd(16)} 받음 ${String(obs.length).padStart(6)} · 씀 ${String(rows.length).padStart(6)} · 결측 ${skippedMissing} · 미래(전망) ${skippedFuture}`,
  );
  if (mode === "dry-run" || rows.length === 0) continue;

  // 파일 하나에 한 계열. 문장 하나에 200행 — wrangler가 파일을 나눠 보내지 않아도 되는 크기다.
  const lines = [];
  for (let i = 0; i < rows.length; i += 200) {
    const values = rows
      .slice(i, i + 200)
      .map(
        (r) =>
          `(${sqlEscape(indicator.key)}, ${sqlEscape(stored(r.observationDate))}, ${sqlEscape(r.vintageDate)}, ${r.value}, 'FRED', 'ALFRED', ${sqlEscape(retrievedAt)})`,
      )
      .join(",\n");
    lines.push(
      `INSERT OR IGNORE INTO "MacroObservation" ("seriesKey","observationDate","vintageDate","value","source","origin","retrievedAt") VALUES\n${values};`,
    );
  }
  const file = join(dir, `${indicator.key}.sql`);
  writeFileSync(file, lines.join("\n"));
  execFileSync(
    "npx",
    ["wrangler", "d1", "execute", "woodsman-db", `--${mode}`, `--file=${file}`, "-y"],
    { stdio: ["ignore", "ignore", "inherit"], shell: process.platform === "win32" },
  );
}

console.log(`\n합계: 쓸 행 ${totalRows.toLocaleString()} (${mode})`);
if (mode !== "dry-run") {
  const out = execFileSync(
    "npx",
    [
      "wrangler", "d1", "execute", "woodsman-db", `--${mode}`, "--json",
      "--command", `SELECT origin, COUNT(*) AS n FROM "MacroObservation" GROUP BY origin`,
    ],
    { encoding: "utf8", shell: process.platform === "win32" },
  );
  const json = JSON.parse(out.slice(out.indexOf("[")));
  console.log("D1에서 다시 셌다:", JSON.stringify(json[0].results));
}

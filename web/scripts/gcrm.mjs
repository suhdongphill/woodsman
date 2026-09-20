/**
 * GCRM v2 CLI — 명세 §2-19의 `pms regime …`에 대응한다.
 *
 * 실행:
 *   npm run gcrm -- run --dry-run          설정을 읽고 검증하고 config_hash를 찍는다 (DB를 건드리지 않는다)
 *   npm run gcrm -- provenance             근거 없이 정한 숫자를 드러낸다
 *   npm run gcrm -- measure                ★ 운영 D1을 **읽기만** 해서 실계산한다 (저장하지 않는다)
 *
 * ## ⚠ 왜 `pms`가 아닌가
 * 명세는 파이썬 `pms regime run`을 전제하지만, 이 포털은 Next.js + Cloudflare Workers이고
 * 거시 데이터는 D1에 있다(조사 §0-1·§0-2). 파이썬 `pms`는 `rates_*` 다섯 표만 가진 별개 실험이라
 * 그쪽에 얹으면 **같은 지표가 두 값을 갖는다.** 그래서 포털의 기존 스크립트 관례
 * (`scripts/alfred-backfill.mjs` — tsx + wrangler)를 따른다.
 *
 * ## ⚠ 이 CLI는 아무것도 저장하지 않는다
 * 쓰기는 `/api/gcrm/run`(시크릿 헤더)만 한다. 개발 중에 「지금 값이 얼마인가」를 보려고 운영에 쓰면,
 * 나중에 그 run이 진짜 계산인지 시험인지 **구분할 수 없다**(CLAUDE.md §3 — 조용한 실패를 만들지 않는다).
 */
import { execFileSync, execSync } from "node:child_process";

const { validateGcrmConfig, summarizeConfig } = await import("../src/lib/gcrm/config/validate.ts");
const { configHash } = await import("../src/lib/gcrm/config/hash.ts");
const { GCRM_CONFIG, CONFIG_PARTS } = await import("../src/lib/gcrm/config/index.ts");
const { GCRM_PILLARS, structuralCoverage, flattenPillar } = await import("../src/lib/gcrm/config/pillars.ts");
const { GCRM_INDICATOR_BY_CODE, GCRM_INDICATORS } = await import("../src/lib/gcrm/config/indicators.ts");
const { GATES } = await import("../src/lib/gcrm/config/model.ts");
const { PROVENANCE, ungrounded, provenanceSummary } = await import("../src/lib/gcrm/config/provenance.ts");

const argv = process.argv.slice(2);
const command = argv[0] ?? "help";
const flags = new Set(argv.slice(1).filter((a) => a.startsWith("--")));
const asJson = flags.has("--json");

function gitSha() {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    // ⚠ 삼키지 않는다 — 없으면 없다고 적는다. 「없음」과 「못 읽음」이 같아 보이면 안 된다.
    return null;
  }
}

async function run() {
  if (!flags.has("--dry-run")) {
    console.error(
      "run은 --dry-run(설정 검증)만 한다. 쓰기는 /api/gcrm/run(시크릿 헤더)뿐이다.\n" +
        "  npm run gcrm -- run --dry-run     설정만 본다\n" +
        "  npm run gcrm -- measure           운영 D1을 읽기만 해서 실계산한다",
    );
    process.exit(2);
  }

  const issues = validateGcrmConfig();
  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");
  const hash = await configHash(GCRM_CONFIG);
  const isOn = (code) => !!GCRM_INDICATOR_BY_CODE.get(code)?.enabled;

  const pillars = GCRM_PILLARS.map((p) => ({
    code: p.code,
    nameKo: p.nameKo,
    polarity: p.polarity,
    axisWeight: p.axisWeight,
    coverage: structuralCoverage(p, isOn),
    unavailable: flattenPillar(p).filter((m) => m.indicator === null).length,
  }));

  if (asJson) {
    console.log(
      JSON.stringify(
        { configHash: hash, gitSha: gitSha(), ...summarizeConfig(), pillars, errors, warnings },
        null,
        2,
      ),
    );
    process.exit(errors.length ? 1 : 0);
  }

  const s = summarizeConfig();
  console.log(`GCRM ${s.version}  ·  config_hash ${hash}  ·  git ${gitSha() ?? "(없음)"}`);
  console.log(`설정 ${CONFIG_PARTS.length}벌 — ${CONFIG_PARTS.join(" · ")}`);
  console.log(
    `지표 ${s.indicators.enabled}/${s.indicators.total} 사용 · 기둥 ${s.pillars} · 채널 ${s.channels} · 레짐 ${s.regimes}`,
  );

  console.log("\n기둥별 구조적 커버리지 — 설계한 무게 중 지표로 채울 수 있는 비율");
  console.log("⚠ 운영 중 결측(신선도·이력)은 여기 들어 있지 않다. 그건 계산할 때 다시 본다.");
  for (const p of pillars) {
    const pct = p.coverage * 100;
    const gate = pct < GATES.pillarMinCoverage * 100 ? " ← 게이트 미달(INSUFFICIENT)" : "";
    const bar = "█".repeat(Math.round(pct / 5)).padEnd(20, "·");
    console.log(
      `  ${p.code.padEnd(20)} ${bar} ${pct.toFixed(0).padStart(3)}%  ` +
        `무게 ${p.axisWeight.toFixed(2)} · ${p.polarity === "stress" ? "스트레스" : "우호"} · 못 채운 자리 ${p.unavailable}${gate}`,
    );
  }

  const short = GCRM_INDICATORS.filter((i) => i.enabled && i.points > 0 && i.points < i.minObs);
  if (short.length) {
    console.log("\n⚠ 이력이 minObs에 못 미치는 지표 — 실행하면 MISSING이 된다");
    for (const i of short) console.log(`  ${i.code}: ${i.points}점 < ${i.minObs}`);
  }

  if (warnings.length) {
    console.log(`\n경고 ${warnings.length}건`);
    for (const w of warnings) console.log(`  ${w.file}.ts: ${w.key} — ${w.message}`);
  }

  if (errors.length) {
    console.error(`\n오류 ${errors.length}건 — 고치기 전에는 계산하지 않는다`);
    for (const e of errors) console.error(`  ${e.file}.ts: ${e.key} — ${e.message}`);
    process.exit(1);
  }
  const g = provenanceSummary();
  console.log(
    `
숫자의 출처 — A(명세) ${g.A} · B(기관 대조) ${g.B} · C(관례) ${g.C} · ⚠ D(근거 없음) ${g.D}`,
  );
  console.log("  자세히: npm run gcrm -- provenance   ·   점검표: docs/GCRM_근거점검.md");

  console.log("\n오류 없음. 설정을 읽었고 지문을 찍었다. (DB는 건드리지 않았다)");
}

/**
 * ⚠ 근거 없이 정한 값을 **드러내 놓는 자리**(운영자 지시 2026-09-19).
 * 화면이 생기기 전까지는 여기가 그 화면이다.
 */
function provenance() {
  const only = argv.includes("--ungrounded") ? ungrounded() : PROVENANCE;
  if (asJson) {
    console.log(JSON.stringify(only, null, 2));
    return;
  }
  const g = provenanceSummary();
  console.log(`GCRM 숫자의 출처 — 전체 ${PROVENANCE.length}건`);
  console.log(`A 명세 ${g.A} · B 기관 대조 ${g.B} · C 관례 ${g.C} · ⚠ D 근거 없음 ${g.D}
`);

  const TITLE = {
    D: "⚠ D — 근거 없음. 내가 정했다",
    B: "B — 기관 관리체계·문헌과 대조함",
    C: "C — 업계·수학 관례",
    A: "A — 명세에 명시",
  };
  for (const grade of ["D", "B", "C", "A"]) {
    const rows = only.filter((x) => x.grade === grade);
    if (!rows.length) continue;
    console.log(`${"─".repeat(72)}
${TITLE[grade]}
`);
    for (const x of rows) {
      console.log(`  ${x.label}`);
      console.log(`    어디   ${x.where}`);
      console.log(`    근거   ${x.basis}`);
      if (x.impact) console.log(`    영향   ${x.impact}`);
      if (x.reviewPlan) console.log(`    검증   ${x.reviewPlan}`);
      for (const u of x.source ?? []) console.log(`    출처   ${u}`);
      console.log("");
    }
  }
  console.log("⚠ D등급은 민감도 분석(P9) 전에는 화면에 점수로 올리지 않는다.");
}

/**
 * ★ 실계산 — **운영 D1을 읽기만 한다.**
 *
 * ## ⚠ 왜 CLI인가
 * `/api/gcrm/run`은 `CRON_SECRET` 헤더를 요구하는 **쓰기** 경로다. 개발 중에 「지금 값이 얼마인가」를
 * 보려고 운영에 쓰면, 나중에 그 run이 진짜 계산인지 시험인지 구분할 수 없다.
 * 이 명령은 **아무것도 저장하지 않는다.**
 *
 * ⚠ 조립은 `lib/gcrm/series.ts` **한 벌**을 쓴다 — 운영(`features/gcrm/repository.ts`)과 같은 함수다.
 *   여기서 따로 합성하면 같은 지표가 두 값을 갖는다(2026-09-20(54)에 데인 자리).
 * ⚠ `axisHistory`·`signals`·`rawReadings`는 **비운다.** 없는 것을 지어내지 않는다 —
 *   그래서 방향·승격·R5/R6 진입이 막히고, **막힌 이유가 결과에 그대로 남는다.**
 */
function flagValue(name) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

/** 한국 날짜(운영과 같은 기준 — `api/gcrm/run`). */
function todayKst() {
  return new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);
}

/**
 * 운영 D1에서 계열 하나를 읽는다.
 * ⚠ `seriesKey`는 **설정 파일에서 온 상수**다(사용자 입력이 아니다).
 */
function d1Rows(seriesKey, since) {
  const sql =
    `SELECT seriesKey, date, value FROM MacroPoint ` +
    `WHERE seriesKey = '${seriesKey}' AND date >= '${since}' ORDER BY date ASC`;
  const raw = execSync(`npx wrangler d1 execute woodsman-db --remote --json --command "${sql}"`, {
    encoding: "utf8",
    maxBuffer: 512 * 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"],
  });
  // ⚠ wrangler가 배너를 먼저 찍는다. JSON은 첫 `[`부터다.
  const at = raw.indexOf("[");
  if (at < 0) throw new Error(`${seriesKey}: wrangler가 JSON을 내지 않았다`);
  const parsed = JSON.parse(raw.slice(at));
  const first = Array.isArray(parsed) ? parsed[0] : parsed;
  if (!first?.success) throw new Error(`${seriesKey}: 조회 실패`);
  return first.results ?? [];
}

function pct(x) {
  return x === undefined ? "  —" : `${(x * 100).toFixed(0)}%`.padStart(4);
}
function num(x, d = 1) {
  return x === undefined ? "—" : x.toFixed(d);
}

async function measure() {
  const { enabledIndicators } = await import("../src/lib/gcrm/config/indicators.ts");
  const { seriesKeysToRead, buildGcrmSeries } = await import("../src/lib/gcrm/series.ts");
  const { runPipeline } = await import("../src/lib/gcrm/pipeline.ts");
  const { initialRegimeState } = await import("../src/lib/gcrm/regime.ts");

  const errs = validateGcrmConfig().filter((i) => i.level === "error");
  // ⚠ 잘못된 설정으로 계산하지 않는다.
  if (errs.length) {
    for (const e of errs) console.error(`  ${e.file}.ts: ${e.key} — ${e.message}`);
    process.exit(1);
  }

  const asOf = flagValue("--as-of") ?? todayKst();
  const since = flagValue("--since") ?? "1990-01-01";
  const wanted = enabledIndicators().map((i) => i.series);
  const keys = seriesKeysToRead(wanted);

  console.error(`운영 D1에서 계열 ${keys.length}개를 읽는다 (${since} 이후) — 읽기만 한다`);
  const rows = [];
  const counts = new Map();
  for (const [n, k] of keys.entries()) {
    const got = d1Rows(k, since);
    counts.set(k, got.length);
    rows.push(...got);
    process.stderr.write(`\r  ${n + 1}/${keys.length}  ${k} ${got.length}행            `);
  }
  process.stderr.write("\n");

  const series = buildGcrmSeries(wanted, rows);
  const result = runPipeline({
    asOf,
    series,
    axisHistory: [],
    signals: {
      confirmedChannels: [],
      windPersistenceWeeks: 0,
      windImprovingWeeks: 0,
      fundingNormalWeeks: 0,
      tideDeteriorating: false,
    },
    rawReadings: [],
    prev: initialRegimeState(asOf),
  });

  if (asJson) {
    console.log(JSON.stringify({ asOf, since, counts: Object.fromEntries(counts), result }, null, 2));
    return;
  }

  const hash = await configHash(GCRM_CONFIG);
  console.log(`\nGCRM 실계산 — ${asOf} 기준 · config ${hash.slice(0, 12)} · git ${gitSha() ?? "없음"}`);
  console.log("⚠ 저장하지 않았다. 운영 D1을 읽기만 했다.\n");

  const LABEL = { tide: "조류", wind: "바람", wave: "파도" };
  for (const axis of ["tide", "wind", "wave"]) {
    const a = result.axes[axis];
    const c = result.confidence[axis];
    const dir = result.directions[axis];
    const score = a.status === "OK" ? num(a.score) : "자료 부족";
    console.log(
      `${LABEL[axis]}  ${String(score).padStart(10)}   커버리지 ${pct(a.coverage)} · 두께 ${pct(a.depth)}` +
        `   기둥 ${a.used.length}/${a.used.length + a.dropped.length}` +
        `   방향 ${dir ?? "—"}   신뢰도 ${c?.band ?? "—"}`,
    );
    for (const d of a.dropped) console.log(`      ⚠ 빠짐 ${d.pillar} — ${d.reason}`);
  }

  console.log(
    `\n종합 ${result.overall === undefined ? "—" : num(result.overall)}` +
      `  ·  RTE ${result.rte === undefined ? "—" : num(result.rte)}` +
      `  ·  정렬도 ${result.alignmentState?.state ?? "—"}` +
      `  ·  레짐 ${result.regime.state.code} ${result.regime.state.nameKo}`,
  );
  if (result.regime.blocked) console.log(`  ⚠ 막힌 이유 — ${result.regime.blocked}`);
  console.log(`  전이 판정 — ${result.regime.reason}`);

  console.log("\n기둥 (조류 축)");
  for (const p of result.pillarScalars) {
    const r = result.pillars.find((x) => x.pillar === p.pillar && x.axis === "tide");
    const s = r?.status === "OK" ? num(r.score) : "자료 부족";
    console.log(`  ${p.nameKo.padEnd(10)} ${String(s).padStart(10)}   반영률 ${pct(r?.coverage)}`);
  }

  const empty = wanted.filter((k) => !series.has(k));
  if (empty.length) {
    console.log(`\n⚠ 계열이 없는 지표 ${empty.length}개`);
    console.log(`  ${empty.join(" · ")}`);
  } else {
    console.log("\n⭐ 켜진 지표가 모두 계열을 가졌다.");
  }
}

if (command === "run") {
  await run();
} else if (command === "provenance") {
  provenance();
} else if (command === "measure") {
  await measure();
} else {
  console.log(
    [
      "GCRM v2 CLI",
      "",
      "  npm run gcrm -- run --dry-run          설정 검증 + config_hash",
      "  npm run gcrm -- run --dry-run --json   JSON으로",
      "",
      "  npm run gcrm -- provenance             숫자의 출처 대장(A~D 등급)",
      "  npm run gcrm -- provenance --ungrounded  ⚠ 근거 없이 정한 것만",
      "",
      "  npm run gcrm -- measure                ★ 운영 D1을 **읽기만** 해서 실계산 (저장 안 함)",
      "  npm run gcrm -- measure --as-of 2026-09-19 --since 2000-01-01",
      "  npm run gcrm -- measure --json",
      "",
      "⚠ measure는 축 이력·신호를 비운 채 계산한다 — 방향·승격이 막히는 것이 정상이다.",
    ].join("\n"),
  );
}

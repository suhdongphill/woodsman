/**
 * GCRM v2 CLI — 명세 §2-19의 `pms regime …`에 대응한다.
 *
 * 실행:
 *   npm run gcrm -- run --dry-run          설정을 읽고 검증하고 config_hash를 찍는다 (DB를 건드리지 않는다)
 *   npm run gcrm -- run --dry-run --json   같은 것을 JSON으로
 *
 * ## ⚠ 왜 `pms`가 아닌가
 * 명세는 파이썬 `pms regime run`을 전제하지만, 이 포털은 Next.js + Cloudflare Workers이고
 * 거시 데이터는 D1에 있다(조사 §0-1·§0-2). 파이썬 `pms`는 `rates_*` 다섯 표만 가진 별개 실험이라
 * 그쪽에 얹으면 **같은 지표가 두 값을 갖는다.** 그래서 포털의 기존 스크립트 관례
 * (`scripts/alfred-backfill.mjs` — tsx + wrangler)를 따른다.
 *
 * ## ⚠ 지금 할 수 있는 것은 P0까지다
 * 정규화·집계·레짐 판정은 P2부터다. `--dry-run` 없이 부르면 **조용히 아무것도 하지 않는 대신
 * 멈추고 그 사실을 말한다**(CLAUDE.md §3 — 조용한 실패를 만들지 않는다).
 */
import { execFileSync } from "node:child_process";

const { validateGcrmConfig, summarizeConfig } = await import("../src/lib/gcrm/config/validate.ts");
const { configHash } = await import("../src/lib/gcrm/config/hash.ts");
const { GCRM_CONFIG, CONFIG_PARTS } = await import("../src/lib/gcrm/config/index.ts");
const { GCRM_PILLARS, structuralCoverage, flattenPillar } = await import("../src/lib/gcrm/config/pillars.ts");
const { GCRM_INDICATOR_BY_CODE, GCRM_INDICATORS } = await import("../src/lib/gcrm/config/indicators.ts");
const { GATES } = await import("../src/lib/gcrm/config/model.ts");

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
      "지금은 --dry-run만 된다. 정규화·집계·레짐 판정은 P2부터다(docs/GCRM_설계점검_v2.md Part 4).\n" +
        "  npm run gcrm -- run --dry-run",
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
  console.log("\n오류 없음. 설정을 읽었고 지문을 찍었다. (DB는 건드리지 않았다)");
}

if (command === "run") {
  await run();
} else {
  console.log(
    [
      "GCRM v2 CLI",
      "",
      "  npm run gcrm -- run --dry-run          설정 검증 + config_hash",
      "  npm run gcrm -- run --dry-run --json   JSON으로",
      "",
      "아직 P0(설정과 스키마)까지다. 명세 Part 4의 P2부터가 계산이다.",
    ].join("\n"),
  );
}

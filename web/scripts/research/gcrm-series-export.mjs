/**
 * 연구용 — GCRM이 **실제로 보는 값**(파생·변환 적용 뒤)을 월말 값으로 내보낸다. 운영 D1은 읽기만 한다.
 *
 * ⚠ `MacroPoint`는 원값이다(전년비 등은 읽을 때 변환). 원값으로 상관을 재면 GCRM이 보는 것과 다른 것을 재게 된다.
 *    그래서 `scripts/gcrm.mjs measure`와 **같은 조립 함수**(`buildGcrmSeries`)를 쓰고,
 *    ⚠ 그 뒤 파이프라인과 **같은 변환**(`normalize.ts`의 `specOf` → `workingSeries`: 포털 변환 → GCRM 변환)을 건다.
 *    처음 판(2026-09-27)은 이 단계를 빠뜨려 전년비 계열이 원값(지수·잔액)으로 나갔고,
 *    추세끼리 수준 상관이 ±1.00으로 찍혔다 — 결과가 그럴듯해 보이지 않아 잡았다.
 *    창 상한(`maxWindow`)만은 풀었다 — 연구는 전체 이력을 쓴다.
 *
 * 실행: npx tsx scripts/research/gcrm-series-export.mjs <out.json>
 * 쓰는 곳: docs/연구_기타지표_유용성과중복.md
 */
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const { GCRM_INDICATORS, enabledIndicators } = await import("../../src/lib/gcrm/config/indicators.ts");
const { GCRM_PILLARS, flattenPillar } = await import("../../src/lib/gcrm/config/pillars.ts");
const { seriesKeysToRead, buildGcrmSeries } = await import("../../src/lib/gcrm/series.ts");
const { specOf, workingSeries } = await import("../../src/lib/gcrm/normalize.ts");

function d1Rows(seriesKey) {
  // ⚠ seriesKey는 설정 파일의 상수다(사용자 입력 아님).
  const sql = `SELECT seriesKey, date, value FROM MacroPoint WHERE seriesKey = '${seriesKey}' ORDER BY date ASC`;
  const raw = execSync(`npx wrangler d1 execute woodsman-db --remote --json --command "${sql}"`, {
    encoding: "utf8", maxBuffer: 512 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"],
  });
  const first = JSON.parse(raw.slice(raw.indexOf("[")))[0];
  if (!first?.success) throw new Error(`${seriesKey}: 조회 실패`);
  return first.results ?? [];
}

const pillarsOf = new Map();
for (const p of GCRM_PILLARS) {
  for (const m of flattenPillar(p)) {
    if (!m.indicator) continue;
    const list = pillarsOf.get(m.indicator) ?? [];
    list.push({ pillar: p.code, weight: m.weight, polarity: m.polarity });
    pillarsOf.set(m.indicator, list);
  }
}

const enabled = enabledIndicators();
const wanted = enabled.map((i) => i.series);
const keys = seriesKeysToRead(wanted);
const rows = [];
for (const [n, k] of keys.entries()) {
  rows.push(...d1Rows(k));
  process.stderr.write(`\r  ${n + 1}/${keys.length} ${k}            `);
}
process.stderr.write("\n");
const series = buildGcrmSeries(wanted, rows);

const out = { exportedAt: new Date().toISOString(), indicators: [] };
for (const ind of enabled) {
  const raw = series.get(ind.series) ?? [];
  const asOf = new Date().toISOString().slice(0, 10);
  const pts = workingSeries(raw, { ...specOf(ind), maxWindow: Number.MAX_SAFE_INTEGER }, asOf);
  const monthly = new Map(); // 월말 값: 그 달 마지막 관측
  for (const p of pts) monthly.set(String(p.date).slice(0, 7), p.value);
  out.indicators.push({
    code: ind.code, nameKo: ind.nameKo, series: ind.series, freq: ind.freq, polarity: ind.polarity,
    channels: ind.channels, evidence: ind.evidence, pillars: pillarsOf.get(ind.code) ?? [],
    monthly: Object.fromEntries(monthly),
  });
}
out.disabledOther = GCRM_INDICATORS.filter((i) => !i.enabled && !pillarsOf.has(i.code)).map((i) => i.code);
writeFileSync(process.argv[2], JSON.stringify(out));
console.error(`지표 ${out.indicators.length}개 → ${process.argv[2]}`);

/**
 * GCRM v2 — 설정 검증기 (단계 2: 「스키마 위반이면 즉시 실패하고 **어느 파일 어느 키**가 문제인지 말해야 한다」).
 *
 * ## ⚠ 조용한 실패를 만들지 않는다
 * 검증은 예외를 던지는 대신 **목록을 돌려준다.** 한 번에 하나씩 고치게 만들면 여섯 번 돌려야 한다.
 * 다만 `assertValidConfig()`는 하나라도 있으면 던진다 — 계산 진입점은 통과한 설정만 쓴다.
 *
 * ## ⚠ 오류와 경고를 가른다
 * - **오류(error)** — 계산이 틀린다. 예: 가중치 합이 1이 아니다, 없는 지표를 참조한다
 * - **경고(warning)** — 계산은 되지만 결과가 약하다. 예: 켜 둔 지표의 이력이 `minObs`에 못 미친다
 *   (그 지표는 실행할 때 `MISSING`이 된다 — 설정이 틀린 것은 아니다)
 *
 * ## ⚠ 포털 레지스트리와 대조한다 (`CLAUDE.md` §2-1)
 * 같은 숫자를 두 곳에 적었으면 사람이 아니라 **테스트가 맞춰 본다.**
 * `series`와 `portalTransform`은 `lib/macro/registry.ts`에 이미 있는 사실을 옮겨 적은 것이라
 * 어긋나면 여기서 잡는다.
 */
import { MACRO_INDICATORS } from "@/lib/macro/registry";
import { GCRM_CONFIG } from "./index";
import { GCRM_INDICATORS, type GcrmIndicator } from "./indicators";
import { GCRM_PILLARS, flattenPillar, designWeightSum } from "./pillars";
import { GCRM_CHANNELS, CONFIRMATION } from "./channels";
import { GCRM_REGIMES, REGIME_PRIORITY, REGIME_EDGES, DWELL_EXEMPT } from "./regimes";
import { WIND_TO_TIDE, ACUTE, STAGES } from "./promotion";
import { AXIS_WEIGHTS, HORIZON_WEIGHTS, GATES, EVIDENCE_FACTOR } from "./model";

/** 명세 파일 이름과 같게 둔다 — 사람이 어느 파일을 열어야 할지 바로 알아야 한다. */
export type ConfigFile = "model" | "indicators" | "pillars" | "channels" | "regimes" | "promotion";

export type ConfigIssue = {
  level: "error" | "warning";
  file: ConfigFile;
  /** 파일 안의 위치. 예: `liquidity.credit.high_yield` */
  key: string;
  message: string;
};

const EPS = 1e-9;
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

export function validateGcrmConfig(): ConfigIssue[] {
  const issues: ConfigIssue[] = [];
  const err = (file: ConfigFile, key: string, message: string) =>
    issues.push({ level: "error", file, key, message });
  const warn = (file: ConfigFile, key: string, message: string) =>
    issues.push({ level: "warning", file, key, message });

  // ── model ──────────────────────────────────────────────────────────────
  const core = sum(Object.values(AXIS_WEIGHTS.core));
  if (!near(core, 1)) err("model", "AXIS_WEIGHTS.core", `합이 1.00이어야 한다 — 지금 ${core.toFixed(4)}`);
  const trans = sum(Object.values(AXIS_WEIGHTS.transition));
  if (!near(trans, 1))
    err("model", "AXIS_WEIGHTS.transition", `합이 1.00이어야 한다 — 지금 ${trans.toFixed(4)}`);
  if (AXIS_WEIGHTS.transition.wave !== 0)
    err(
      "model",
      "AXIS_WEIGHTS.transition.wave",
      "⚠ 0이어야 한다. 파도가 RTE를 통해 레짐을 바꾸면 §2-11의 하드 게이트가 무의미해진다(B-10)",
    );
  for (const [axis, w] of Object.entries(HORIZON_WEIGHTS)) {
    const s = sum(Object.values(w));
    if (!near(s, 1)) err("model", `HORIZON_WEIGHTS.${axis}`, `합이 1.00이어야 한다 — 지금 ${s.toFixed(4)}`);
  }
  for (const [k, v] of Object.entries(GATES)) {
    if (v <= 0 || v > 1) err("model", `GATES.${k}`, `0과 1 사이여야 한다 — 지금 ${v}`);
  }

  // ── indicators ─────────────────────────────────────────────────────────
  const seen = new Set<string>();
  const byCode = new Map<string, GcrmIndicator>();
  const registry = new Map(MACRO_INDICATORS.map((i) => [i.key, i]));

  for (const ind of GCRM_INDICATORS) {
    const at = ind.code;
    if (seen.has(ind.code)) err("indicators", at, "코드가 중복이다");
    seen.add(ind.code);
    byCode.set(ind.code, ind);

    if (ind.polarity !== 1 && ind.polarity !== -1)
      err("indicators", `${at}.polarity`, "+1 또는 −1이어야 한다");
    if (!(ind.evidence in EVIDENCE_FACTOR))
      err("indicators", `${at}.evidence`, `알 수 없는 근거 등급: ${ind.evidence}`);
    const [lo, hi] = ind.winsor;
    if (!(lo >= 0 && hi <= 1 && lo < hi))
      err("indicators", `${at}.winsor`, `0 ≤ 하한 < 상한 ≤ 1 이어야 한다 — 지금 [${lo}, ${hi}]`);
    if (ind.minObs <= 0) err("indicators", `${at}.minObs`, "0보다 커야 한다");
    if (ind.maxWindow <= ind.minObs)
      err("indicators", `${at}.maxWindow`, `minObs(${ind.minObs})보다 커야 한다 — 지금 ${ind.maxWindow}`);
    if (!ind.enabled && !ind.disabledReason)
      err("indicators", `${at}.disabledReason`, "⚠ 끈 지표에는 이유를 반드시 적는다(조사에서 되살릴 때 근거가 된다)");
    if (ind.points > 0 && !ind.historyStart)
      err("indicators", `${at}.historyStart`, `points가 ${ind.points}인데 historyStart가 없다`);
    if (ind.points === 0 && ind.enabled && !ind.historyNote)
      err(
        "indicators",
        `${at}.points`,
        "켜 두었는데 이력이 0이다. 파생이라 저장하지 않는 것이면 historyNote에 적는다 — 「이력이 없다」와 「저장하지 않는다」는 다른 것이다",
      );

    if (!ind.enabled) continue;

    // ⚠ 포털 레지스트리 대조
    const reg = registry.get(ind.series);
    if (!reg) {
      err("indicators", `${at}.series`, `포털 레지스트리에 「${ind.series}」가 없다(lib/macro/registry.ts)`);
    } else {
      if (reg.transform !== ind.portalTransform)
        err(
          "indicators",
          `${at}.portalTransform`,
          `레지스트리는 "${reg.transform}"인데 여기는 "${ind.portalTransform}"이다 — 한쪽이 틀렸다`,
        );
      if (ind.seriesId && reg.sourceId && reg.sourceId !== ind.seriesId)
        err("indicators", `${at}.seriesId`, `레지스트리는 "${reg.sourceId}"다`);
    }

    if (ind.points > 0 && ind.points < ind.minObs)
      warn(
        "indicators",
        `${at}.points`,
        `이력 ${ind.points}점이 minObs ${ind.minObs}에 못 미친다 — 실행하면 MISSING이 된다`,
      );
    if (ind.points === 0 && ind.historyNote === undefined)
      warn("indicators", `${at}.points`, "운영 D1에 값이 없다");
  }

  // ── pillars ────────────────────────────────────────────────────────────
  const pillarCodes = new Set<string>();
  const axisSum = sum(GCRM_PILLARS.map((p) => p.axisWeight));
  if (!near(axisSum, 1))
    err("pillars", "axisWeight", `10개 기둥의 합이 1.00이어야 한다 — 지금 ${axisSum.toFixed(4)}`);

  for (const p of GCRM_PILLARS) {
    if (pillarCodes.has(p.code)) err("pillars", p.code, "기둥 코드가 중복이다");
    pillarCodes.add(p.code);

    if (p.polarity !== "favorable" && p.polarity !== "stress")
      err("pillars", `${p.code}.polarity`, "favorable 또는 stress여야 한다");

    const sw = sum(Object.values(p.summaryWeights));
    if (!near(sw, 1))
      err("pillars", `${p.code}.summaryWeights`, `합이 1.00이어야 한다 — 지금 ${sw.toFixed(4)}`);

    const design = designWeightSum(p);
    if (!near(design, 1))
      err(
        "pillars",
        `${p.code}`,
        `설계 가중치의 합이 1.00이어야 한다 — 지금 ${design.toFixed(4)}. ` +
          "⚠ 못 채우는 자리를 지우면 커버리지가 언제나 100%가 된다",
      );

    for (const m of flattenPillar(p)) {
      if (m.indicator === null) {
        if (!m.reason) err("pillars", `${p.code}.${m.path}`, "unavailable에는 이유가 필요하다");
        continue;
      }
      const ind = byCode.get(m.indicator);
      if (!ind) {
        err("pillars", `${p.code}.${m.path}`, `indicators에 없는 지표를 참조한다: ${m.indicator}`);
        continue;
      }
      if (m.polarity !== undefined && !m.polarityReason)
        err(
          "pillars",
          `${p.code}.${m.path}`,
          "⚠ 부호를 덮어썼으면 polarityReason을 적는다 — 이유 없는 부호 뒤집기가 가장 찾기 어려운 버그다",
        );
      if (m.polarityConflict)
        err(
          "pillars",
          `${p.code}.${m.path}`,
          `같은 기둥 안에서 「${m.indicator}」에 서로 다른 부호를 줬다 — 합칠 수 없다`,
        );
      if (m.weight <= EPS) warn("pillars", `${p.code}.${m.path}`, "무게가 0이다");
    }

    const cov = flattenPillar(p)
      .filter((m) => m.indicator !== null && byCode.get(m.indicator)?.enabled)
      .reduce((s, m) => s + m.weight, 0);
    if (cov < GATES.pillarMinCoverage)
      warn(
        "pillars",
        p.code,
        `구조적 커버리지 ${(cov * 100).toFixed(0)}%가 게이트 ${(GATES.pillarMinCoverage * 100).toFixed(0)}% 미만이다 — ` +
          "지금 실행하면 이 기둥은 INSUFFICIENT다",
      );
  }

  // ── channels ───────────────────────────────────────────────────────────
  const chCodes = new Set(GCRM_CHANNELS.map((c) => c.code));
  if (chCodes.size !== GCRM_CHANNELS.length) err("channels", "code", "채널 코드가 중복이다");
  for (const c of CONFIRMATION.weightedCombo) {
    if (!chCodes.has(c)) err("channels", "CONFIRMATION.weightedCombo", `없는 채널이다: ${c}`);
  }
  if (CONFIRMATION.minChannels > chCodes.size)
    err("channels", "CONFIRMATION.minChannels", "채널 수보다 많은 확인을 요구한다 — 영원히 승격하지 않는다");
  for (const ind of GCRM_INDICATORS) {
    for (const c of ind.channels) {
      if (!chCodes.has(c)) err("indicators", `${ind.code}.channels`, `없는 채널이다: ${c}`);
    }
  }

  // ── regimes ────────────────────────────────────────────────────────────
  const regimeCodes = new Set(GCRM_REGIMES.map((r) => r.code));
  for (const r of GCRM_REGIMES) {
    for (const [kind, conds] of [
      ["enter", r.enter],
      ["exit", r.exit],
    ] as const) {
      conds.forEach((c, i) => {
        if (!pillarCodes.has(c.pillar))
          err("regimes", `${r.code}.${kind}[${i}]`, `없는 기둥을 참조한다: ${c.pillar}`);
        const need = c.op === "between" ? 2 : 1;
        if (c.value.length !== need)
          err("regimes", `${r.code}.${kind}[${i}]`, `${c.op}에는 값이 ${need}개 필요하다`);
        if (c.op === "between" && c.value[0] >= c.value[1])
          err("regimes", `${r.code}.${kind}[${i}]`, "between의 하한이 상한보다 크거나 같다");
      });
    }
    if (r.code !== "R0" && r.enter.length === 0)
      err("regimes", `${r.code}.enter`, "진입 조건이 없다 — R0 말고는 조건이 있어야 한다");
    if (r.requires?.channels) {
      for (const c of r.requires.channels) {
        if (!chCodes.has(c as never)) err("regimes", `${r.code}.requires.channels`, `없는 채널이다: ${c}`);
      }
    }
    if (r.minDwellDays < 0) err("regimes", `${r.code}.minDwellDays`, "음수일 수 없다");
  }
  for (const code of regimeCodes) {
    if (!REGIME_PRIORITY.includes(code))
      err("regimes", "REGIME_PRIORITY", `${code}이(가) 우선순위 목록에 없다 — 동시 충족 시 판정이 갈린다`);
    if (!REGIME_EDGES[code]) err("regimes", "REGIME_EDGES", `${code}의 전이 목록이 없다`);
  }
  for (const [from, tos] of Object.entries(REGIME_EDGES)) {
    for (const to of tos) {
      if (!regimeCodes.has(to)) err("regimes", `REGIME_EDGES.${from}`, `없는 레짐으로 간다: ${to}`);
    }
  }
  if (!DWELL_EXEMPT.includes("R6"))
    err("regimes", "DWELL_EXEMPT", "⚠ R6은 체류 기간과 무관하게 언제든 진입할 수 있어야 한다");
  for (const r of GCRM_REGIMES) {
    if (r.code === "R0" || r.code === "R6") continue;
    if (!REGIME_EDGES[r.code].includes("R6"))
      err("regimes", `REGIME_EDGES.${r.code}`, "R6으로 가는 길이 막혀 있다 — 위기는 어디서든 올 수 있다");
  }

  // ── promotion ──────────────────────────────────────────────────────────
  STAGES.forEach((s, i) => {
    if (s.stage !== i) err("promotion", `STAGES[${i}]`, `단계 번호가 ${i}이어야 한다 — 지금 ${s.stage}`);
  });
  for (const code of WIND_TO_TIDE.structuralIndicators) {
    if (!byCode.has(code))
      err("promotion", "WIND_TO_TIDE.structuralIndicators", `indicators에 없는 지표다: ${code}`);
  }
  const anyStructuralEnabled = WIND_TO_TIDE.structuralIndicators.some((c) => byCode.get(c)?.enabled);
  if (!anyStructuralEnabled)
    err(
      "promotion",
      "WIND_TO_TIDE.structuralIndicators",
      "켜진 구조 지표가 하나도 없다 — 조류 이동으로 승격할 길이 없다",
    );
  for (const t of ACUTE.thresholds) {
    const ind = byCode.get(t.indicator);
    if (!ind) {
      err("promotion", `ACUTE.${t.indicator}`, "indicators에 없는 지표다");
      continue;
    }
    if (!chCodes.has(t.channel)) err("promotion", `ACUTE.${t.indicator}.channel`, `없는 채널이다: ${t.channel}`);
    if (!ind.channels.includes(t.channel))
      err(
        "promotion",
        `ACUTE.${t.indicator}.channel`,
        `지표의 채널(${ind.channels.join(", ") || "없음"})과 다르다 — 채널을 두 곳에 다르게 적으면 확인 수가 틀린다`,
      );
    if (!ind.enabled) warn("promotion", `ACUTE.${t.indicator}`, "꺼 둔 지표에 급성 경보 임계가 걸려 있다");
  }
  if (!ACUTE.neverChangesRegime)
    err("promotion", "ACUTE.neverChangesRegime", "⚠ 급성 경보는 레짐을 바꾸지 않는다(§2-12)");

  return issues;
}

/** 오류가 하나라도 있으면 던진다. 계산 진입점은 이것을 먼저 부른다. */
export function assertValidConfig(): void {
  const issues = validateGcrmConfig();
  const errors = issues.filter((i) => i.level === "error");
  if (errors.length === 0) return;
  const lines = errors.map((e) => `  ${e.file}.ts: ${e.key} — ${e.message}`);
  throw new Error(`GCRM 설정이 잘못됐다(${errors.length}건):\n${lines.join("\n")}`);
}

/** `--dry-run`이 화면에 찍는 요약. */
export function summarizeConfig() {
  const enabled = GCRM_INDICATORS.filter((i) => i.enabled);
  return {
    version: GCRM_CONFIG.model.MODEL_VERSION,
    indicators: { total: GCRM_INDICATORS.length, enabled: enabled.length },
    pillars: GCRM_PILLARS.length,
    channels: GCRM_CHANNELS.length,
    regimes: GCRM_REGIMES.length,
  };
}

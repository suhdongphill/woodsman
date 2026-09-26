/**
 * IMF 데이터 포털(SDMX 2.1) 계열을 받아 오고 해석한다. 무료·키 없음(2026-09-26 확인).
 *
 * ## 왜 따로 두나 (2026-09-26, GCRM 자료 채우기 ②)
 * GCRM 「달러 네트워크 지배력」의 `global_reserve_share`(가중 0.15)가 COFER — 세계 외환보유액 중 달러 비중이다.
 * FRED에 없다. IMF가 2025년에 옛 데이터 서비스를 닫고 `api.imf.org`(SDMX)로 옮겼다.
 *
 * ⚠ 이 파일은 **D1·워커 전용 모듈을 import 하지 않는다**(`treasury-fetch.ts`와 같은 이유) —
 *   워커에서 막히면(재무부처럼 525) 같은 파일을 GitHub Actions 스크립트가 그대로 부를 수 있어야 한다.
 *
 * ## `sourceId` 꼴
 * `데이터플로:시리즈키` — 예: `COFER:G001.AFXRA.CI_USD.SHRO_PT.Q`
 * (세계 · 배분된 외환보유액 · 달러 · 비중(%) · 분기). 기관은 `IMF.STA`로 고정한다.
 *
 * ## ⚠ 날짜는 **분기 첫날**로 적는다
 * FRED 분기 계열(OPHNFB 등)과 같은 눈금이다. `2026-Q1` → `2026-01-01`.
 * 발표는 분기 끝나고 약 3개월 뒤라, 첫날 기준으로 보면 최신 값이 늘 9개월쯤 묵어 보인다 — 카탈로그 `staleDays`가 그 몫이다.
 */
import type { SeriesPoint } from "./series";

const IMF_BASE = "https://api.imf.org/external/sdmx/2.1/data";
const IMF_AGENCY = "IMF.STA";
const FETCH_TIMEOUT_MS = 20_000;

/** `fetchImf`가 아는 소스 ID. ⚠ 카탈로그의 IMF 지표는 이 중 하나여야 한다(테스트가 대조한다). */
export const IMF_SOURCE_IDS = ["COFER:G001.AFXRA.CI_USD.SHRO_PT.Q"] as const;

/** `2026-Q1` · `2026-03`(월) · `2026`(연) → 기간 첫날. 모르는 꼴이면 `undefined`. */
export function imfPeriodToDate(period: string): string | undefined {
  const q = /^(\d{4})-Q([1-4])$/.exec(period);
  if (q) return `${q[1]}-${String((Number(q[2]) - 1) * 3 + 1).padStart(2, "0")}-01`;
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (m) return `${m[1]}-${m[2]}-01`;
  if (/^\d{4}$/.test(period)) return `${period}-01-01`;
  return undefined;
}

/** `2025-06-15` → `2025-Q2`. 요청 범위(`startPeriod`)에 쓴다. */
export function dateToImfQuarter(date: string): string {
  const [y, m] = date.split("-").map(Number);
  return `${y}-Q${Math.floor((m - 1) / 3) + 1}`;
}

/**
 * SDMX-CSV(`detail=dataonly`)를 점으로 바꾼다.
 * ⚠ 열 위치를 믿지 않고 **머리글 이름**(`TIME_PERIOD`·`OBS_VALUE`)으로 찾는다.
 * ⚠ 따옴표가 든 줄은 받지 않는다 — `dataonly`에는 설명문이 없어야 한다. 섞여 오면 조용히 자르지 않고 던진다.
 * ⚠ 값이 비었거나 숫자가 아닌 행은 결측으로 건너뛴다. 날짜가 겹치면 던진다(키가 여러 계열을 받았다는 뜻).
 */
export function parseImfCsv(csv: string): SeriesPoint[] {
  const lines = csv.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) throw new Error("IMF 응답이 비었습니다");
  if (lines.some((l) => l.includes('"'))) throw new Error("IMF 응답에 따옴표가 있습니다 — detail=dataonly가 아닌 응답입니다");
  const head = lines[0].split(",");
  const iPeriod = head.indexOf("TIME_PERIOD");
  const iValue = head.indexOf("OBS_VALUE");
  if (iPeriod < 0 || iValue < 0) throw new Error("IMF 응답에 TIME_PERIOD·OBS_VALUE 열이 없습니다");

  const out: SeriesPoint[] = [];
  const seen = new Set<string>();
  for (const line of lines.slice(1)) {
    const cells = line.split(",");
    const raw = cells[iValue]?.trim();
    if (!raw) continue;
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;
    const date = imfPeriodToDate(cells[iPeriod]?.trim() ?? "");
    if (!date) throw new Error(`IMF 기간 꼴을 모릅니다: ${cells[iPeriod]}`);
    if (seen.has(date)) throw new Error(`IMF 응답에 ${date}가 두 번 있습니다 — 시리즈 키가 여러 계열을 받았습니다`);
    seen.add(date);
    out.push({ date, value });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * IMF 계열 한 개. ⚠ 결과가 비면 성공으로 넘기지 않는다(조용한 실패 금지).
 * 5xx·시간 초과는 3초 뒤 한 번만 다시 받는다(재무부 수집기와 같은 규칙).
 */
export async function fetchImf(sourceId: string, from: string): Promise<SeriesPoint[]> {
  if (!(IMF_SOURCE_IDS as readonly string[]).includes(sourceId)) throw new Error(`IMF 소스 ID를 모릅니다: ${sourceId}`);
  const [flow, key] = sourceId.split(":");
  const qs = new URLSearchParams({ detail: "dataonly", startPeriod: dateToImfQuarter(from) });
  const url = `${IMF_BASE}/${IMF_AGENCY},${flow}/${key}?${qs}`;

  let res: Response | undefined;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; WoodsmanMacroBot/1.0)",
          Accept: "application/vnd.sdmx.data+csv;version=1.0.0",
        },
      });
      if (res.ok || res.status < 500) break;
      console.error(`[imf] ${flow} 응답 ${res.status} (${attempt}회)`);
    } catch (error) {
      console.error(`[imf] ${flow} 받기 실패 (${attempt}회)`, error);
      if (attempt === 2) throw error;
    } finally {
      clearTimeout(timer);
    }
    if (attempt === 1) await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  if (!res || !res.ok) throw new Error(`IMF ${flow} 응답 ${res?.status ?? "없음"}`);
  const points = parseImfCsv(await res.text());
  if (points.length === 0) throw new Error(`IMF ${sourceId}: ${qs.get("startPeriod")} 이후 값이 없습니다`);
  return points;
}

/**
 * 주도주 화면(`/leaders`)의 판단 — 순수 함수.
 *
 * ## 무엇인가 (2026-09-25)
 * 볼트 주도주 모니터(`D:\Woodsman\Investor\_apps\주도주 모니터.html`)를 포털로 옮긴다. 판정(cls·tier·why·flag)은
 * **볼트가 낸 그대로**다 — 규칙은 볼트 `05_Methodology/주도주 판별 프레임 — 4단계·2×2 설계서.md`.
 * 포털이 여기서 하는 일은 셋뿐이다: ① 읽히는 한 문장 만들기 ② **지난 실행과 비교한 판정 변화**(볼트 화면에 없던 것)
 * ③ 운영 포트폴리오 보유 종목과 잇기.
 *
 * ⚠ JSON 칸을 못 읽으면 그 부분만 비우고 **사유를 남긴다** — 조용히 빈 화면을 「데이터 없음」처럼 보이게 하지 않는다.
 * ⚠ 수집일을 반드시 보인다. `LEADERS_STALE_DAYS`를 넘으면 「오래됨」.
 */

/** 볼트 주도주 판정은 주 1회 돈다 — 한 주 + 하루. `holding-tags`와 같은 기준. */
export const LEADERS_STALE_DAYS = 8;

export type LeaderClass = "leader" | "candidate" | "watch" | "out" | "unknown";
export const CLASS_ORDER: LeaderClass[] = ["leader", "candidate", "watch", "out", "unknown"];

export type RunRow = { id: string; collectedAt: string; meta: string; fit: string | null };
export type GroupRow = {
  groupId: string;
  ord: number;
  name: string;
  why: string | null;
  src: string | null;
  rsMedianM3: number | null;
  breadthHigh: number | null;
  leaders: number;
  prime: number;
  supply: string | null;
  etf: string | null;
};
export type MemberRow = {
  groupId: string;
  ticker: string;
  ord: number;
  name: string;
  role: string | null;
  mkt: string | null;
  cls: string | null;
  tier: string | null;
  why: string | null;
  flag: string | null;
  rs3m: number | null;
  offHigh: number | null;
  revYoy: number | null;
  accel: number | null;
  detail: string | null;
};

type Periods = { m1?: number | null; m3?: number | null; m6?: number | null; m12?: number | null };
export type MemberDetail = {
  price?: { last?: number; asof?: string; rs?: Periods; off_high?: number; capture?: { up?: number; down?: number; spread?: number } };
  fund?: { op_margin?: number | null; leverage?: number | null; quarter?: string | null; inc_margin?: number | null; price_driven?: boolean; why_missing?: string | null; src?: string | null };
  eps?: { dir?: string; detail?: string } | null;
  flow?: { fi20?: number; pct20?: number; unit?: string; as_of?: string } | null;
};

export type Supply = { basis?: string; label?: string };
export type Etf = { ticker: string; name?: string; dv_ratio?: number | null; proxy?: boolean };

export type Member = Omit<MemberRow, "detail" | "flag"> & {
  flags: string[];
  detail: MemberDetail;
  /** 운영 포트폴리오에 공개된 종목인가 */
  held: boolean;
  /** 지난 실행의 판정. 지난 실행이 없거나 그때 없던 종목이면 undefined */
  prevCls?: string | null;
};

export type Group = Omit<GroupRow, "supply" | "etf"> & { supply?: Supply; etf: Etf[]; members: Member[] };

export type ChangeKind = "new_leader" | "dropped_leader" | "moved";
export type Change = { ticker: string; name: string; group: string; from: string | null; to: string | null; kind: ChangeKind };

export type FitStat = { n: number; mean: number; win: number; t: number };
export type Fit = {
  /** 모든 관측의 평균 — 이게 없으면 상승장 표본에서 모든 판정이 좋아 보인다 */
  baseline?: FitStat;
  /** 주도주 − 제외 (3개월 평균, %p). 분류가 방향을 가리켰는지의 한 숫자 */
  spread?: number;
  span?: [string, string];
  rebalances?: number;
  observations?: number;
  byClass: { cls: LeaderClass; m3: FitStat }[];
  caveats: string[];
};

export type LeadersView = {
  runId: string;
  collectedAt: string;
  stale: boolean;
  daysOld: number;
  counts: Record<LeaderClass, number>;
  total: number;
  groups: Group[];
  headline: string;
  /** ★★ 종목 이름 */
  prime: string[];
  /** 가격 주도 성장(증분 마진 ≥80%) 종목 이름 */
  priceDriven: string[];
  changes: Change[];
  prevRunId?: string;
  fit?: Fit;
  /** 읽지 못한 JSON 칸 — 화면이 밝힌다 */
  problems: string[];
};

function parse<T>(raw: string | null, what: string, problems: string[]): T | undefined {
  if (raw == null) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    problems.push(what);
    return undefined;
  }
}

/** "005930.KS" → "005930", "NVDA" → "NVDA". 운영 포트폴리오 티커와 맞추기 위해서. */
export function baseTicker(t: string): string {
  return t.replace(/\.(KS|KQ)$/i, "").toUpperCase();
}

function daysBetween(fromDay: string, toDay: string): number {
  return Math.round((Date.parse(`${toDay}T00:00:00Z`) - Date.parse(`${fromDay}T00:00:00Z`)) / 86_400_000);
}

const CLASS_NAME: Record<string, string> = {
  leader: "주도주",
  candidate: "후발 후보",
  watch: "추격 주의",
  out: "제외",
  unknown: "판정 불가",
};
export const className = (c: string | null | undefined) => (c ? (CLASS_NAME[c] ?? c) : "—");

export function buildLeadersView(input: {
  run: RunRow;
  groups: GroupRow[];
  members: MemberRow[];
  prev?: { id: string; members: Pick<MemberRow, "ticker" | "groupId" | "cls">[] };
  /** 운영 포트폴리오에 **공개된** 종목 티커 */
  heldTickers?: Iterable<string>;
  today: string;
}): LeadersView {
  const problems: string[] = [];
  const held = new Set([...(input.heldTickers ?? [])].map(baseTicker));
  const prevCls = new Map((input.prev?.members ?? []).map((m) => [`${m.groupId}|${m.ticker}`, m.cls]));

  const members: Member[] = input.members.map((m) => {
    const { detail: rawDetail, flag, ...rest } = m;
    const key = `${m.groupId}|${m.ticker}`;
    return {
      ...rest,
      flags: (flag ?? "").split(" · ").map((s) => s.trim()).filter(Boolean),
      detail: parse<MemberDetail>(rawDetail, `${m.ticker} 상세`, problems) ?? {},
      held: held.has(baseTicker(m.ticker)),
      prevCls: input.prev ? (prevCls.has(key) ? prevCls.get(key) : undefined) : undefined,
    };
  });

  const groups: Group[] = [...input.groups]
    .sort((a, b) => a.ord - b.ord)
    .map((g) => ({
      ...g,
      supply: parse<Supply>(g.supply, `${g.name} 수급`, problems),
      etf: parse<Etf[]>(g.etf, `${g.name} ETF`, problems) ?? [],
      members: members.filter((m) => m.groupId === g.groupId).sort((a, b) => a.ord - b.ord),
    }));

  const counts = Object.fromEntries(CLASS_ORDER.map((c) => [c, 0])) as Record<LeaderClass, number>;
  for (const m of members) if (m.cls && m.cls in counts) counts[m.cls as LeaderClass]++;

  const prime = members.filter((m) => m.cls === "leader" && m.tier === "prime").map((m) => m.name);
  const priceDriven = members.filter((m) => m.detail.fund?.price_driven).map((m) => m.name);

  // ── 판정 변화: 같은 레이어·같은 종목끼리만 비교한다(레이어를 옮긴 종목은 새 종목으로 본다) ──
  const changes: Change[] = [];
  if (input.prev) {
    for (const m of members) {
      if (m.prevCls === undefined) continue; // 지난번에 없던 종목 — 변화가 아니라 편입이다
      if ((m.prevCls ?? null) === (m.cls ?? null)) continue;
      const kind: ChangeKind =
        m.cls === "leader" ? "new_leader" : m.prevCls === "leader" ? "dropped_leader" : "moved";
      const group = groups.find((g) => g.groupId === m.groupId)?.name ?? m.groupId;
      changes.push({ ticker: m.ticker, name: m.name, group, from: m.prevCls ?? null, to: m.cls, kind });
    }
    const rank: Record<ChangeKind, number> = { new_leader: 0, dropped_leader: 1, moved: 2 };
    changes.sort((a, b) => rank[a.kind] - rank[b.kind]);
  }

  // ── 읽히는 한 문장 — 숫자로만 말한다(해석은 붙이지 않는다) ──
  const ranked = groups.filter((g) => g.rsMedianM3 != null).sort((a, b) => (b.rsMedianM3 ?? 0) - (a.rsMedianM3 ?? 0));
  const fmt = (x: number) => `${x >= 0 ? "+" : ""}${x.toFixed(1)}%p`;
  const parts: string[] = [];
  if (ranked.length >= 2) {
    const top = ranked[0];
    const bottom = ranked[ranked.length - 1];
    parts.push(
      `3개월 상대강도로 가장 앞선 칸은 ${top.name}(중앙값 ${fmt(top.rsMedianM3!)}), 가장 뒤처진 칸은 ${bottom.name}(${fmt(bottom.rsMedianM3!)})이다.`,
    );
  }
  parts.push(
    `관찰 ${members.length}곳 중 4단계를 모두 통과한 주도주는 ${counts.leader}곳` +
      (prime.length ? `, 그중 가속·신고가권 ★★는 ${prime.join(" · ")}.` : "."),
  );
  if (priceDriven.length) {
    parts.push(`${priceDriven.join(" · ")}의 성장은 물량이 아니라 가격이다(증분 마진 80% 이상).`);
  }

  // meta 는 지금 화면이 쓰지 않는다(수급 설명은 화면 문장으로 고정 — 볼트 문구에 필드 이름이 섞여 있다).
  const fitRaw = parse<{
    span?: [string, string];
    rebalances?: number;
    observations?: number;
    by_class?: Record<string, { m3?: FitStat }>;
    baseline?: FitStat;
    caveats?: string[];
  }>(input.run.fit, "실증 적합도", problems);
  const lead = fitRaw?.by_class?.leader?.m3?.mean;
  const out = fitRaw?.by_class?.out?.m3?.mean;
  const fit: Fit | undefined = fitRaw?.by_class
    ? {
        baseline: fitRaw.baseline,
        spread: lead != null && out != null ? Math.round((lead - out) * 10) / 10 : undefined,
        span: fitRaw.span,
        rebalances: fitRaw.rebalances,
        observations: fitRaw.observations,
        byClass: CLASS_ORDER.filter((c) => fitRaw.by_class?.[c]?.m3).map((c) => ({ cls: c, m3: fitRaw.by_class![c].m3! })),
        // 볼트 문장의 **강조 표시**(마크다운)를 걷어 낸다 — 화면에 별표가 그대로 찍힌다.
        caveats: (fitRaw.caveats ?? []).map((s) => s.replaceAll("**", "")),
      }
    : undefined;

  const runDay = input.run.id;
  const daysOld = daysBetween(runDay, input.today);
  return {
    runId: runDay,
    collectedAt: input.run.collectedAt,
    stale: daysOld > LEADERS_STALE_DAYS,
    daysOld,
    counts,
    total: members.length,
    groups,
    headline: parts.join(" "),
    prime,
    priceDriven,
    changes,
    prevRunId: input.prev?.id,
    fit,
    problems,
  };
}

/** 막대 폭(%) — 0을 가운데 두고 좌우로. 가장 큰 절댓값이 절반 폭을 채운다. */
export function divergingWidth(value: number, maxAbs: number): number {
  if (!(maxAbs > 0)) return 0;
  return Math.min(50, (Math.abs(value) / maxAbs) * 50);
}

/**
 * 수급(백만원) → 사람이 읽는 금액. 1조 이상은 조, 그 밑은 억. 부호는 앞에(−는 전각 마이너스).
 * ⚠ 단위가 백만원이다(KIS 투자자별 매매동향) — 원으로 착각하면 백만 배 틀린다.
 */
export function formatFlowMillions(v: number | null | undefined): string | null {
  if (v == null || !Number.isFinite(v)) return null;
  const sign = v > 0 ? "+" : v < 0 ? "−" : "";
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${sign}${(a / 1_000_000).toFixed(2)}조`;
  return `${sign}${Math.round(a / 100).toLocaleString()}억`;
}

/** 볼트 수급 설명에서 「프록시 — 」·「실측 — 」 머리를 뗀다 — 화면은 그 구분을 칩으로 따로 보인다. */
export function supplyText(label: string | undefined): string | undefined {
  return label?.replace(/^(프록시|실측)\s*[—-]\s*/, "");
}

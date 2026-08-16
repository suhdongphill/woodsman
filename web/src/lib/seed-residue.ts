/**
 * 운영에 남아 있는 **시드(예시) 데이터**를 찾아낸다 — 순수 함수.
 *
 * ## 왜 필요한가 (2026-08-16, 실제 사고)
 * 대표 포트폴리오 종목을 전부 지웠는데 `/portfolio`의 계좌 곡선은 그대로
 * **평가액 76,540,000원 · +12.56%** 를 보여주고 있었다. 값을 대조해 보니
 * `seed-data.ts`의 예시값과 **한 자리도 안 틀리고 같았다** — 시드가 운영 D1에 살아 있었다.
 *
 * ⚠ 이건 2026-08-15에 걷어낸 목업 시세와 **같은 종류의 사고**다. 다만 더 나쁘다.
 *    계좌 공개는 이 사이트가 신뢰를 버는 자산인데(운영지침 §5), 지어낸 숫자를
 *    자기 계좌라고 내보이고 있었던 것이다.
 *
 * ## 왜 "지우기"가 아니라 "찾기"인가
 * 지우는 것은 사람이 정한다. 시드 값을 그대로 두고 쓰기로 했을 수도 있고,
 * 우연히 같은 값을 실제로 기록했을 수도 있다(가능성은 낮지만 우리가 단정할 일이 아니다).
 * ⚠ **프로그램은 "이건 예시값과 똑같습니다"까지만 말한다.**
 *
 * ## 어떻게 찾나
 * **완전 일치**로만 본다(날짜 + 모든 숫자). 한 칸이라도 손댔으면 그건 이미 사람의 기록이다.
 * 느슨하게 잡으면 진짜 기록을 예시라고 부르게 되고, 그 경고는 곧 무시된다.
 */
import {
  seedAccountSnapshots,
  seedComments,
  seedJournalEntries,
  seedModelHoldings,
  seedPosts,
} from "./seed-data";

export type SeedResidueKind = "snapshot" | "journal" | "holding" | "post" | "comment";

export type SeedResidue = {
  kind: SeedResidueKind;
  /** 화면에 그대로 쓰는 이름 */
  label: string;
  /** 몇 건이 시드와 같은가 */
  matched: number;
  /** 그 표에 지금 몇 건이 있나 — "7건 중 7건"처럼 적기 위해 */
  total: number;
  /** 어디서 지우나 */
  where: string;
};

/** 계좌 스냅숏 한 줄 — DB에서 읽어 온 모양. */
export type SnapshotRow = {
  /** YYYY-MM-DD */
  date: string;
  principal: number;
  value: number;
  income: number;
};

export type JournalRow = { date: string; title: string };

export type HoldingRow = { name: string; ticker?: string; targetWeight?: number };

export type PostRow = { slug: string; title: string };

export type CommentRow = { authorName?: string; body: string };

function snapshotKey(s: SnapshotRow): string {
  return `${s.date}|${s.principal}|${s.value}|${s.income}`;
}

/** ⚠ 시드 값에서 만든 지문. 시드가 바뀌면 여기도 자동으로 따라간다(두 번 적지 않는다). */
const SEED_SNAPSHOT_KEYS = new Set(
  seedAccountSnapshots.map((s) =>
    snapshotKey({ date: s.date, principal: s.principal, value: s.value, income: s.income ?? 0 }),
  ),
);

const SEED_JOURNAL_KEYS = new Set(seedJournalEntries.map((j) => `${j.date}|${j.title}`));

const SEED_HOLDING_KEYS = new Set(
  seedModelHoldings.map((h) => `${h.name}|${h.ticker ?? ""}|${h.targetWeight}`),
);

export function isSeedSnapshot(row: SnapshotRow): boolean {
  return SEED_SNAPSHOT_KEYS.has(snapshotKey(row));
}

export function isSeedJournal(row: JournalRow): boolean {
  return SEED_JOURNAL_KEYS.has(`${row.date}|${row.title}`);
}

export function isSeedHolding(row: HoldingRow): boolean {
  return SEED_HOLDING_KEYS.has(`${row.name}|${row.ticker ?? ""}|${row.targetWeight}`);
}

const SEED_POST_KEYS = new Set(seedPosts.map((p) => `${p.slug}|${p.title}`));

/** ⚠ 본문으로 잡는다. 닉네임은 흔할 수 있어도 이 문장들은 우리가 쓴 예시다. */
const SEED_COMMENT_KEYS = new Set(seedComments.map((c) => `${c.authorName}|${c.body}`));

export function isSeedPost(row: PostRow): boolean {
  return SEED_POST_KEYS.has(`${row.slug}|${row.title}`);
}

export function isSeedComment(row: CommentRow): boolean {
  return SEED_COMMENT_KEYS.has(`${row.authorName ?? ""}|${row.body}`);
}

export type ResidueInput = {
  snapshots: SnapshotRow[];
  journal: JournalRow[];
  holdings: HoldingRow[];
  posts?: PostRow[];
  comments?: CommentRow[];
};

/**
 * 시드와 완전히 같은 행들. 없으면 빈 배열이다.
 *
 * ⚠ 한 건도 안 남았는데 카드를 띄우지 않는다 — 늘 켜져 있는 경고는 아무도 안 읽는다.
 */
export function findSeedResidue(input: ResidueInput): SeedResidue[] {
  const out: SeedResidue[] = [];

  const snapshots = input.snapshots.filter(isSeedSnapshot).length;
  if (snapshots > 0) {
    out.push({
      kind: "snapshot",
      label: "계좌 스냅숏 (넣은 돈과 불어난 돈)",
      matched: snapshots,
      total: input.snapshots.length,
      where: "/admin/journal",
    });
  }

  const journal = input.journal.filter(isSeedJournal).length;
  if (journal > 0) {
    out.push({
      kind: "journal",
      label: "투자일지",
      matched: journal,
      total: input.journal.length,
      where: "/admin/journal",
    });
  }

  const holdings = input.holdings.filter(isSeedHolding).length;
  if (holdings > 0) {
    out.push({
      kind: "holding",
      label: "대표 포트폴리오 종목",
      matched: holdings,
      total: input.holdings.length,
      where: "/admin/model-portfolio",
    });
  }

  const posts = (input.posts ?? []).filter(isSeedPost).length;
  if (posts > 0) {
    out.push({
      kind: "post",
      label: "글 (인사이트·공지)",
      matched: posts,
      total: (input.posts ?? []).length,
      where: "/admin/posts",
    });
  }

  const comments = (input.comments ?? []).filter(isSeedComment).length;
  if (comments > 0) {
    out.push({
      kind: "comment",
      label: "댓글",
      matched: comments,
      total: (input.comments ?? []).length,
      where: "/admin/comments",
    });
  }

  return out;
}

/**
 * 화면에 그대로 띄우는 한 문장.
 *
 * ⚠ "무엇이 잘못됐나"가 아니라 **"무엇이 어디서 보이고 있나"**를 말한다.
 *    공개 화면에 나가고 있다는 사실이 핵심이다.
 */
export function residueNotice(items: SeedResidue[]): string {
  if (items.length === 0) return "";
  const total = items.reduce((sum, i) => sum + i.matched, 0);
  return `⚠ 시드(예시) 데이터 ${total}건이 그대로 남아 공개 화면에 나가고 있습니다. 지어낸 숫자를 자기 계좌로 내보이는 상태입니다.`;
}

/**
 * ⚠ 종목은 없는데 계좌 곡선만 남아 있는 모순.
 *
 * 시드가 아니어도 생길 수 있다 — 종목을 다 지우고 스냅숏만 남기면 화면은
 * "평가액 7,654만원"과 "보유 종목 없음"을 **같은 화면에** 띄운다.
 * 전액 현금 계좌라면 말이 되지만, 그때는 평가손익이 붙지 않는다.
 * ⚠ 자동으로 감추지 않는다 — 무엇이 맞는 기록인지는 사람이 안다(운영지침: admin이 정한다).
 */
export function holdingsMissingNotice(input: {
  publishedHoldings: number;
  snapshots: number;
}): string {
  if (input.snapshots === 0 || input.publishedHoldings > 0) return "";
  return `⚠ 공개된 보유 종목이 0건인데 계좌 스냅숏 ${input.snapshots}건이 공개되고 있습니다. /portfolio가 "평가액은 있는데 담은 것은 없다"로 보입니다.`;
}

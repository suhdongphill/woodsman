/**
 * 사이트 단계 · 비전 · 로드맵 — 문구와 데이터를 한곳에 모은 모듈.
 *
 * 화면 여러 곳(상단 배너 · 사이트 소개 · 푸터)이 같은 사실을 말해야 하는데,
 * 각 페이지에 문구를 흩어 놓으면 단계가 바뀔 때 한 군데가 남는다.
 * 그래서 "지금 어느 단계인가"는 여기서만 정하고 화면은 읽어 쓰기만 한다.
 *
 * 실제 기능 개방 여부는 이 파일이 아니라 `site-policy.ts`(DB 스위치)가 결정한다.
 * 여기는 **말**, 거기는 **동작**이다. 둘이 어긋나지 않는지는 site-status.test.ts가 본다.
 */

export type ReleaseStage = "BETA" | "OPEN";

/** 현재 단계. 커뮤니티를 열고 안정화되면 "OPEN"으로 바꾼다. */
export const SITE_STAGE: ReleaseStage = "BETA";

export const isBeta = SITE_STAGE === "BETA";

/** 상단 배너·메타 설명에 쓰는 짧은 문구 */
export const BETA_NOTICE = {
  badge: "BETA",
  short: "개발 중인 베타 사이트입니다",
  long: "기능과 화면이 자주 바뀔 수 있고, 기록된 수치도 정리 과정에서 수정될 수 있습니다.",
} as const;

export type RoadmapStatus = "done" | "current" | "planned";

export type RoadmapPhase = {
  id: string;
  /** 화면에 보이는 단계 번호 */
  step: string;
  title: string;
  summary: string;
  items: string[];
  status: RoadmapStatus;
};

/**
 * 발전 방향.
 *
 * 지키지 못할 약속은 적지 않는다 — 시점을 못 박지 않고 순서만 밝힌다.
 * 광고·검색 심사에서도 "곧 오픈"류의 확정 표현은 위험 요소가 된다.
 */
export const ROADMAP: RoadmapPhase[] = [
  {
    id: "record",
    step: "01",
    title: "혼자 기록한다",
    summary: "지금 이 단계입니다. Woodsman 한 사람의 계좌와 판단을 그대로 공개합니다.",
    items: [
      "납입원금 대비 평가액 곡선 — 손실 구간도 지우지 않고 공개",
      "매수·매도·리밸런싱 투자일지 (체결 수량·단가 포함)",
      "판단의 바탕이 되는 원칙과 종목 분석 인사이트",
    ],
    status: "current",
  },
  {
    id: "community",
    step: "02",
    title: "원칙을 나누는 커뮤니티로 연다",
    summary:
      "기록이 충분히 쌓이면 회원가입과 게시판·댓글을 엽니다. 기능은 이미 만들어 두고 잠가 둔 상태입니다.",
    items: [
      "회원가입 · 로그인 (준비 완료, 현재 잠금)",
      "글별 댓글과 게시판 — 종목 추천이 아니라 원칙과 반론을 나누는 자리",
      "가입을 열기 전에 개인정보 처리방침을 먼저 갱신하고 공지",
    ],
    status: "planned",
  },
  {
    id: "pipeline",
    step: "03",
    title: "안정적인 파이프라인 관리를 돕는다",
    summary:
      "배당·이자로 생활비를 만드는 '인컴 파이프라인'을 각자 설계하고 점검할 수 있는 도구를 목표로 합니다.",
    items: [
      "개인 포트폴리오를 비공개로 관리 (성장·인컴·방어 버킷)",
      "월별 현금흐름·배당 캘린더로 비는 달 찾기",
      "목표 비중에서 벗어났을 때 알려주는 리밸런싱 점검",
    ],
    status: "planned",
  },
  {
    id: "company",
    step: "04",
    title: "콘텐츠를 기반으로 서비스화한다",
    summary:
      "기록과 도구가 자리를 잡으면 법인을 세워 정식 서비스로 발전시킬 계획입니다.",
    items: [
      "콘텐츠 제작·운영을 본업으로 하는 조직 구성",
      "이용 서비스 개방 — 유료 여부와 범위는 그때 명확히 공지",
      "변함없는 원칙: 종목 추천·투자자문은 하지 않는다",
    ],
    status: "planned",
  },
];

export const ROADMAP_STATUS_LABEL: Record<RoadmapStatus, string> = {
  done: "완료",
  current: "진행 중",
  planned: "예정",
};

/** 사이트가 지향하는 바 — 한 문단으로 */
export const VISION = {
  headline: "숲을 가꾸듯 자산을 기른다",
  body:
    "빠르게 맞히는 법이 아니라 오래 버티는 법을 기록합니다. 지금은 한 사람의 계좌를 " +
    "공개하는 데서 시작하지만, 같은 원칙을 지키려는 사람들이 서로의 판단을 검증하고 " +
    "각자의 인컴 파이프라인을 설계할 수 있는 자리로 키우려 합니다.",
} as const;

/** 현재 진행 중인 단계 (없으면 null) */
export function currentPhase(): RoadmapPhase | null {
  return ROADMAP.find((p) => p.status === "current") ?? null;
}

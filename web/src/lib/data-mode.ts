/**
 * 이 계좌가 **모의 투자인가 실계좌인가** — 순수 판단.
 *
 * ## 왜 굳이 밝히는가
 * 이 사이트는 "계좌를 공개한다"를 내걸었다. 가상 매매를 실계좌처럼 보이게 두면
 * 나중에 진짜 기록을 올려도 "저 사람 숫자는 못 믿겠다"가 된다. 되돌릴 수 없는 손해다.
 *
 * ## 그런데 가상이라고 값이 없는 건 아니다
 * 매매·납입은 가상이어도 **종목의 시세는 실제 시장가격**이다. 그래서 보여줄 수 있는 것이 남는다:
 * 원칙대로 기능(성장·인컴·방어)을 나누고, 목표 비중을 정하고, **그 비중을 실제 시세 위에서
 * 단계적으로 채워 가는 과정**. 정석대로 굴렸을 때 포트폴리오가 어떻게 만들어지는지는
 * 가상 매매로도 정직하게 보여줄 수 있다.
 *
 * 그러니 문구는 사과가 아니라 **정확한 설명**이어야 한다.
 * "믿지 마세요"가 아니라 "무엇이 가상이고 무엇이 실제인지"를 적는다.
 *
 * ⚠ 기본값은 `PAPER`다. 설정을 읽지 못했을 때 실계좌로 보이면 안 된다.
 */

export type DataMode =
  /** 모의 투자 — 매매·납입은 가상, 시세는 실제 */
  | "PAPER"
  /** 실계좌 기록 */
  | "LIVE";

export const DEFAULT_DATA_MODE: DataMode = "PAPER";

export function normalizeDataMode(value: unknown): DataMode {
  return value === "LIVE" ? "LIVE" : DEFAULT_DATA_MODE;
}

export type DataModeNotice = {
  /** 배지 문구 (짧게) */
  badge: string;
  /** 무엇이 가상이고 무엇이 실제인지 */
  line: string;
  /** 실제 자금이 들어간 기록인가 */
  isRealMoney: boolean;
  tone: "info" | "ok";
};

export function dataModeNotice(mode: DataMode): DataModeNotice {
  if (mode === "LIVE") {
    return {
      badge: "실계좌",
      line: "실제 자금으로 운용한 기록입니다. 매매·납입·평가액 모두 실제입니다.",
      isRealMoney: true,
      tone: "ok",
    };
  }

  return {
    badge: "모의 투자",
    line: "매매와 납입은 가상입니다. 종목 시세는 실제 시장가격이며, 원칙대로 목표 비중을 채워 가는 과정을 그대로 기록합니다.",
    isRealMoney: false,
    tone: "info",
  };
}

/** 실제 자금이 들어간 성과로 인용해도 되는가 — 외부 홍보 문구 판단에 쓴다. */
export function isRealMoney(mode: DataMode): boolean {
  return dataModeNotice(mode).isRealMoney;
}

/** 화면에서 수익률 옆에 붙일 짧은 꼬리표. 실계좌면 붙이지 않는다. */
export function returnSuffix(mode: DataMode): string | null {
  return mode === "LIVE" ? null : "모의";
}

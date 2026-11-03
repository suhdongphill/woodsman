import type { Metadata } from "next";
import Link from "next/link";
import { PolicyList, PolicyPage, PolicySection } from "@/components/layout/PolicyPage";

export const metadata: Metadata = {
  alternates: { canonical: "/data-terms" },
  title: "데이터 이용 조건",
  description:
    "Woodsman이 만든 지표 해설·판정·차트는 출처만 밝히면 자유롭게 인용할 수 있습니다. 원자료의 권리는 각 출처 기관에 있습니다.",
};

/**
 * 데이터 이용 조건 (2026-11-03).
 *
 * 거시 지표 화면의 구조화 데이터(`Dataset`)가 `license`로 이 화면을 가리킨다(`lib/seo.ts`).
 * ⚠ 운영자 결정: **출처만 밝히면 자유 인용.**
 * ⚠ 원자료(FRED·ECOS·Yahoo 등)에 우리가 라이선스를 주는 것처럼 쓰지 않는다 — 우리 것이 아니다.
 *    우리 것(해설·판정·점수·차트 구성)과 남의 것(원 수치)을 이 화면에서 갈라 말한다.
 */
export default function DataTermsPage() {
  return (
    <PolicyPage
      eyebrow="DATA TERMS"
      title="데이터 이용 조건"
      description="이 사이트의 지표와 판정을 인용하거나 다시 쓰려는 분께."
      effectiveDate="2026년 11월 3일"
    >
      <PolicySection title="1. 출처만 밝히면 자유롭게 쓰실 수 있습니다">
        <p>
          Woodsman이 직접 만든 것은 <strong className="text-ink">출처를 밝히는 조건으로</strong>{" "}
          따로 허락받지 않고 인용·가공·재배포할 수 있습니다. 비상업적 이용과 상업적 이용 모두
          해당합니다.
        </p>
        <PolicyList
          items={[
            "지표마다 붙인 해설(무엇인지·왜 보는지·읽는 법)",
            "침체 신호·버블 점수·조류/바람/파도 같은 판정과 점수",
            "차트의 구성과 지표 묶음 방식",
          ]}
        />
      </PolicySection>

      <PolicySection title="2. 출처는 이렇게 적어 주세요">
        <p>
          이름과 그 화면의 주소를 함께 적어 주시면 됩니다. 수치는 날마다 바뀌므로 기준일도 같이
          적어 주시면 읽는 분이 덜 헷갈립니다.
        </p>
        <p className="rounded-lg border border-border px-4 py-3 text-sm text-ink">
          출처: Woodsman (portfolio-solutions.net/macro), 2026-11-03 기준
        </p>
      </PolicySection>

      <PolicySection title="3. 원자료의 권리는 각 기관에 있습니다">
        <p>
          지표의 원 수치는 FRED(세인트루이스 연방준비은행), 미 재무부, 미 노동통계국(BLS),
          한국은행 ECOS, Yahoo Finance, ISM, NAHB 등 지표마다 표시한 기관에서 가져온 것입니다. 원 수치를 그대로 다시 쓰시려면{" "}
          <strong className="text-ink">그 기관의 이용 조건</strong>을 따라 주세요. 이 화면의 허락은
          Woodsman이 만든 부분에만 미칩니다.
        </p>
      </PolicySection>

      <PolicySection title="4. 정확성을 보증하지 않습니다">
        <p>
          수집·계산 과정에서 오류가 있을 수 있고, 원 기관이 과거 수치를 고치기도 합니다. 모든
          내용은 정보 제공 목적이며 투자 권유가 아닙니다. 자세한 내용은{" "}
          <Link href="/disclaimer" className="text-gold-400 hover:text-gold-500">
            투자 판단 책임 고지
          </Link>
          를 확인해 주세요.
        </p>
      </PolicySection>
    </PolicyPage>
  );
}

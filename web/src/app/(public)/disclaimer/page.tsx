import type { Metadata } from "next";
import Link from "next/link";
import { PolicyList, PolicyPage, PolicySection } from "@/components/layout/PolicyPage";
import { CONTACT_EMAIL } from "@/lib/site-links";

export const metadata: Metadata = {
  title: "투자 판단 책임 고지",
  description:
    "Woodsman의 모든 콘텐츠는 정보 제공 목적이며 투자 권유나 자문이 아닙니다. 투자 판단과 그 결과의 책임은 투자자 본인에게 있습니다.",
};

export default function DisclaimerPage() {
  return (
    <PolicyPage
      eyebrow="DISCLAIMER"
      title="투자 판단 책임 고지"
      description="이 사이트를 읽기 전에 반드시 확인해 주세요."
      effectiveDate="2026년 8월 2일"
    >
      <PolicySection title="1. 정보 제공 목적입니다">
        <p>
          Woodsman에 실린 모든 글·수치·차트·포트폴리오 내역은 운영자 개인의 기록이자 의견이며,{" "}
          <strong className="text-white">정보 제공 목적</strong>으로만 공개됩니다. 특정 금융투자상품의
          매수·매도를 권유하거나 청약을 유인하지 않습니다.
        </p>
        <p>
          운영자는 자본시장과 금융투자업에 관한 법률에 따른 투자자문업자·투자일임업자가 아니며,
          이 사이트는 어떠한 형태의 투자자문·일임 서비스도 제공하지 않습니다. 개별 상담이나
          종목 추천 요청에는 응하지 않습니다.
        </p>
      </PolicySection>

      <PolicySection title="2. 모든 판단과 결과의 책임은 투자자 본인에게 있습니다">
        <p>
          이 사이트의 내용을 참고해 내린 투자 판단과 그로 인한 손익은 전적으로 이용자 본인의
          책임입니다. 운영자는 이용자가 입은 어떠한 손실에 대해서도 법적 책임을 지지 않습니다.
        </p>
        <p>
          <strong className="text-white">과거의 성과는 미래의 수익을 보장하지 않습니다.</strong>{" "}
          공개된 계좌가 지금까지 수익을 냈더라도, 같은 방식이 앞으로도 통한다는 뜻은 아닙니다.
        </p>
      </PolicySection>

      <PolicySection title="3. 공개하는 계좌 정보에 대하여">
        <PolicyList
          items={[
            <>
              <Link href="/portfolio" className="text-gold-400 hover:text-gold-500">
                대표 포트폴리오
              </Link>
              와{" "}
              <Link href="/journal" className="text-gold-400 hover:text-gold-500">
                투자일지
              </Link>
              는 운영자가 실제로 운용하는 계좌를 기준으로 기록합니다. 손실 구간과 잘못된 판단도
              지우지 않고 남깁니다.
            </>,
            "평가액·수익률은 기록 시점의 종가 기준이며, 세금·거래비용·환전 수수료가 모두 반영되지 않을 수 있습니다.",
            "환율이 개입되는 종목은 원화 환산 시점에 따라 수치가 달라질 수 있습니다.",
            "게시 이후 운영자의 보유 상태가 바뀌어도 지난 글을 소급해 수정하지 않습니다. 각 글의 작성일을 함께 확인해 주세요.",
          ]}
        />
      </PolicySection>

      <PolicySection title="4. 이해관계 고지">
        <p>
          운영자는 이 사이트에서 언급하는 종목을 <strong className="text-white">직접 보유하고
          있을 수 있습니다.</strong> 보유 여부와 수량은 대표 포트폴리오와 투자일지에 공개합니다.
        </p>
        <p>
          특정 기업·금융회사로부터 대가를 받고 작성한 글은 없습니다. 향후 광고나 제휴가 생기면
          해당 글에 명확히 표시합니다.
        </p>
      </PolicySection>

      <PolicySection title="5. 외부 링크와 인용 자료">
        <p>
          외부 블로그·뉴스·공시 등으로 연결되는 링크의 내용에 대해서는 책임지지 않습니다. 인용한
          수치는 작성 시점의 공개 자료를 기준으로 하며, 오류가 확인되면 해당 글에 정정 사실을
          적어 둡니다.
        </p>
      </PolicySection>

      <PolicySection title="6. 문의">
        <p>
          내용의 오류 지적이나 정정 요청은 <span className="text-gold-400">{CONTACT_EMAIL}</span>
          으로 보내주시면 확인 후 반영하겠습니다.
        </p>
      </PolicySection>
    </PolicyPage>
  );
}

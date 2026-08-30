import type { Metadata } from "next";
import Link from "next/link";
import { PolicyList, PolicyPage, PolicySection } from "@/components/layout/PolicyPage";
import { RoadmapTimeline } from "@/features/site/ui/RoadmapTimeline";
import { BETA_NOTICE, VISION, isBeta } from "@/lib/site-status";
import { getSiteBasics } from "@/lib/site-settings";

export const metadata: Metadata = {
  title: "사이트 소개",
  description:
    "Woodsman은 금리·물가·유동성 같은 거시 지표로 경제의 흐름을 읽고, 그 흐름에 맞춰 굴린 계좌와 판단 과정을 공개하는 개인 기록 사이트입니다. 원칙을 나누는 커뮤니티와 인컴 파이프라인 관리 도구로 발전시켜 갑니다.",
};

export default async function AboutPage() {
  const { contactEmail } = await getSiteBasics();
  return (
    <PolicyPage
      eyebrow="ABOUT"
      title="사이트 소개"
      description="무엇을 기록하는 곳이고, 어디로 가려는 곳인지."
      effectiveDate="2026년 8월 2일"
    >
      {isBeta && (
        <div className="rounded-2xl border border-gold-600/30 bg-gold-500/[0.06] p-5">
          <span className="inline-flex items-center rounded-md border border-gold-600/40 bg-gold-500/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-gold-400">
            {BETA_NOTICE.badge}
          </span>
          <p className="mt-2.5 text-[13.5px] leading-relaxed text-gray-300">
            <strong className="text-ink">{BETA_NOTICE.short}.</strong> {BETA_NOTICE.long} 지금은
            운영자 한 사람이 기록을 쌓는 단계이며, 아래 순서로 넓혀 갈 계획입니다.
          </p>
        </div>
      )}

      <PolicySection title={VISION.headline}>
        <p>{VISION.body}</p>
      </PolicySection>

      <PolicySection title="발전 방향">
        <p className="mb-4">
          시점을 못 박지 않고 순서만 밝힙니다. 준비되지 않은 기능을 &ldquo;곧 오픈&rdquo;이라고
          적지 않기 위해서입니다.
        </p>
        <RoadmapTimeline />
      </PolicySection>

      <PolicySection title="한 사람의 계좌를 그대로 공개합니다">
        <p>
          이 사이트는 운영자 Woodsman이 자신의 투자 계좌를 공개하고, 매달 얼마를 넣었고 지금 얼마가
          되었는지를 기록하는 블로그입니다. 종목 추천을 하는 곳이 아니라,{" "}
          <strong className="text-ink">원칙대로 한 투자가 실제로 어떤 결과를 내는지</strong>를
          긴 시간에 걸쳐 확인하는 곳입니다.
        </p>
        <p>
          그래서 좋은 달만 올리지 않습니다. 평가액이 납입원금을 밑돌았던 구간과, 그때 아무것도 하지
          않기로 한 판단까지 같이 남깁니다.
        </p>
      </PolicySection>

      <PolicySection title="세 개의 통 — 성장 · 인컴 · 방어">
        <p>
          모든 자산을 &ldquo;이 돈이 내 포트폴리오에서 무슨 일을 하는가&rdquo;로 분류합니다.
        </p>
        <PolicyList
          items={[
            <>
              <strong className="text-ink">성장</strong> — 이익 성장률로 수익을 만든다. 변동성을
              감수하는 자리.
            </>,
            <>
              <strong className="text-ink">인컴</strong> — 배당·이자로 현금흐름을 만든다.
              하락장에서 심리를 지탱한다.
            </>,
            <>
              <strong className="text-ink">방어</strong> — 지수·현금으로 최악을 막고 리밸런싱
              탄약을 보관한다.
            </>,
          ]}
        />
        <p>
          비중은 &ldquo;얼마나 오를까&rdquo;가 아니라 &ldquo;얼마나 버틸 수 있나&rdquo;로 정합니다.
        </p>
      </PolicySection>

      <PolicySection title="여기서 볼 수 있는 것">
        <PolicyList
          items={[
            <>
              <Link href="/portfolio" className="text-gold-400 hover:text-gold-500">
                대표 포트폴리오
              </Link>{" "}
              — 납입원금 대비 평가액 곡선, 기능별 배분, 종목별 편입 논리
            </>,
            <>
              <Link href="/journal" className="text-gold-400 hover:text-gold-500">
                투자일지
              </Link>{" "}
              — 매수·매도·리밸런싱을 왜 그때 그렇게 했는지, 체결 수량·단가와 함께
            </>,
            <>
              <Link href="/insights" className="text-gold-400 hover:text-gold-500">
                인사이트
              </Link>{" "}
              — 개별 판단의 바탕이 되는 원칙과 종목 분석
            </>,
          ]}
        />
      </PolicySection>

      <PolicySection title="여기서 하지 않는 것">
        <PolicyList
          items={[
            "종목 추천과 개별 상담 — 운영자는 투자자문업자가 아닙니다.",
            "유료 리딩·수익률 인증 서비스",
            "회원 모집 — 현재 회원가입을 받지 않으며, 모든 글은 가입 없이 열려 있습니다.",
            "단계가 올라가도 이 세 가지는 그대로입니다. 커뮤니티를 열어도 추천하는 자리가 아니라 원칙을 검증하는 자리로 둡니다.",
          ]}
        />
        <p>
          자세한 내용은{" "}
          <Link href="/disclaimer" className="text-gold-400 hover:text-gold-500">
            투자 판단 책임 고지
          </Link>
          와{" "}
          <Link href="/privacy" className="text-gold-400 hover:text-gold-500">
            개인정보 처리방침
          </Link>
          을 확인해 주세요.
        </p>
      </PolicySection>

      <PolicySection title="문의">
        <p>
          의견·반론·오류 지적은 <span className="text-gold-400">{contactEmail}</span>으로 받고
          있습니다. 댓글은 콘텐츠가 충분히 쌓이면 열 예정입니다.
        </p>
      </PolicySection>
    </PolicyPage>
  );
}

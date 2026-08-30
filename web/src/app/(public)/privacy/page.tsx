import type { Metadata } from "next";
import Link from "next/link";
import { PolicyList, PolicyPage, PolicySection } from "@/components/layout/PolicyPage";
import { getSiteBasics } from "@/lib/site-settings";

export const metadata: Metadata = {
  title: "개인정보 처리방침",
  description:
    "Woodsman은 현재 회원가입을 지원하지 않으며, 방문자의 개인정보를 직접 수집하지 않습니다.",
};

export default async function PrivacyPage() {
  const { contactEmail } = await getSiteBasics();
  return (
    <PolicyPage
      eyebrow="PRIVACY"
      title="개인정보 처리방침"
      description="지금 이 사이트가 무엇을 수집하고 무엇을 수집하지 않는지 그대로 적었습니다."
      effectiveDate="2026년 8월 6일"
    >
      <PolicySection title="1. 회원가입을 지원하지 않습니다">
        <p>
          Woodsman은 운영자 한 사람이 자신의 계좌와 판단을 기록하는 개인 블로그입니다.{" "}
          <strong className="text-ink">현재 공개 회원가입을 지원하지 않으며</strong>, 따라서
          이름·이메일·연락처 등 <strong className="text-ink">회원 개인정보를 수집·저장하지
          않습니다.</strong>
        </p>
        <p>
          모든 콘텐츠는 로그인이나 가입 없이 열람할 수 있습니다.{" "}
          <Link href="/register" className="text-gold-400 hover:text-gold-500">
            회원가입 안내
          </Link>
          에 이유를 적어 두었습니다.
        </p>
        <p className="rounded-xl border border-border bg-card px-4 py-3 text-[13px] text-muted">
          향후 댓글·커뮤니티 기능을 열어 회원가입을 받게 되면, 수집 항목·목적·보유기간을 이
          방침에 먼저 반영하고 시행일을 갱신한 뒤에 시작합니다. 사전 고지 없이 수집을 시작하지
          않습니다.
        </p>
      </PolicySection>

      <PolicySection title="2. 운영자 계정에 대하여">
        <p>
          사이트 운영을 위한 관리자 계정이 하나 존재합니다. 이 계정의 비밀번호는{" "}
          <strong className="text-ink">bcrypt 해시로만 저장</strong>되며 평문으로 보관하지
          않습니다. 관리자 로그인 화면은 검색엔진에 노출되지 않습니다.
        </p>
      </PolicySection>

      <PolicySection title="3. 자동으로 수집될 수 있는 정보">
        <p>서비스 제공 과정에서 아래 정보가 자동으로 남을 수 있습니다.</p>
        <PolicyList
          items={[
            "접속 로그(IP 주소, 브라우저 종류, 접속 시각) — 서버·호스팅 사업자가 보안과 장애 대응을 위해 일정 기간 보관합니다.",
            "쿠키 — 로그인 세션 유지를 위해 사용하며, 로그인하지 않은 방문자에게는 세션 쿠키가 발급되지 않습니다.",
            "조회수 집계 — 어떤 화면이 몇 번 열렸는지를 (경로, 날짜, 합계)로만 셉니다. IP·브라우저 정보·유입 경로는 저장하지 않고, 방문자를 구분하는 식별자도 만들지 않습니다.",
          ]}
        />
        <p>
          조회수는 개인을 구분하지 않으므로 <strong className="text-ink">방문자 수가 아니라
          조회수</strong>입니다. 같은 탭에서 같은 화면을 새로고침해도 한 번만 세도록 브라우저
          안에만 남는 값(sessionStorage)을 쓰며, 이 값은 서버로 전송되지 않습니다.
        </p>
        <p>
          브라우저 설정에서 쿠키 저장을 거부할 수 있습니다. 콘텐츠 열람에는 아무 영향이 없습니다.
        </p>
      </PolicySection>

      <PolicySection title="4. 광고 및 제3자 도구">
        <p>
          이 사이트는 운영 비용 충당을 위해 향후 Google AdSense 등 제3자 광고를 게재할 수 있습니다.
          광고 사업자는 이용자의 관심에 기반한 광고를 제공하기 위해 쿠키를 사용할 수 있으며, 이는
          해당 사업자의 정책에 따릅니다.
        </p>
        <PolicyList
          items={[
            <>
              Google의 광고 쿠키 사용과 거부 방법은{" "}
              <a
                href="https://policies.google.com/technologies/ads"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gold-400 hover:text-gold-500"
              >
                Google 광고 정책
              </a>
              에서 확인하고,{" "}
              <a
                href="https://myadcenter.google.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gold-400 hover:text-gold-500"
              >
                내 광고 센터
              </a>
              에서 맞춤 광고를 끌 수 있습니다.
            </>,
            "운영자는 광고 사업자가 수집한 정보에 접근하지 않으며, 방문자를 개인 단위로 식별하지 않습니다.",
          ]}
        />
      </PolicySection>

      <PolicySection title="5. 제3자 제공 및 위탁">
        <p>
          운영자는 수집한 정보를 제3자에게 판매하거나 제공하지 않습니다. 다만 사이트 운영에 필요한
          호스팅·데이터베이스 서비스 이용 과정에서 해당 사업자의 인프라에 데이터가 저장될 수
          있습니다.
        </p>
      </PolicySection>

      <PolicySection title="6. 이용자의 권리">
        <p>
          회원정보를 수집하지 않으므로 열람·정정·삭제를 요청할 개인정보가 원칙적으로 존재하지
          않습니다. 그럼에도 본인과 관련된 정보의 확인이나 삭제를 원하시면 아래로 연락 주시면
          지체 없이 조치하겠습니다.
        </p>
      </PolicySection>

      <PolicySection title="7. 개인정보 보호 책임자">
        <PolicyList
          items={[
            "책임자 · 서동필 (Woodsman 운영자)",
            <>
              연락처 · <span className="text-gold-400">{contactEmail}</span>
            </>,
          ]}
        />
        <p className="text-[12.5px] text-gray-500">
          이 방침이 변경될 경우 시행일을 갱신해 이 페이지에 공지합니다.
          <br />
          최근 개정 · 2026년 8월 6일: 조회수 집계(쿠키·IP를 저장하지 않는 날짜별 합계) 항목을 추가.
        </p>
      </PolicySection>
    </PolicyPage>
  );
}

import Link from "next/link";
import { SectionHeader } from "@/components/ui/Card";
import { ChevronRightIcon } from "@/components/icons";

/**
 * 어떻게 기록하나요 — 운영 원칙 3장.
 *
 * ⚠ 문구가 화면이 아니라 **여기 상수**에 있다. 홈 라우트에 흩어져 있으면 무엇이 어디에
 *    걸린 문장인지 찾기 어려워진다.
 */
const PRINCIPLES = [
  {
    title: "기능으로 나눈다",
    desc: "종목을 고르기 전에 통을 정합니다. 성장·인컴·방어 — 이 돈이 포트폴리오에서 무슨 일을 하는지부터.",
    href: "/portfolio",
    cta: "배분 보기",
  },
  {
    title: "판단을 먼저 적는다",
    desc: "매매 전에 근거를 적습니다. 사후에 고칠 수 없게 만들어야 기록이 자산이 됩니다.",
    href: "/journal",
    cta: "투자일지 읽기",
  },
  {
    title: "손실도 지우지 않는다",
    desc: "평가액이 원금을 밑돌았던 달과, 그때 아무것도 하지 않기로 한 판단까지 남깁니다.",
    href: "/about",
    cta: "운영 원칙",
  },
];

export function PrinciplesGrid() {
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-14">
      <SectionHeader
        title="어떻게 기록하나요"
        subtitle="추천하지 않습니다. 대신 제 판단과 결과를 그대로 둡니다."
      />
      <div className="grid sm:grid-cols-3 gap-4">
        {PRINCIPLES.map((p) => (
          <Link
            key={p.title}
            href={p.href}
            className="group bg-card border border-border rounded-2xl p-5 card-hover hover:border-gold-600/40"
          >
            <h3 className="text-[15px] font-semibold text-ink group-hover:text-gold-400 transition-colors">
              {p.title}
            </h3>
            <p className="mt-2 text-[12.5px] text-muted leading-relaxed">{p.desc}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-[11px] text-emerald-400">
              {p.cta}
              <ChevronRightIcon size={12} />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

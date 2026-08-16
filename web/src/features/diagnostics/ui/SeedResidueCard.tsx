/**
 * 시드(예시) 데이터가 공개 화면에 나가고 있다는 경고.
 *
 * ⚠ **지우는 버튼을 여기 두지 않는다.** 무엇이 진짜 기록인지는 사람이 안다.
 *    프로그램은 "이건 예시값과 똑같습니다"까지만 말하고 지울 자리로 보낸다
 *    (운영지침: 모든 것은 admin이 유연하게 운영한다).
 * ⚠ 남은 게 없으면 **아무것도 그리지 않는다.** 늘 켜져 있는 경고는 아무도 안 읽는다.
 */
import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/Card";
import { residueNotice } from "@/lib/seed-residue";
import type { SeedCheck } from "../seed-check";

export function SeedResidueCard({ check }: { check: SeedCheck }) {
  if (check.failed) {
    return (
      <Card>
        <CardTitle>시드 예시 데이터</CardTitle>
        <p className="text-[12.5px] text-amber-400">
          ⚠ 점검하지 못했습니다. &lsquo;남은 게 없다&rsquo;는 뜻이 아닙니다 — 서버 로그의
          <span className="font-mono"> [diagnostics]</span> 항목을 확인하세요.
        </p>
      </Card>
    );
  }

  if (check.items.length === 0 && !check.contradiction) return null;

  return (
    <Card>
      <CardTitle>시드 예시 데이터</CardTitle>

      {check.items.length > 0 && (
        <>
          <p className="text-[13px] leading-relaxed text-red-400">{residueNotice(check.items)}</p>
          <ul className="mt-3 space-y-2">
            {check.items.map((item) => (
              <li
                key={item.kind}
                className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 pb-2"
              >
                <span className="text-[12.5px] text-gray-200">{item.label}</span>
                <span className="flex items-baseline gap-3">
                  <span className="text-[12.5px] tabular-nums text-amber-300">
                    {item.total}건 중 {item.matched}건이 예시값과 동일
                  </span>
                  <Link
                    href={item.where}
                    className="text-[11.5px] text-gold-400 hover:text-gold-500"
                  >
                    지우러 가기
                  </Link>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11.5px] leading-relaxed text-gray-600">
            ⚠ 날짜와 숫자가 <strong className="text-gray-400">한 칸도 다르지 않을 때만</strong>{" "}
            표시합니다. 한 번이라도 고친 기록은 사람의 기록으로 보고 잡지 않습니다.
          </p>
        </>
      )}

      {check.contradiction && (
        <p
          className={`text-[12.5px] leading-relaxed text-amber-400 ${
            check.items.length > 0 ? "mt-4 border-t border-border pt-3" : ""
          }`}
        >
          {check.contradiction}
        </p>
      )}
    </Card>
  );
}

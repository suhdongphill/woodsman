"use client";

/**
 * 티스토리 내보내기 패널 (편집 화면).
 *
 * ## ⚠ 왜 파일 다운로드가 아니라 붙여 넣기인가
 * 티스토리 편집기는 **HTML 모드에 붙여 넣는 것**이 유일하게 신뢰할 수 있는 경로다.
 * 파일을 만들어 줘도 결국 열어서 복사해야 한다. 그래서 바로 복사할 수 있는 칸을 준다.
 *
 * ## ⚠ 붙여 넣은 뒤 기본(위지윅) 모드로 전환하지 않는다
 * 전환하는 순간 편집기가 인라인 스타일을 "정리"해서 판이 깨진다.
 * 이 문장을 화면에 적어 두는 이유가 그것이다 — 한 번 겪으면 늦다.
 */
import { useState } from "react";

export function TistoryExportPanel({
  ticker,
  html,
  publishedAt,
}: {
  ticker: string;
  html: string;
  /** 발행 전이면 없다 — 그때는 "초안을 내보내는 중"이라고 말한다 */
  publishedAt?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(html);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ⚠ 조용히 넘기지 않는다. 복사가 안 되면 아래 칸에서 직접 골라야 한다는 걸 알려 준다.
      setCopied(false);
      alert("클립보드를 쓸 수 없습니다. 아래 칸을 눌러 전체 선택한 뒤 직접 복사하세요.");
    }
  }

  return (
    <section className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">티스토리로 내보내기</h3>
          <p className="mt-1 text-[11.5px] text-gray-600">
            이 사이트의 1순위 목적은 티스토리로 트래픽을 보내는 것입니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/admin/stocks/${encodeURIComponent(ticker)}/tistory`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-border px-3 py-2 text-[12.5px] text-gray-300 transition-colors hover:border-gold-600/40 hover:text-ink"
          >
            미리보기
          </a>
          <button
            type="button"
            onClick={copy}
            className="rounded-xl border border-gold-600/40 px-3 py-2 text-[12.5px] text-gold-300 transition-colors hover:bg-gold-600/10"
          >
            {copied ? "복사했습니다" : "HTML 복사"}
          </button>
        </div>
      </div>

      <ol className="space-y-1 text-[12.5px] text-gray-400 list-decimal pl-5">
        <li>티스토리 글쓰기 → 오른쪽 위 모드를 <strong className="text-gray-200">HTML</strong>로 바꿉니다.</li>
        <li>여기서 복사한 것을 그대로 붙여 넣습니다.</li>
        <li>
          ⚠ <strong className="text-amber-300">기본 모드로 되돌리지 않습니다.</strong> 편집기가
          스타일을 정리해 판이 깨집니다.
        </li>
        <li>발행한 뒤 그 글 주소를 아래 &lsquo;티스토리 원문 주소&rsquo;에 적으면, 공개 화면이 그리로 보내는 링크를 띄우고 클릭을 셉니다.</li>
      </ol>

      {!publishedAt && (
        <p className="text-[12px] text-amber-400">
          ⚠ 아직 발행 전 초안입니다. 규율 검증을 통과해 발행한 뒤 내보내는 편이 좋습니다 —
          내보낸 판에는 발행일이 안 찍힙니다.
        </p>
      )}

      <div className="space-y-1.5">
        <p className="text-[11.5px] text-muted">
          붙여 넣을 HTML — 눌러서 전체 선택한 뒤 복사해도 됩니다. ({html.length.toLocaleString()}자)
        </p>
        <textarea
          readOnly
          value={html}
          onFocus={(e) => e.currentTarget.select()}
          className="w-full min-h-[180px] rounded-xl border border-border bg-bg px-3 py-2 font-mono text-[11px] leading-relaxed text-gray-400"
        />
      </div>
    </section>
  );
}

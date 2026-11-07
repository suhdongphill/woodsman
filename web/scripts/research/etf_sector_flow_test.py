# -*- coding: utf-8 -*-
"""
etf_sector_flow_test.py — 섹터 ETF 자금 유입이 이후 섹터 수익을 말해 주는가(2026-11-07 조사). 읽기만 한다.

자료: State Street 펀드 화면에 링크된 `navhist-us-en-<ticker>.xlsx`(일별 NAV·설정주식수·순자산).
유입 ≈ Δ설정주식수 × NAV. 유입률 = 그 달 유입 합 ÷ 달 초 순자산.

묻는 것 — 매월 말 섹터를 줄 세워, 다음 1·3개월 수익(동일가중 섹터 평균 대비):
  ① 최근 3개월 유입률 상위 3 − 하위 3
  ② 비교: 최근 6개월 가격 모멘텀 상위 3 − 하위 3 (가격만으로도 되는가)
  ③ 둘 다 강한 섹터 vs 유입만 강하고 가격은 약한 섹터
⚠ NAV 수익률이라 분배금이 빠진다(업종 간 차이 있음). 거래비용 없음. 섹터 11개라 표본이 작다.
⚠ 겹치는 3개월 구간의 t는 부풀려진다 → 3개월 건너 표본을 함께 낸다. 액면분할은 NAV·주식수로 찾아 흐름에서 뺀다.

실행: python web/scripts/research/etf_sector_flow_test.py <캐시 폴더> [--since 2016-01]
"""
import json
import math
import statistics as st
import subprocess
import sys
from datetime import datetime
from pathlib import Path

import openpyxl

SECTORS = {
    "XLK": "기술", "XLF": "금융", "XLV": "헬스케어", "XLE": "에너지", "XLI": "산업재", "XLY": "경기소비재",
    "XLP": "필수소비재", "XLU": "유틸리티", "XLB": "소재", "XLRE": "리츠·부동산", "XLC": "커뮤니케이션",
}
URL = "https://www.ssga.com/library-content/products/fund-data/etfs/us/navhist-us-en-{}.xlsx"


def load(ticker: str, folder: Path):
    path = folder / f"navhist-{ticker}.xlsx"
    if not path.exists():
        subprocess.run(["curl", "-s", "-L", "-A", "Mozilla/5.0", "--max-time", "60", "-o", str(path), URL.format(ticker.lower())], check=True)
    ws = openpyxl.load_workbook(path, read_only=True, data_only=True).worksheets[0]
    rows = []
    for r in ws.iter_rows(values_only=True):
        try:
            d = datetime.strptime(str(r[0]), "%d-%b-%Y").date()
            nav, shares, tna = float(r[1]), float(r[2]), float(r[3])
        except (TypeError, ValueError):
            continue
        if nav > 0 and shares > 0:
            rows.append((d.isoformat(), nav, shares, tna))
    return sorted(rows)


def monthly(rows):
    """월별 {유입률%, 수익률%}. 분할이 있던 날은 유입 0, 수익은 분할 보정."""
    out, cur = {}, None
    splits = []
    for (d0, n0, s0, t0), (d1, n1, s1, t1) in zip(rows, rows[1:]):
        ratio = s1 / s0
        nr = n1 / n0
        split = abs(nr - 1) > 0.25 and abs(ratio * nr - 1) < 0.1
        if split:
            splits.append(d1)
        flow = 0.0 if split else (s1 - s0) * n1
        ret = (ratio * nr) if split else nr
        ym = d1[:7]
        if ym != cur:
            out[ym] = {"flow": 0.0, "start": t0, "gross": 1.0}
            cur = ym
        out[ym]["flow"] += flow
        out[ym]["gross"] *= ret
    return {k: {"flow_pct": v["flow"] / v["start"] * 100 if v["start"] else None, "ret": (v["gross"] - 1) * 100} for k, v in out.items()}, splits


def tstat(xs):
    if len(xs) < 3 or st.stdev(xs) == 0:
        return None
    return round(st.mean(xs) / (st.stdev(xs) / math.sqrt(len(xs))), 2)


def summ(xs):
    xs = [x for x in xs if x is not None]
    return {"n": len(xs), "mean": round(st.mean(xs), 2) if xs else None, "t": tstat(xs)}


def main():
    folder = Path(sys.argv[1])
    folder.mkdir(parents=True, exist_ok=True)
    since = sys.argv[sys.argv.index("--since") + 1] if "--since" in sys.argv else "2016-01"
    data, meta = {}, {}
    for t, name in SECTORS.items():
        rows = load(t, folder)
        data[t], splits = monthly(rows)
        meta[t] = {"name": name, "from": rows[0][0], "to": rows[-1][0], "days": len(rows), "splits": splits}
        print(t, name, rows[0][0], rows[-1][0], len(rows), "split", splits, flush=True)

    months = sorted(set().union(*[set(d) for d in data.values()]))
    months = [m for m in months if m >= since]
    # 마지막 달은 진행 중이므로 신호·수익에서 뺀다
    months = months[:-1]
    idx = {m: i for i, m in enumerate(months)}

    def window(t, m, n, key):
        i = idx[m]
        if i - n + 1 < 0:
            return None
        vals = [data[t].get(months[j], {}).get(key) for j in range(i - n + 1, i + 1)]
        if any(v is None for v in vals):
            return None
        if key == "flow_pct":
            return sum(vals)
        g = 1.0
        for v in vals:
            g *= 1 + v / 100
        return (g - 1) * 100

    def forward(t, m, n):
        i = idx[m]
        if i + n >= len(months):
            return None
        g = 1.0
        for j in range(i + 1, i + n + 1):
            v = data[t].get(months[j], {}).get("ret")
            if v is None:
                return None
            g *= 1 + v / 100
        return (g - 1) * 100

    series = {k: {1: [], 3: []} for k in ("flow", "price", "flow_low_price", "both")}
    dates = {1: [], 3: []}
    recent = []
    for m in months:
        rows = []
        for t in SECTORS:
            f3, p6 = window(t, m, 3, "flow_pct"), window(t, m, 6, "ret")
            if f3 is None or p6 is None:
                continue
            rows.append({"t": t, "f3": f3, "p6": p6, "fw1": forward(t, m, 1), "fw3": forward(t, m, 3)})
        if len(rows) < 8:
            continue
        for n, key in ((1, "fw1"), (3, "fw3")):
            valid = [r for r in rows if r[key] is not None]
            if len(valid) < 8:
                continue
            base = st.mean(r[key] for r in valid)
            by_f = sorted(valid, key=lambda r: r["f3"], reverse=True)
            by_p = sorted(valid, key=lambda r: r["p6"], reverse=True)
            top_f, bot_f, top_p, bot_p = by_f[:3], by_f[-3:], by_p[:3], by_p[-3:]
            series["flow"][n].append(st.mean(r[key] for r in top_f) - st.mean(r[key] for r in bot_f))
            series["price"][n].append(st.mean(r[key] for r in top_p) - st.mean(r[key] for r in bot_p))
            hf = {r["t"] for r in top_f}
            lowp = [r for r in valid if r["t"] in hf and r["t"] in {x["t"] for x in by_p[len(by_p) // 2:]}]
            hp = [r for r in valid if r["t"] in hf and r["t"] in {x["t"] for x in top_p}]
            series["flow_low_price"][n].append(st.mean(r[key] for r in lowp) - base if lowp else None)
            series["both"][n].append(st.mean(r[key] for r in hp) - base if hp else None)
            dates[n].append(m)
        recent.append({"month": m, "flow_rank": [r["t"] for r in sorted(rows, key=lambda r: r["f3"], reverse=True)[:3]]})

    result = {"기간": [months[0], months[-1]], "표본": meta, "결과": {}}
    for k, v in series.items():
        result["결과"][k] = {
            "1개월": summ(v[1]), "1개월 전반": summ(v[1][: len(v[1]) // 2]), "1개월 후반": summ(v[1][len(v[1]) // 2:]),
            "3개월": summ(v[3]), "3개월 건너": summ(v[3][::3]), "3개월 건너 전반": summ(v[3][::3][: len(v[3][::3]) // 2]), "3개월 건너 후반": summ(v[3][::3][len(v[3][::3]) // 2:]),
        }
    latest = months[-1]
    table = []
    for t, name in SECTORS.items():
        table.append({"t": t, "name": name, "flow_1m": round(window(t, latest, 1, "flow_pct") or 0, 2), "flow_3m": round(window(t, latest, 3, "flow_pct") or 0, 2),
                      "flow_12m": round(window(t, latest, 12, "flow_pct") or 0, 2), "ret_6m": round(window(t, latest, 6, "ret") or 0, 1)})
    result["최신"] = {"month": latest, "table": sorted(table, key=lambda r: -r["flow_3m"])}
    (folder / "etf_flow_test.json").write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps({"기간": result["기간"], "결과": result["결과"], "최신": result["최신"]}, ensure_ascii=False, indent=0))


if __name__ == "__main__":
    main()

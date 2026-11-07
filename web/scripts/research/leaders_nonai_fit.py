# -*- coding: utf-8 -*-
"""
leaders_nonai_fit.py — 주도주 2×2 규칙을 비AI 업종에 대 본다(2026-11-07 조사). 읽기만 한다.

묻는 것:
  1. 고정 기준(매출 YoY 15%·가속)을 통과하는 비율이 업종마다 얼마나 다른가
  2. 그 뒤 3개월 벤치마크 초과수익이 무리별로 갈리는가(leader − out)
  3. 업종 안 상대 기준(같은 날 업종 내 YoY 상위 1/3)으로 바꾸면 나아지는가
  4. 금융처럼 매출 태그가 없거나 뜻이 다른 업종의 자료 범위

⚠ 증명 못 하는 것: 표본은 **오늘의 대형주**다(생존·선택 편향) — 절대 수익은 보지 않고 무리 사이 차이만 본다.
   거래비용 없음. 겹치는 3개월 구간이라 관측치별 t는 부풀려진다 → **월별 스프레드의 평균·t**를 쓰고, 3개월 건너 표본도 함께 낸다.
⚠ 판정 함수는 볼트 validate-leaders.py의 것을 그대로 불러 쓴다. 공시일 기준(point-in-time).

실행: python web/scripts/research/leaders_nonai_fit.py <캐시·결과 폴더> [--months 48]
"""
import importlib.util
import json
import math
import statistics as st
import sys
import time
from pathlib import Path

VAULT = Path("D:/Woodsman/Investor/_scripts")
sys.path.insert(0, str(VAULT))
spec = importlib.util.spec_from_file_location("vl", VAULT / "validate-leaders.py")
VL = importlib.util.module_from_spec(spec)
spec.loader.exec_module(VL)
FL = VL.FL

SECTORS = {
    "헬스케어": ["LLY", "JNJ", "ABBV", "MRK", "PFE", "AMGN", "BMY", "GILD", "UNH", "ABT", "TMO", "ISRG", "VRTX", "REGN", "MDT"],
    "필수소비재": ["PG", "KO", "PEP", "WMT", "COST", "MO", "PM", "CL", "MDLZ", "KMB", "GIS", "HSY"],
    "금융": ["JPM", "BAC", "WFC", "GS", "MS", "C", "AXP", "BLK", "SCHW", "SPGI", "PGR", "CB"],
    "산업재": ["CAT", "DE", "HON", "UNP", "GE", "RTX", "LMT", "BA", "UPS", "MMM", "EMR", "ITW"],
    "에너지": ["XOM", "CVX", "COP", "SLB", "EOG", "OXY", "PSX", "MPC", "VLO", "KMI"],
    "유틸리티": ["NEE", "DUK", "SO", "D", "AEP", "EXC", "XEL", "SRE"],
    "경기소비재": ["AMZN", "TSLA", "HD", "MCD", "NKE", "LOW", "SBUX", "TJX", "BKNG", "CMG"],
}
BENCH = "SPY"


def load_or_fetch(folder: Path) -> dict:
    cache = folder / "nonai_cache.json"
    if cache.exists():
        return json.loads(cache.read_text(encoding="utf-8"))
    tickers = json.loads((VL.P.DATA / "sec-company-tickers.json").read_text(encoding="utf-8"))
    rows = tickers.values() if isinstance(tickers, dict) else tickers
    cik = {}
    for r in rows:
        if isinstance(r, dict) and r.get("ticker"):
            cik[str(r["ticker"]).upper()] = str(r.get("cik_str") or r.get("cik")).zfill(10)
    prices, facts = {BENCH: [[d.isoformat(), v] for d, v in FL.yahoo_daily(BENCH, "5y")]}, {}
    for sector, names in SECTORS.items():
        for t in names:
            try:
                prices[t] = [[d.isoformat(), v] for d, v in FL.yahoo_daily(t, "5y")]
                facts[t] = VL.pit_quarters(cik[t]) if t in cik else {}
                print(f"{sector} {t} 주가 {len(prices[t])} 분기 {len(facts[t].get('rev', {}))}", flush=True)
            except Exception as e:  # 표본에서 빠진 것을 결과에 적는다
                print(f"{sector} {t} 실패: {type(e).__name__}: {e}", flush=True)
            time.sleep(0.15)
    c = {"prices": prices, "facts": facts}
    cache.write_text(json.dumps(c), encoding="utf-8")
    return c


def tstat(xs):
    xs = [x for x in xs if x is not None]
    if len(xs) < 3:
        return None
    s = st.stdev(xs)
    return round(st.mean(xs) / (s / math.sqrt(len(xs))), 2) if s else None


def summary(xs):
    xs = [x for x in xs if x is not None]
    return {"n": len(xs), "mean": round(st.mean(xs), 2) if xs else None, "t": tstat(xs)}


def main():
    folder = Path(sys.argv[1])
    folder.mkdir(parents=True, exist_ok=True)
    months = int(sys.argv[sys.argv.index("--months") + 1]) if "--months" in sys.argv else 48
    c = load_or_fetch(folder)
    prices = {k: [(d, v) for d, v in s] for k, s in c["prices"].items()}
    bench = prices[BENCH]
    days = [d for d, _ in bench]
    ends = []
    for i, d in enumerate(days[:-1]):
        if d[:7] != days[i + 1][:7]:
            ends.append(d)
    ends = ends[-months:]
    idx = {d: i for i, d in enumerate(days)}

    def ret(series, day, back, fwd=0):
        ds = [d for d, _ in series]
        import bisect
        i = bisect.bisect_right(ds, day) - 1
        if i < 0:
            return None
        j = i + fwd - back
        k = i + fwd
        if j < 0 or k >= len(series) or k < 0:
            return None
        a, b = series[i - back if back else i][1], series[k][1]
        return (b / a - 1) * 100 if a else None

    out = {}
    for sector, names in SECTORS.items():
        obs = []
        tag_cover = sum(1 for t in names if len(c["facts"].get(t, {}).get("rev", {})) >= 8)
        for day in ends:
            row = []
            for t in names:
                s = prices.get(t)
                if not s:
                    continue
                g, _, ac = VL.pit_growth(c["facts"].get(t, {}), day)
                r3, r6 = ret(s, day, 63), ret(s, day, 126)
                b3, b6 = ret(bench, day, 63), ret(bench, day, 126)
                rs3 = r3 - b3 if None not in (r3, b3) else None
                rs6 = r6 - b6 if None not in (r6, b6) else None
                f3, bf3 = ret(s, day, 0, 63), ret(bench, day, 0, 63)
                row.append({"t": t, "g": g, "ac": ac, "rs3": rs3, "rs6": rs6, "cls": VL.classify(rs3, rs6, g, ac),
                            "fwd": f3 - bf3 if None not in (f3, bf3) else None, "day": day})
            gs = sorted(x["g"] for x in row if x["g"] is not None)
            cut = gs[int(len(gs) * 2 / 3)] if len(gs) >= 3 else None
            for x in row:
                strong = [v for v in (x["rs3"], x["rs6"]) if v is not None]
                price = bool(strong) and sum(strong) / len(strong) > 0
                x["rel"] = None if x["g"] is None or cut is None else (
                    "leader" if x["g"] >= cut and price else "candidate" if x["g"] >= cut else "watch" if price else "out")
            obs += row

        known = [o for o in obs if o["cls"]]
        def spread(key, dates=None):
            per = []
            for day in (dates or ends):
                a = [o["fwd"] for o in obs if o["day"] == day and o[key] == "leader" and o["fwd"] is not None]
                b = [o["fwd"] for o in obs if o["day"] == day and o[key] in ("out",) and o["fwd"] is not None]
                if a and b:
                    per.append(st.mean(a) - st.mean(b))
            return summary(per)
        out[sector] = {
            "종목": len(names), "매출자료 8분기 이상": tag_cover, "관측": len(obs), "판정 가능 비율": round(len(known) / max(1, len(obs)) * 100, 1),
            "YoY≥15 비율": round(sum(1 for o in known if o["g"] >= 15) / max(1, len(known)) * 100, 1),
            "YoY 중앙값": round(st.median([o["g"] for o in known]), 1) if known else None,
            "무리 비율(%)": {k: round(sum(1 for o in known if o["cls"] == k) / max(1, len(known)) * 100, 1) for k in ("leader", "candidate", "watch", "out")},
            "고정기준 fwd3m": {k: summary([o["fwd"] for o in obs if o["cls"] == k]) for k in ("leader", "candidate", "watch", "out")},
            "고정기준 월별 leader-out": spread("cls"),
            "고정기준 3개월 건너 leader-out": spread("cls", ends[::3]),
            "상대기준 월별 leader-out": spread("rel"),
            "상대기준 3개월 건너 leader-out": spread("rel", ends[::3]),
            "전체 fwd3m": summary([o["fwd"] for o in obs]),
        }

    result = {"기간": [ends[0], ends[-1]], "개월": len(ends), "벤치마크": BENCH, "업종": out}
    (folder / "nonai_fit.json").write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding="utf-8")
    for k, v in out.items():
        print(k, json.dumps(v, ensure_ascii=False))
    print("기간", result["기간"], "개월", result["개월"])


if __name__ == "__main__":
    main()

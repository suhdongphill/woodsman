"""같은 방법(월별 leader-out · 3개월 건너)으로 AI 표본(미국 종목)을 잰다 — 비AI 결과의 비교 기준."""
import bisect, importlib.util, json, math, statistics as st, sys
from pathlib import Path
V = Path("D:/Woodsman/Investor/_scripts"); sys.path.insert(0, str(V))
s = importlib.util.spec_from_file_location("vl", V / "validate-leaders.py"); VL = importlib.util.module_from_spec(s); s.loader.exec_module(VL)
c = json.loads((VL.P.DATA / "leaders_history.json").read_text(encoding="utf-8"))
P = c["prices"]; bench = P.get("SPY") or P[c["benchmarks"].get("us", "SPY")]
days = [d for d, _ in bench]
ends = [d for i, d in enumerate(days[:-1]) if d[:7] != days[i + 1][:7]][-48:]
def ret(sr, day, back, fwd=0):
    ds = [d for d, _ in sr]; i = bisect.bisect_right(ds, day) - 1
    if i < 0 or i - back < 0 or i + fwd >= len(sr): return None
    a, b = sr[i - back][1], sr[i + fwd][1]
    return (b / a - 1) * 100 if a else None
names = [t for t, m in c["meta"].items() if m.get("mkt", "us") == "us" and t in P]
obs = []
for day in ends:
    for t in names:
        sr = P[t]; g, _, ac = VL.pit_growth(c["facts"].get(t, {}), day)
        r3, r6, b3, b6 = ret(sr, day, 63), ret(sr, day, 126), ret(bench, day, 63), ret(bench, day, 126)
        rs3 = r3 - b3 if None not in (r3, b3) else None; rs6 = r6 - b6 if None not in (r6, b6) else None
        f, bf = ret(sr, day, 0, 63), ret(bench, day, 0, 63)
        obs.append((day, VL.classify(rs3, rs6, g, ac), f - bf if None not in (f, bf) else None))
def spread(ds):
    per = []
    for d in ds:
        a = [o[2] for o in obs if o[0] == d and o[1] == "leader" and o[2] is not None]
        b = [o[2] for o in obs if o[0] == d and o[1] == "out" and o[2] is not None]
        if a and b: per.append(st.mean(a) - st.mean(b))
    if len(per) < 3: return None
    return round(st.mean(per), 2), len(per), round(st.mean(per) / (st.stdev(per) / math.sqrt(len(per))), 2)
print("cache", c["built"][:10], "미국 종목", len(names), "기간", ends[0], ends[-1])
print("월별 leader-out", spread(ends)); print("3개월 건너", spread(ends[::3]))
known = [o for o in obs if o[1]]
print("무리 비율", {k: round(sum(1 for o in known if o[1] == k) / len(known) * 100, 1) for k in ("leader", "candidate", "watch", "out")})

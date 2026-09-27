"""study_result_*.json → 사람이 읽는 표. docs/연구_기타지표_유용성과중복.md의 숫자는 이 출력에서 옮긴다."""
import json, statistics as st, sys
d = json.load(open(sys.argv[1], encoding="utf-8"))
f = lambda v, k=2: "—" if v is None else f"{v:+.{k}f}"
print("sample", d["sample"])
print("code | n | start | IC ret12 (NW t) [전반/후반] | IC dd12 (NW t) [전반/후반] | AUC rec12 [90%] | AUC rec_now [90%]")
for c, u in d["usefulness"].items():
    r, dd, rc, rn = u["ret12"], u["dd12"], u["rec12"], u["rec_now"]
    h = lambda x: "/".join(f(v) for v in x.get("halves", []))
    print(c, "|", u["n_months"], "|", u["start"], "|", f(r["ic"]), f"({f(r['nw_t'],1)})", h(r), "|", f(dd["ic"]), f"({f(dd['nw_t'],1)})", h(dd),
          "|", f(rc["auc"]), [f(x) for x in rc["ci90"]], rc["n_pos_months"], "|", f(rn["auc"]), [f(x) for x in rn["ci90"]], rn["n_pos_months"])
b = d["pillar_baseline"]
def dist(vals):
    v = sorted(x for x in vals if x is not None)
    return f"중앙값 {st.median(v):.3f} · 상위25% {v[int(len(v)*.75)]:.3f} · n {len(v)}"
print("기둥 지표 기준선 |IC ret12|", dist(abs(v["ret12"]["ic"]) if v["ret12"]["ic"] is not None else None for v in b.values()))
print("기둥 지표 기준선 |IC dd12| ", dist(abs(v["dd12"]["ic"]) if v["dd12"]["ic"] is not None else None for v in b.values()))
print("기둥 지표 기준선 |AUC rec12−0.5|", dist(abs(v["rec12"]["auc"] - .5) if v["rec12"]["auc"] is not None else None for v in b.values()))
print("기둥 지표 기준선 |AUC rec_now−0.5|", dist(abs(v["rec_now"]["auc"] - .5) if v["rec_now"]["auc"] is not None else None for v in b.values()))
print("== 중복 (P=기둥 지표, O=기타)")
for c, r in d["redundancy"].items():
    cp = r["closest_pillar"]
    print(c, "| 가장 닮은 기둥 지표:", cp and f"{cp['with']} 수준 {f(cp['rho_level'])} 변화 {f(cp['rho_chg12'])} n{cp['n']}",
          "| 그것 통제한 편IC ret12", f(r["partial_ic_given_closest"].get("ret12")), "dd12", f(r["partial_ic_given_closest"].get("dd12")))
    for t in r["top"]:
        print("    ", t["with"], "P" if t["in_pillar"] else "O", f(t["rho_level"]), f(t["rho_chg12"]), t["n"])

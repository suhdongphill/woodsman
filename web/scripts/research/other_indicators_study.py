"""
GCRM 「기타」 지표 연구 — 시장 변화에 유용한가 · 기둥 지표와 중복인가.

결과 문서: docs/연구_기타지표_유용성과중복.md  (숫자는 전부 이 스크립트 출력에서 옮긴다)

입력 (scripts/research/data/, 2026-09-27 스냅숏)
- gcrm_monthly_*.json  : GCRM이 실제로 보는 값(파생·변환 뒤)의 월말 값 — gcrm-series-export.mjs
- gspc_monthly_yahoo_*.json : S&P 500 지수(^GSPC) 월간 종가, Yahoo Finance chart API
- usrec_fred_*.json    : NBER 경기침체 월 표시(USREC), FRED

방법 (⚠ 되돌리기 전에 문서의 「방법」 절을 먼저 읽는다)
- 발표 시차: 일간·주간 계열 0개월, 월간 1개월, 분기 4개월을 밀어 **그때 알 수 있던 값**만 쓴다.
- 목표 세 개(월 t 기준): 향후 12개월 로그수익률 · 향후 12개월 최대낙폭 · t+1..t+12 안에 경기침체가 있나.
  ⚠ 경기침체 목표는 **지금 경기침체가 아닌 달만** 쓴다(이미 들어간 뒤 맞히는 것은 예측이 아니다).
- 유용성: 스피어만 IC(순위 상관) + Newey-West t(시차 12 — 겹치는 12개월 창 때문에 보통 t는 부풀려진다),
  경기침체는 AUC와 블록 부트스트랩(24개월 블록) 90% 구간. 표본 전반·후반의 부호가 같은지(안정성).
- 중복: 기둥 지표와 스피어만 ρ를 **수준**과 **12개월 변화** 둘 다. 둘 다 높아야 중복 후보
  (수준만 높으면 같은 추세를 탔을 뿐일 수 있다).
- 증분: 가장 닮은 기둥 지표를 통제한 편상관(순위) — 겹쳐도 더 주는 정보가 있는가.
- 동행: 「지금 경기침체인가」 AUC도 잰다 — 확인용 지표(sahm 등)는 선행이 아니라 동행으로 평가해야 공정하다.
- AUC < 0.5는 **설정된 부호와 반대로** 맞힌다는 뜻이다(쓸모가 없다는 뜻이 아니다).
- 표본: 월간 1990-01 ~ 2026-08. 경기침체 4번(1990-91·2001·2008-09·2020) — ⚠ 사건 수가 적다.
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

DATA = Path(__file__).parent / "data"
SNAP = "20260927"
OTHER = ["unrate", "sahm", "claims", "nfp_mom", "jolts", "sox", "ust2y", "ust30y", "mortgage30",
         "indpro_yoy", "tsy_coupon_share", "real_comp_yoy", "pot_gdp_yoy", "semi_ppi_yoy", "copper"]
LAG = {"d": 0, "w": 0, "m": 1, "q": 4}
MIN_OBS = 120
rng = np.random.default_rng(20260927)


def load():
    g = json.loads((DATA / f"gcrm_monthly_{SNAP}.json").read_text(encoding="utf-8"))
    meta, cols = {}, {}
    for ind in g["indicators"]:
        s = pd.Series(ind["monthly"], dtype=float)
        s.index = pd.PeriodIndex(s.index, freq="M")
        s = s.sort_index().shift(LAG.get(ind["freq"], 1), freq="M")  # 발표 시차
        cols[ind["code"]] = s
        meta[ind["code"]] = ind
    X = pd.DataFrame(cols)

    y = json.loads((DATA / f"gspc_monthly_yahoo_{SNAP}.json").read_text())["chart"]["result"][0]
    px = pd.Series(y["indicators"]["quote"][0]["close"],
                   index=pd.to_datetime(y["timestamp"], unit="s").to_period("M"), dtype=float)
    px = px[~px.index.duplicated(keep="last")].dropna()

    r = json.loads((DATA / f"usrec_fred_{SNAP}.json").read_text())["observations"]
    rec = pd.Series({pd.Period(o["date"][:7], "M"): float(o["value"]) for o in r})
    return X, meta, px, rec


def targets(px, rec):
    idx = px.index
    fwd = np.log(px.shift(-12) / px)
    dd = pd.Series(np.nan, index=idx)
    v = px.values
    for i in range(len(v) - 12):
        dd.iloc[i] = v[i + 1:i + 13].min() / v[i] - 1
    rec = rec.reindex(idx)
    ahead = pd.concat([rec.shift(-k) for k in range(1, 13)], axis=1)
    fut = ahead.max(axis=1).where(ahead.notna().all(axis=1))
    fut = fut.where(rec == 0)  # 이미 경기침체인 달은 뺀다
    # 동행 목표 — 지금 경기침체인가. ⚠ sahm·claims처럼 「시작을 확인하는」 지표는 선행 목표로만 재면 불공정하다.
    return pd.DataFrame({"ret12": fwd, "dd12": dd, "rec12": fut, "rec_now": rec})


def rank(s):
    return s.rank()


def spearman(a, b):
    m = a.notna() & b.notna()
    if m.sum() < MIN_OBS:
        return np.nan, int(m.sum())
    return float(np.corrcoef(rank(a[m]), rank(b[m]))[0, 1]), int(m.sum())


def nw_t(x, y, lag=12):
    """y ~ a + b·x (둘 다 순위 표준화) 의 b에 대한 Newey-West t."""
    m = x.notna() & y.notna()
    x, y = rank(x[m]).values, rank(y[m]).values
    x = (x - x.mean()) / x.std(); y = (y - y.mean()) / y.std()
    n = len(x)
    b = (x @ y) / (x @ x)
    u = (y - b * x) * x
    s = u @ u
    for L in range(1, lag + 1):
        w = 1 - L / (lag + 1)
        s += 2 * w * (u[L:] @ u[:-L])
    se = np.sqrt(s) / (x @ x)
    return float(b / se)


def auc(score, label):
    m = score.notna() & label.notna()
    s, l = score[m].values, label[m].values
    pos, neg = s[l == 1], s[l == 0]
    if len(pos) < 6 or len(neg) < 6:
        return np.nan, (np.nan, np.nan), int(len(pos))
    def _auc(s, l):
        r = pd.Series(s).rank().values
        p = l == 1
        return (r[p].sum() - p.sum() * (p.sum() + 1) / 2) / (p.sum() * (~p).sum())
    a = _auc(s, l)
    boots, n, B = [], len(s), 24
    for _ in range(500):
        starts = rng.integers(0, n - B, size=n // B + 1)
        ii = np.concatenate([np.arange(k, k + B) for k in starts])[:n]
        if 0 < l[ii].sum() < len(ii):
            boots.append(_auc(s[ii], l[ii]))
    return float(a), (float(np.percentile(boots, 5)), float(np.percentile(boots, 95))), int(len(pos))


def partial_rank(a, b, c):
    """a와 b의 순위 편상관, c 통제."""
    m = a.notna() & b.notna() & c.notna()
    if m.sum() < MIN_OBS:
        return np.nan
    A, Bv, C = rank(a[m]), rank(b[m]), rank(c[m])
    rab, rac, rbc = np.corrcoef(A, Bv)[0, 1], np.corrcoef(A, C)[0, 1], np.corrcoef(Bv, C)[0, 1]
    return float((rab - rac * rbc) / np.sqrt((1 - rac ** 2) * (1 - rbc ** 2)))


def main():
    X, meta, px, rec = load()
    T = targets(px, rec)
    X = X.reindex(T.index)
    pillar_codes = [c for c in X.columns if meta[c]["pillars"]]
    other = [c for c in OTHER if c in X.columns]

    out = {"sample": [str(T.index.min()), str(T.index.max())], "usefulness": {}, "redundancy": {}, "pillar_baseline": {}}

    def usefulness(c):
        x = X[c] * meta[c]["polarity"]  # 부호: 클수록 「좋다」 쪽으로 맞춘다
        res = {"n_months": int(x.notna().sum()), "start": str(x.first_valid_index())}
        for tgt in ["ret12", "dd12"]:
            ic, n = spearman(x, T[tgt])
            res[tgt] = {"ic": ic, "n": n, "nw_t": nw_t(x, T[tgt]) if n >= MIN_OBS else np.nan}
            m = x.notna() & T[tgt].notna()
            half = m[m].index[len(m[m]) // 2] if m.sum() else None
            if half is not None and n >= MIN_OBS:
                a1, _ = spearman(x[:half], T[tgt][:half]); a2, _ = spearman(x[half:], T[tgt][half:])
                res[tgt]["halves"] = [a1, a2]
        # 경기침체: 「나쁠수록 경기침체」이므로 −x를 점수로
        a, ci, npos = auc(-x, T["rec12"])
        res["rec12"] = {"auc": a, "ci90": ci, "n_pos_months": npos}
        a, ci, npos = auc(-x, T["rec_now"])
        res["rec_now"] = {"auc": a, "ci90": ci, "n_pos_months": npos}
        return res

    for c in other:
        out["usefulness"][c] = usefulness(c)
    for c in pillar_codes:
        out["pillar_baseline"][c] = usefulness(c)

    # 중복
    chg = X.diff(12)
    for c in other:
        rows = []
        for p in pillar_codes + [o for o in other if o != c]:
            lv, n = spearman(X[c], X[p])
            ch, _ = spearman(chg[c], chg[p])
            if np.isnan(lv):
                continue
            rows.append({"with": p, "in_pillar": p in pillar_codes, "rho_level": lv, "rho_chg12": ch, "n": n})
        rows.sort(key=lambda r: -(min(abs(r["rho_level"]), abs(r["rho_chg12"]) if not np.isnan(r["rho_chg12"]) else 0)))
        top = rows[:4]
        best = next((r for r in rows if r["in_pillar"]), None)
        inc = {}
        if best:
            x = X[c] * meta[c]["polarity"]
            for tgt in ["ret12", "dd12"]:
                inc[tgt] = partial_rank(x, T[tgt], X[best["with"]])
        out["redundancy"][c] = {"top": top, "closest_pillar": best, "partial_ic_given_closest": inc}

    def clean(v):
        if isinstance(v, float) and np.isnan(v):
            return None
        if isinstance(v, dict):
            return {k: clean(x) for k, x in v.items()}
        if isinstance(v, (list, tuple)):
            return [clean(x) for x in v]
        return v
    # ⚠ NaN을 JSON에 그대로 두면 요약 단계의 중앙값이 NaN이 된다(2026-09-27 첫 판에서 실제로 났다).
    print(json.dumps(clean(out), ensure_ascii=False, indent=1))


if __name__ == "__main__":
    sys.exit(main())

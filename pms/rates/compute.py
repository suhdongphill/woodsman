"""파생 지표 계산 — 명세 §4를 그대로 구현한다.

## ⚠ 이 파일이 지키는 것
- **모든 지표는 입력을 되짚을 수 있다.** 각 결과에 ``inputs``(계열 ID → 관측일·값)를 붙이고,
  ``rates_snapshot.inputs_json``으로 저장한다(명세 §0-2). 근거 없는 숫자는 저장되지 않는다.
- **입력이 없으면 ``None``이다.** 대충 채운 값으로 지수를 만들면, 그 지수는 언제나 산출되지만
  아무것도 뜻하지 않는다.
- **상수는 설정에서 온다.** r*·기준월·가중치는 ``config/rates_*.yaml``에 있고, 없으면
  그 레이어를 빼고 **가중치를 재정규화**한 뒤 「부분 산출」로 표시한다(명세 §4-7).
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from datetime import date
from typing import Any, Mapping, Sequence

import yaml

from . import transforms as T

Point = tuple[str, float | None]


@dataclass
class Metric:
    """파생 지표 하나. ⚠ ``inputs``가 비면 저장 단계에서 거부된다."""

    key: str
    value: float | None
    unit: str
    band: str | None = None
    inputs: dict[str, Any] = field(default_factory=dict)
    note: str | None = None


def _input(series_id: str, pair: tuple[str, float] | None) -> dict[str, Any]:
    """입력 하나를 ``{"DFF": {"date": ..., "value": ...}}`` 꼴로."""
    if pair is None:
        return {series_id: None}
    return {series_id: {"date": pair[0], "value": pair[1]}}


def load_params(path: str | None = None) -> dict[str, Any]:
    path = path or _config("rates_params.yaml")
    with open(path, "r", encoding="utf-8") as fp:
        return yaml.safe_load(fp) or {}


def load_weights(path: str | None = None) -> dict[str, Any]:
    path = path or _config("rates_weights.yaml")
    with open(path, "r", encoding="utf-8") as fp:
        return yaml.safe_load(fp) or {}


def _config(name: str) -> str:
    here = os.path.dirname(os.path.abspath(__file__))
    root = os.path.dirname(os.path.dirname(here))
    return os.path.join(root, "config", name)


# ── 4-1. 실질 정책금리 ───────────────────────────────────────────


def real_policy_rate(
    dff: Sequence[Point], trimmed: Sequence[Point], month: str
) -> Metric:
    """``DFF(월평균) − 절사평균 PCE``.

    절사평균을 쓰는 이유는 에너지처럼 공급 요인이 만든 일시적 변동을 걸러내기 위해서다.
    """
    dff_avg = T.monthly_mean(dff, month)
    trim_pair = T.as_of(trimmed, f"{month}-28")
    trim = trim_pair[1] if trim_pair else None

    value = None if dff_avg is None or trim is None else dff_avg - trim
    return Metric(
        key="real_policy_rate",
        value=value,
        unit="percent",
        inputs={
            "DFF": {"date": f"{month} 월평균", "value": dff_avg},
            **_input("PCETRIM12M159SFRBDAL", trim_pair),
        },
    )


def real_policy_rate_headline(
    dff: Sequence[Point], pcepi: Sequence[Point], month: str
) -> Metric:
    """헤드라인 PCE 기준 실질 정책금리.

    ⚠ 절사평균 기준과 **나란히** 보여준다. 둘의 차이가 곧 「공급 요인이 만든 착시」의 크기다.
    """
    dff_avg = T.monthly_mean(dff, month)
    series = T.to_map(pcepi)
    day = f"{month}-01"
    headline = T.yoy(series, day)

    value = None if dff_avg is None or headline is None else dff_avg - headline
    return Metric(
        key="real_policy_rate_headline",
        value=value,
        unit="percent",
        inputs={
            "DFF": {"date": f"{month} 월평균", "value": dff_avg},
            "PCEPI": {"date": day, "value": series.get(day), "yoy": headline},
        },
    )


# ── 4-2. 수동적 긴축 분해 ────────────────────────────────────────


def passive_tightening(
    dff: Sequence[Point], trimmed: Sequence[Point], month: str, months_back: int
) -> list[Metric]:
    """실질금리 변화를 명목 기여와 인플레 기여로 가른다.

    ``Δreal = Δnominal − Δinflation`` 이 성립해야 한다(허용 오차 0.01%p).
    ``passive_tightening = −Δinflation`` — **연준이 아무것도 하지 않았는데 조여진 양**이다.
    ⚠ 부호 규약: 양수 = 긴축 강화.
    """
    then_month = T.shift_months(f"{month}-01", -months_back)[:7]

    now_dff = T.monthly_mean(dff, month)
    then_dff = T.monthly_mean(dff, then_month)
    now_trim_pair = T.as_of(trimmed, f"{month}-28")
    then_trim_pair = T.as_of(trimmed, f"{then_month}-28")
    now_trim = now_trim_pair[1] if now_trim_pair else None
    then_trim = then_trim_pair[1] if then_trim_pair else None

    suffix = f"{months_back}m"
    inputs = {
        "DFF": {"now": {"date": month, "value": now_dff}, "then": {"date": then_month, "value": then_dff}},
        "PCETRIM12M159SFRBDAL": {
            "now": {"date": now_trim_pair[0] if now_trim_pair else None, "value": now_trim},
            "then": {"date": then_trim_pair[0] if then_trim_pair else None, "value": then_trim},
        },
    }

    if None in (now_dff, then_dff, now_trim, then_trim):
        return [
            Metric(f"passive_tightening_{suffix}", None, "percent", inputs=inputs),
            Metric(f"delta_real_{suffix}", None, "percent", inputs=inputs),
            Metric(f"delta_nominal_{suffix}", None, "percent", inputs=inputs),
        ]

    d_nominal = now_dff - then_dff  # type: ignore[operator]
    d_inflation = now_trim - then_trim  # type: ignore[operator]
    d_real = (now_dff - now_trim) - (then_dff - then_trim)  # type: ignore[operator]

    # ⚠ 항등식이 깨지면 계산이 아니라 입력이 틀린 것이다. 조용히 넘기지 않는다.
    if abs(d_real - (d_nominal - d_inflation)) > 0.01:
        raise ValueError(
            f"항등식 위반: Δreal {d_real:.4f} ≠ Δnominal {d_nominal:.4f} − Δinfl {d_inflation:.4f}"
        )

    return [
        Metric(f"passive_tightening_{suffix}", -d_inflation, "percent", inputs=inputs,
               note="양수 = 인플레 둔화로 실질금리가 저절로 오른 만큼"),
        Metric(f"delta_real_{suffix}", d_real, "percent", inputs=inputs),
        Metric(f"delta_nominal_{suffix}", d_nominal, "percent", inputs=inputs),
    ]


# ── 4-3. 두 속도 경제 ────────────────────────────────────────────


def two_speed_spread(
    series: Mapping[str, Sequence[Point]], month: str, weights: Mapping[str, Any]
) -> list[Metric]:
    """``현금 조달 부문 − 금리 민감 부문`` (%p).

    ⚠ 합성값만 보면 **어느 부문이 움직였는지 사라진다.** 그래서 구성 항목도 각각 지표로 남긴다
       (화면이 막대로 그린다, 명세 §4-3).
    """
    cfg = weights.get("two_speed") or {}
    out: list[Metric] = []
    group_values: dict[str, list[float]] = {"rate_sensitive": [], "cash_financed": []}
    group_inputs: dict[str, dict[str, Any]] = {"rate_sensitive": {}, "cash_financed": {}}

    for group in ("rate_sensitive", "cash_financed"):
        for series_id in (cfg.get(group) or {}):
            points = series.get(series_id) or []
            smap = T.to_map(points)
            # 분기 계열은 그 분기 시작일에 관측이 찍힌다 — 해당 시점 이하의 마지막 관측을 쓴다.
            pair = T.as_of(points, f"{month}-28")
            value = T.yoy(smap, pair[0]) if pair else None

            out.append(
                Metric(
                    key=f"two_speed_component_{series_id.lower()}",
                    value=value,
                    unit="percent",
                    band=group,
                    inputs=_input(series_id, pair),
                )
            )
            group_inputs[group].update(_input(series_id, pair))
            if value is not None:
                group_values[group].append(value)

    def mean(name: str) -> float | None:
        vals = group_values[name]
        return sum(vals) / len(vals) if vals else None

    rate_sensitive = mean("rate_sensitive")
    cash_financed = mean("cash_financed")
    spread = (
        None
        if rate_sensitive is None or cash_financed is None
        else cash_financed - rate_sensitive
    )

    inputs = {**group_inputs["rate_sensitive"], **group_inputs["cash_financed"]}
    note = None
    if not (cfg.get("cash_financed") or {}).get("Y033RX1Q020SBEA"):
        # ⚠ 설비투자 계열이 아직 사람 손을 안 거쳤다. 그 사실을 숫자 옆에 남긴다.
        note = "부분 산출 — 설비투자 실질 계열이 아직 확정되지 않았습니다(config/rates_series.yaml)"

    out.append(Metric("two_speed_rate_sensitive", rate_sensitive, "percent", inputs=group_inputs["rate_sensitive"]))
    out.append(Metric("two_speed_cash_financed", cash_financed, "percent", inputs=group_inputs["cash_financed"]))
    out.append(Metric("two_speed_spread", spread, "percent", inputs=inputs, note=note))
    return out


# ── 4-4. 참가율 조정 실업률 ──────────────────────────────────────


def participation_adjusted_unrate(
    civpart: Sequence[Point],
    cnp16ov: Sequence[Point],
    ce16ov: Sequence[Point],
    unrate: Sequence[Point],
    month: str,
    base_month: str,
) -> list[Metric]:
    """기준월의 참가율로 고정했을 때의 실업률과, 공식 실업률과의 격차.

    ⚠ 기준월을 바꾸면 값이 크게 달라진다. 그래서 ``inputs``와 화면 양쪽에 **어느 시점 참가율로
       고정했는지** 반드시 남긴다 — 기준을 숨기면 조작이 된다(명세 §4-4).
    """
    day = f"{month}-01"
    base_day = f"{base_month}-01"

    base_part = T.to_map(civpart).get(base_day)
    pop = T.to_map(cnp16ov).get(day)
    emp = T.to_map(ce16ov).get(day)
    official = T.to_map(unrate).get(day)

    inputs = {
        "CIVPART": {"date": base_day, "value": base_part, "role": "기준월 참가율(고정)"},
        "CNP16OV": {"date": day, "value": pop},
        "CE16OV": {"date": day, "value": emp},
        "UNRATE": {"date": day, "value": official},
        "base_month": base_month,
    }

    if None in (base_part, pop, emp):
        return [
            Metric("participation_adjusted_unrate", None, "percent", inputs=inputs),
            Metric("participation_gap", None, "percent", inputs=inputs),
        ]

    adj_lf = (base_part / 100.0) * pop  # type: ignore[operator]
    adj_u = adj_lf - emp  # type: ignore[operator]
    adj_ur = adj_u / adj_lf * 100.0
    gap = None if official is None else adj_ur - official

    return [
        Metric("participation_adjusted_unrate", adj_ur, "percent", inputs=inputs,
               note=f"{base_month} 참가율({base_part}%)로 고정"),
        Metric("participation_gap", gap, "percent", inputs=inputs),
    ]


# ── 4-5. 노동시장 냉각 ───────────────────────────────────────────


def labor_cooling(
    hires: Sequence[Point],
    quits: Sequence[Point],
    payems: Sequence[Point],
    layoffs: Sequence[Point],
    month: str,
    years: int = 10,
) -> Metric:
    """0~100. 높을수록 냉각. ⚠ 해고율은 부호를 뒤집는다(낮은 해고 = 냉각 아님).

    「저채용·저해고」 판정: 채용률 백분위 < 25 **그리고** 해고율 백분위 < 25.
    """
    day = f"{month}-01"
    start = T.shift_months(day, -12 * years)

    def rank(points: Sequence[Point], invert: bool = False) -> tuple[float | None, tuple[str, float] | None]:
        pair = T.as_of(points, f"{month}-28")
        if pair is None:
            return None, None
        window = [v for d, v in T.observed(points) if start <= d <= pair[0]]
        pr = T.percentile_rank(window, pair[1])
        if pr is None:
            return None, pair
        return (100.0 - pr if invert else pr), pair

    # 채용률·이직률·고용증가는 **낮을수록 냉각**이라 백분위를 뒤집는다.
    hire_pr, hire_pair = rank(hires, invert=True)
    quit_pr, quit_pair = rank(quits, invert=True)
    layoff_pr, layoff_pair = rank(layoffs, invert=False)

    payems_ma = T.moving_average(payems, day, 3)
    payems_hist = []
    smap = T.to_map(payems)
    for i in range(12 * years):
        d = T.shift_months(day, -i)
        ma = T.moving_average(payems, d, 3)
        if ma is not None and smap.get(T.shift_months(d, -3)) is not None:
            payems_hist.append(ma - smap[T.shift_months(d, -3)])  # 3개월 증감
    payems_delta = (
        None
        if payems_ma is None or smap.get(T.shift_months(day, -3)) is None
        else payems_ma - smap[T.shift_months(day, -3)]
    )
    payems_pr = (
        None
        if payems_delta is None
        else (lambda pr: None if pr is None else 100.0 - pr)(
            T.percentile_rank(payems_hist, payems_delta)
        )
    )

    parts = [p for p in (hire_pr, quit_pr, layoff_pr, payems_pr) if p is not None]
    value = sum(parts) / len(parts) if parts else None

    band = None
    # ⚠ 원래 백분위(뒤집기 전)로 판정한다 — 낮은 채용·낮은 해고가 동시에 있는 상태다.
    if hire_pr is not None and layoff_pr is not None:
        raw_hire = 100.0 - hire_pr
        if raw_hire < 25 and layoff_pr < 25:
            band = "low_hire_low_fire"

    return Metric(
        key="labor_cooling",
        value=value,
        unit="percentile",
        band=band,
        inputs={
            **_input("JTSHIR", hire_pair),
            **_input("JTSQUR", quit_pair),
            **_input("JTSLDR", layoff_pair),
            "PAYEMS": {"date": day, "ma3_delta": payems_delta},
            "scored": len(parts),
        },
        note=f"{len(parts)}개 성분으로 산출(과거 {years}년 백분위)",
    )


# ── 4-6. 한·미 금리차 ────────────────────────────────────────────


def kr_us_gaps(
    dff: Sequence[Point],
    kr_policy: Sequence[Point],
    dgs10: Sequence[Point],
    kr_10y: Sequence[Point],
    day: str,
) -> list[Metric]:
    """정책금리차·10년 금리차. ⚠ 양수 = 미국이 높음."""
    us_p = T.as_of(dff, day)
    kr_p = T.as_of(kr_policy, day)
    us_10 = T.as_of(dgs10, day)
    kr_10 = T.as_of(kr_10y, day)

    policy_gap = None if not (us_p and kr_p) else us_p[1] - kr_p[1]
    ten_gap = None if not (us_10 and kr_10) else us_10[1] - kr_10[1]

    return [
        Metric("kr_us_policy_gap", policy_gap, "percent",
               inputs={**_input("DFF", us_p), **_input("ECOS:722Y001:0101000", kr_p)}),
        Metric("kr_us_10y_gap", ten_gap, "percent",
               inputs={**_input("DGS10", us_10), **_input("ECOS:817Y002:010210000", kr_10)}),
    ]


def gap_fx_correlation(
    gap_points: Sequence[Point], fx: Sequence[Point], window: int = 250
) -> Metric:
    """최근 ``window`` 거래일의 상관계수.

    ⚠ **상관은 인과가 아니다.** 화면 문구는 「함께 움직인 정도」로만 쓴다(명세 §4-6).
    """
    gmap = T.to_map(gap_points)
    pairs = [(d, v, gmap[d]) for d, v in T.observed(fx) if gmap.get(d) is not None][-window:]
    if len(pairs) < 30:
        return Metric("kr_us_gap_fx_corr", None, "correlation",
                      inputs={"pairs": len(pairs)},
                      note="짝이 되는 관측이 부족합니다")

    xs = [p[2] for p in pairs]
    ys = [p[1] for p in pairs]
    n = len(xs)
    mx, my = sum(xs) / n, sum(ys) / n
    cov = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    vx = sum((x - mx) ** 2 for x in xs) ** 0.5
    vy = sum((y - my) ** 2 for y in ys) ** 0.5
    corr = None if vx == 0 or vy == 0 else cov / (vx * vy)

    return Metric(
        "kr_us_gap_fx_corr", corr, "correlation",
        inputs={"window": n, "from": pairs[0][0], "to": pairs[-1][0]},
        note="함께 움직인 정도일 뿐 인과가 아니다",
    )


# ── 4-7. 인하 압력 지수 ──────────────────────────────────────────


def renormalize(weights: Mapping[str, float], available: Mapping[str, float | None]) -> dict[str, float]:
    """산출된 레이어만 남기고 가중치를 100으로 다시 맞춘다.

    ⚠ 빠진 레이어를 0점으로 치면 「안 본 것」이 「인하 논거가 없는 것」이 된다.
    """
    live = {k: w for k, w in weights.items() if available.get(k) is not None}
    total = sum(live.values())
    if total <= 0:
        return {}
    return {k: w / total * 100.0 for k, w in live.items()}


def easing_pressure_index(
    layer_scores: Mapping[str, float | None],
    weights: Mapping[str, float],
    inputs: Mapping[str, Any],
) -> Metric:
    """레이어 점수(0~100)를 가중 합성한다. 높을수록 인하 논거가 강하다."""
    live = renormalize(weights, layer_scores)
    if not live:
        return Metric("easing_pressure_index", None, "index", inputs=dict(inputs),
                      note="산출된 레이어가 없습니다")

    value = sum(layer_scores[k] * w / 100.0 for k, w in live.items())  # type: ignore[index]
    partial = len(live) < len(weights)
    missing = sorted(k for k in weights if k not in live)

    band = "easing" if value >= 60 else "tightening" if value <= 40 else "neutral"
    return Metric(
        "easing_pressure_index",
        value,
        "index",
        band=band,
        inputs={**inputs, "weights_used": live, "missing_layers": missing},
        note="부분 산출 — " + ", ".join(missing) if partial else None,
    )

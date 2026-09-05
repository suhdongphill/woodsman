"""``compute``와 ``export``의 실제 일 — DB에서 읽어 지표를 만들고 JSON으로 낸다.

⚠ 이 파일은 **조립**이다. 계산식은 ``compute.py``·``layers.py``에, 변환은 ``transforms.py``에
   있다. 여기에 새 수식을 적기 시작하면 테스트가 닿지 않는 자리에 판단이 생긴다.
"""

from __future__ import annotations

import json
import os
import sqlite3
from datetime import date, datetime
from typing import Any

from . import compute, layers
from . import transforms as T
from .catalog import load_catalog
from .db import list_series, load_observations, load_releases, upsert_snapshot

Point = tuple[str, float | None]


def _series(conn: sqlite3.Connection, series_id: str) -> list[Point]:
    return load_observations(conn, series_id)


def compute_all(conn: sqlite3.Connection, asof: str) -> list[compute.Metric]:
    """명세 §4의 지표를 전부 만든다. ⚠ 입력이 없으면 값이 ``None``이고, 그대로 저장된다."""
    params = compute.load_params()
    weights = compute.load_weights()
    target = float(params.get("inflation_target") or 2.0)
    base_month = str((params.get("participation_base") or {}).get("month") or asof[:7])
    neutral = (params.get("neutral_rate") or {}).get("value")
    years = int(params.get("percentile_years") or 10)

    get = lambda sid: _series(conn, sid)  # noqa: E731 — 짧은 별칭이 읽기 쉽다

    dff, trimmed, pcepi, core = get("DFF"), get("PCETRIM12M159SFRBDAL"), get("PCEPI"), get("PCEPILFE")

    # 월간 지표의 기준월은 **절사평균 PCE의 최신 관측월**이다. 가장 늦게 나오는 축을 따라간다.
    trim_latest = T.latest(trimmed)
    month = trim_latest[0][:7] if trim_latest else asof[:7]

    metrics: list[compute.Metric] = []
    metrics.append(compute.real_policy_rate(dff, trimmed, month))
    metrics.append(compute.real_policy_rate_headline(dff, pcepi, month))
    for months_back in (6, 12):
        metrics.extend(compute.passive_tightening(dff, trimmed, month, months_back))

    two_speed_ids = set()
    for group in (weights.get("two_speed") or {}).values():
        two_speed_ids.update(group or {})
    metrics.extend(
        compute.two_speed_spread({sid: get(sid) for sid in two_speed_ids}, month, weights)
    )

    civpart, cnp, ce, unrate = get("CIVPART"), get("CNP16OV"), get("CE16OV"), get("UNRATE")
    labor_month = (T.latest(unrate) or (month + "-01", None))[0][:7]
    metrics.extend(
        compute.participation_adjusted_unrate(civpart, cnp, ce, unrate, labor_month, base_month)
    )

    payems = get("PAYEMS")
    cooling = compute.labor_cooling(get("JTSHIR"), get("JTSQUR"), payems, get("JTSLDR"), month, years)
    metrics.append(cooling)

    kr_policy = get("ECOS:722Y001:0101000")
    kr_10y = get("ECOS:817Y002:010210000")
    gaps = compute.kr_us_gaps(dff, kr_policy, get("DGS10"), kr_10y, asof)
    metrics.extend(gaps)

    fx = get("DEXKOUS")
    # 금리차 시계열을 만들어 상관을 잰다(관측이 둘 다 있는 날만).
    dff_map, kr_map = T.to_map(dff), T.to_map(kr_policy)
    gap_points: list[Point] = [
        (d, dff_map[d] - kr_map[d])
        for d in sorted(set(dff_map) & set(kr_map))
        if dff_map.get(d) is not None and kr_map.get(d) is not None
    ]
    metrics.append(compute.gap_fx_correlation(gap_points, fx))

    # ── 레이어 점수 ──────────────────────────────────────────
    by_key = {m.key: m for m in metrics}
    real_policy = by_key["real_policy_rate"].value
    participation_gap = by_key["participation_gap"].value
    payems_ma3 = None
    payems_map = T.to_map(payems)
    latest_payems = T.latest(payems)
    if latest_payems:
        prev = payems_map.get(T.shift_months(latest_payems[0], -3))
        ma = T.moving_average(payems, latest_payems[0], 3)
        if prev is not None and ma is not None:
            payems_ma3 = (latest_payems[1] - prev) / 3.0

    rsafs_real = None
    rsafs_map, cpi_map = T.to_map(get("RSAFS")), T.to_map(get("CPIAUCSL"))
    rsafs_latest = T.latest(get("RSAFS"))
    if rsafs_latest:
        nominal = T.yoy(rsafs_map, rsafs_latest[0])
        prices = T.yoy(cpi_map, rsafs_latest[0])
        if nominal is not None and prices is not None:
            rsafs_real = nominal - prices

    scores = {
        "inflation": layers.inflation_layer(trimmed, core, get("T10YIE"), asof, target),
        "labor": layers.labor_layer(cooling.value, participation_gap, payems_ma3),
        "policy_stance": layers.policy_stance_layer(real_policy, neutral, get("DFII10"), asof),
        "credit": layers.credit_layer(
            get("PSAVERT"), get("DRCCLACBS"), get("BAMLH0A0HYM2"), rsafs_real, asof, years
        ),
        "external": layers.external_layer(by_key["kr_us_policy_gap"].value, fx, asof),
    }

    for name, score in scores.items():
        metrics.append(
            compute.Metric(f"layer_{name}", score.value, "index", inputs=score.inputs or {"empty": True})
        )

    index = compute.easing_pressure_index(
        {k: v.value for k, v in scores.items()},
        {k: float(v) for k, v in (weights.get("layers") or {}).items()},
        {"components": {k: v.value for k, v in scores.items()}, "asof": asof},
    )
    metrics.append(index)

    # 반대 논거 패널
    oas_pct = ((scores["credit"].inputs or {}).get("BAMLH0A0HYM2") or {}).get("percentile")
    conflicts = layers.conflicting_signals(
        T.yoy(T.to_map(pcepi), f"{month}-01"),
        T.yoy(T.to_map(core), f"{month}-01"),
        T.yoy(rsafs_map, rsafs_latest[0]) if rsafs_latest else None,
        oas_pct,
    )
    metrics.append(
        compute.Metric(
            "conflicting_signals",
            float(len(conflicts)),
            "count",
            inputs={"signals": conflicts},
            note="인하 논거가 강해도 이 값들이 높으면 상충 신호다",
        )
    )
    return metrics


def save_metrics(conn: sqlite3.Connection, asof: str, metrics: list[compute.Metric]) -> int:
    now = datetime.now().astimezone().isoformat(timespec="seconds")
    for metric in metrics:
        upsert_snapshot(conn, asof, metric.key, metric.value, metric.unit, metric.band, metric.inputs, now)
    return len(metrics)


# ── 내보내기 ────────────────────────────────────────────────────


def default_export_path() -> str:
    """⚠ 명세의 ``portal/``이 이 저장소에 없다. 사이트가 읽는 자리로 낸다(사용자 결정, 2026-09-05)."""
    here = os.path.dirname(os.path.abspath(__file__))
    root = os.path.dirname(os.path.dirname(here))
    return os.path.join(root, "web", "public", "data", "rates.json")


def build_payload(
    conn: sqlite3.Connection, asof: str, history_months: int = 120
) -> dict[str, Any]:
    """``rates.json``의 내용을 만든다.

    ⚠ 결측은 ``null``로 직렬화한다. 프런트는 그 구간에서 **선을 끊는다**(명세 §5).
    """
    cutoff = T.shift_months(f"{asof[:7]}-01", -history_months)
    catalog = {s.series_id: s for s in load_catalog()}
    snapshot = {row["metric_key"]: row for row in conn.execute(
        "SELECT * FROM rates_snapshot WHERE asof_date = ?", (asof,)
    )}

    metrics: dict[str, Any] = {}
    for key, row in snapshot.items():
        inputs = json.loads(row["inputs_json"])
        metrics[key] = {
            "value": row["value"],
            "unit": row["unit"],
            "band": row["band"],
            "inputs": inputs,
            "as_of": asof,
        }

    series_out: dict[str, Any] = {}
    missing: list[str] = []
    for row in list_series(conn):
        sid = row["series_id"]
        points = [(d, v) for d, v in load_observations(conn, sid) if d >= cutoff]
        if not any(v is not None for _, v in points):
            missing.append(sid)
        series_out[sid] = {
            "name_ko": row["name_ko"],
            "unit": row["unit"],
            "frequency": row["frequency"],
            "layer": row["layer"],
            "definition_ko": row["definition_ko"],
            "source_url": row["source_url"],
            "last_obs_date": row["last_obs_date"],
            "observations": [[d, v] for d, v in points],
        }

    headline_metric = metrics.get("easing_pressure_index") or {}
    conflicts = ((metrics.get("conflicting_signals") or {}).get("inputs") or {}).get("signals") or []

    return {
        "meta": {
            "asof": asof,
            "generated_at": datetime.now().astimezone().isoformat(timespec="seconds"),
            "schema_version": 1,
            "partial": bool(headline_metric.get("inputs", {}).get("missing_layers")),
            "missing_series": missing,
            "stale": False,
        },
        "headline": {
            "easing_pressure_index": {
                "value": headline_metric.get("value"),
                "band": headline_metric.get("band"),
                "components": (headline_metric.get("inputs") or {}).get("components", {}),
                "weights_used": (headline_metric.get("inputs") or {}).get("weights_used", {}),
                "missing_layers": (headline_metric.get("inputs") or {}).get("missing_layers", []),
            },
            "conflicting_signals": conflicts,
        },
        "metrics": metrics,
        "series": series_out,
        "releases": [
            {
                "date": row["release_date"],
                "indicator": row["indicator"],
                "period": row["period"],
                "actual": row["actual"],
                "prior": row["prior"],
                "revised_prior": row["revised_prior"],
                "note": row["note"],
            }
            for row in load_releases(conn, asof, T.shift_months(asof, 3))
        ],
    }


def write_payload(payload: dict[str, Any], path: str) -> int:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    with open(path, "w", encoding="utf-8") as fp:
        fp.write(text)
    return len(text.encode("utf-8"))

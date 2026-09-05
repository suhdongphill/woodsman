"""금리·거시 섹션 테스트 — 명세 §8.

## 골든 테스트가 하는 일
2026년 7월 기준 **실측값과 대조**한다. 화면을 만들기 전에 여기가 통과해야 한다(§10).
⚠ 틀린 계열 ID는 조용히 실패하지 않는다. 비슷한 이름의 **다른 계열**이 응답해 버리는 쪽이
   훨씬 위험하고, 그걸 잡는 것이 이 파일의 목적이다.

## ⚠ 명세의 기대값 둘을 실측으로 고쳤다 (2026-09-05)
- ``PAYEMS`` 전월차: 명세 −23,000 → **실측 +21,000**. 원인은 **개정**이다. FRED는 최신 빈티지만
  주고 §2가 vintage를 1차에서 다루지 않기로 했으므로, 원래 발표치를 기대값으로 박으면
  **영원히 실패**한다. 아래 테스트가 깨지면 코드가 아니라 **개정을 의심**하고, BLS 발표를
  확인한 뒤 이 숫자를 고친다.
- ``DRCCLACBS``: 명세 "약 7%" → **실측 2.85%**. 최근 6분기 3.05 → 2.85로 완만한 하락이다.
  ⚠ 7%로 박아 두면 실패했을 때 "계열을 바꿔라"는 **잘못된 신호**가 된다 — 이 테스트가
  막으려던 바로 그 실수다. 회귀 방지의 뜻은 살려서 **12%대가 나오면 잡히도록** 범위를 건다.
"""

from __future__ import annotations

import os
import sqlite3

import pytest

from pms.rates import compute, transforms as T
from pms.rates.catalog import load_catalog

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.environ.get("PMS_DB") or os.path.join(REPO_ROOT, "rates.db")

JULY = "2026-07"
JULY_DAY = "2026-07-01"


def _load(series_id: str) -> list[tuple[str, float | None]]:
    if not os.path.exists(DB_PATH):
        pytest.skip(f"{DB_PATH}가 없습니다 — `pms rates fetch`를 먼저 돌리세요")
    conn = sqlite3.connect(DB_PATH)
    try:
        rows = conn.execute(
            "SELECT obs_date, value FROM rates_observation WHERE series_id = ? ORDER BY obs_date",
            (series_id,),
        ).fetchall()
    finally:
        conn.close()
    if not rows:
        pytest.skip(f"{series_id} 관측치가 없습니다 — `pms rates fetch`를 먼저 돌리세요")
    return [(r[0], r[1]) for r in rows]


# ── 골든 테스트 ──────────────────────────────────────────────────


@pytest.mark.golden
def test_golden_payems_level_and_change():
    """⚠ 개정되는 계열이다. 실패하면 코드가 아니라 개정을 먼저 의심한다."""
    series = T.to_map(_load("PAYEMS"))
    assert series[JULY_DAY] == pytest.approx(158_913, abs=50)

    change = T.diff_months(series, JULY_DAY)
    assert change == pytest.approx(21, abs=5), (
        "PAYEMS 전월차가 기대와 다릅니다. 명세의 −23,000은 최초 발표치이고 FRED는 최신 "
        "빈티지를 줍니다 — BLS 개정 내역을 확인한 뒤 이 기대값을 고치세요."
    )


@pytest.mark.golden
def test_golden_unrate():
    assert T.to_map(_load("UNRATE"))[JULY_DAY] == pytest.approx(4.1, abs=0.05)


@pytest.mark.golden
def test_golden_civpart_and_gap_from_january():
    series = T.to_map(_load("CIVPART"))
    assert series[JULY_DAY] == pytest.approx(61.4, abs=0.05)
    assert series[JULY_DAY] - series["2026-01-01"] == pytest.approx(-0.7, abs=0.05)


@pytest.mark.golden
def test_golden_psavert():
    assert T.to_map(_load("PSAVERT"))[JULY_DAY] == pytest.approx(3.0, abs=0.05)


@pytest.mark.golden
def test_golden_pce_yoy():
    """⚠ 지수 계열이므로 전년동월비를 **계산해서** 쓴다."""
    assert T.yoy(T.to_map(_load("PCEPI")), JULY_DAY) == pytest.approx(3.7, abs=0.05)
    assert T.yoy(T.to_map(_load("PCEPILFE")), JULY_DAY) == pytest.approx(3.3, abs=0.06)


@pytest.mark.golden
def test_golden_trimmed_pce_is_already_percent():
    """⚠ 이미 % 단위다. 전년동월비를 다시 계산하면 비율의 비율이 된다."""
    assert T.to_map(_load("PCETRIM12M159SFRBDAL"))[JULY_DAY] == pytest.approx(2.3, abs=0.05)


@pytest.mark.golden
def test_golden_houst_yoy():
    assert T.yoy(T.to_map(_load("HOUST")), JULY_DAY) == pytest.approx(-13.5, abs=0.5)


@pytest.mark.golden
def test_golden_rsafs():
    series = T.to_map(_load("RSAFS"))
    assert T.mom(series, JULY_DAY) == pytest.approx(-0.6, abs=0.1)
    assert T.yoy(series, JULY_DAY) == pytest.approx(5.0, abs=0.2)


@pytest.mark.golden
def test_golden_credit_card_delinquency_is_balance_based():
    """⚠ **회귀 방지용.** 잔액 기준 연체율 자리에 연율화 전이율이 들어가는 실수를 잡는다.

    뉴욕 연준 HHDC의 연율화 전이율은 9~12%대로 나온다. 그 숫자가 여기 들어오면 실패한다.
    """
    latest = T.observed(_load("DRCCLACBS"))[-1]
    assert latest[1] == pytest.approx(2.85, abs=0.15), (
        f"DRCCLACBS 최신값이 {latest[1]}입니다. 9%를 넘으면 연율화 전이율이 섞여 든 것입니다 — "
        "계열을 바꾸기 전에 정의부터 확인하세요."
    )
    assert latest[1] < 9.0


@pytest.mark.golden
def test_catalog_ids_are_all_seeded():
    """카탈로그의 계열이 전부 DB에 있는가. ⚠ 하나가 빠지면 파생이 조용히 부분 산출된다."""
    if not os.path.exists(DB_PATH):
        pytest.skip("DB 없음")
    conn = sqlite3.connect(DB_PATH)
    try:
        seeded = {r[0] for r in conn.execute("SELECT series_id FROM rates_series")}
    finally:
        conn.close()
    missing = [s.series_id for s in load_catalog() if s.series_id not in seeded]
    assert not missing, f"심기지 않은 계열: {missing}"


# ── 단위 테스트 ──────────────────────────────────────────────────


def test_yoy_and_mom_use_dates_not_positions():
    """⚠ 중간에 결측 월이 있어도 **13개월 전과 비교하지 않는다.**"""
    series = {"2025-07-01": 100.0, "2026-06-01": 105.0, "2026-07-01": 110.0}
    assert T.yoy(series, "2026-07-01") == pytest.approx(10.0)
    assert T.mom(series, "2026-07-01") == pytest.approx(4.7619, abs=0.001)


def test_yoy_returns_none_when_pair_missing():
    """⚠ 짝이 없으면 보간하지 않고 None이다."""
    assert T.yoy({"2026-07-01": 110.0}, "2026-07-01") is None


def test_moving_average_refuses_holes():
    """⚠ 구간에 결측이 있으면 평균을 만들지 않는다 — 있는 값으로만 평균 내면 구멍이 사라진다."""
    points = [("2026-05-01", 1.0), ("2026-06-01", None), ("2026-07-01", 3.0)]
    assert T.moving_average(points, "2026-07-01", 3) is None


def test_as_of_reports_the_actual_observation_date():
    """일별 계열의 휴장일 건너뛰기는 보간이 아니다 — **관측일을 함께** 돌려준다."""
    points = [("2026-09-03", 4.33), ("2026-09-04", None)]
    assert T.as_of(points, "2026-09-05") == ("2026-09-03", 4.33)


def test_passive_tightening_identity():
    """``Δreal = Δnominal − Δinflation`` 항등식. 어긋나면 예외를 던진다."""
    dff = [(f"2026-{m:02d}-{d:02d}", 4.0 if m <= 1 else 3.5) for m in (1, 7) for d in (1, 15)]
    trimmed = [("2026-01-01", 3.0), ("2026-07-01", 2.3)]

    metrics = {m.key: m for m in compute.passive_tightening(dff, trimmed, "2026-07", 6)}
    d_real = metrics["delta_real_6m"].value
    d_nominal = metrics["delta_nominal_6m"].value
    passive = metrics["passive_tightening_6m"].value

    assert d_nominal == pytest.approx(-0.5)
    assert passive == pytest.approx(0.7)  # 인플레가 0.7%p 내려간 만큼 저절로 조여졌다
    assert d_real == pytest.approx(d_nominal + passive, abs=0.001)


def test_participation_gap_is_zero_when_base_is_current_month():
    """기준월 = 당월이면 조정 실업률과 공식 실업률의 격차가 0이어야 한다."""
    month = "2026-07"
    civpart = [(f"{month}-01", 61.4)]
    cnp = [(f"{month}-01", 275_000.0)]
    # 공식 실업률 4.1%가 되도록 취업자를 맞춘다.
    lf = 0.614 * 275_000.0
    ce = [(f"{month}-01", lf * (1 - 0.041))]
    unrate = [(f"{month}-01", 4.1)]

    metrics = {
        m.key: m
        for m in compute.participation_adjusted_unrate(civpart, cnp, ce, unrate, month, month)
    }
    assert metrics["participation_gap"].value == pytest.approx(0.0, abs=0.001)


def test_participation_records_the_base_month():
    """⚠ 어느 시점 참가율로 고정했는지가 inputs에 남아야 한다 — 기준을 숨기면 조작이 된다."""
    metrics = {
        m.key: m
        for m in compute.participation_adjusted_unrate(
            [("2026-01-01", 62.1)], [("2026-07-01", 275_000.0)],
            [("2026-07-01", 163_000.0)], [("2026-07-01", 4.1)], "2026-07", "2026-01",
        )
    }
    inputs = metrics["participation_adjusted_unrate"].inputs
    assert inputs["base_month"] == "2026-01"
    assert inputs["CIVPART"]["date"] == "2026-01-01"


def test_renormalize_when_a_layer_is_missing():
    """⚠ 빠진 레이어를 0점으로 치지 않는다. 나머지 가중치를 100으로 다시 맞춘다."""
    weights = {"inflation": 25, "labor": 25, "policy_stance": 20, "credit": 15, "external": 15}
    scores = {"inflation": 70.0, "labor": 60.0, "policy_stance": None, "credit": 50.0, "external": 40.0}

    live = compute.renormalize(weights, scores)
    assert "policy_stance" not in live
    assert sum(live.values()) == pytest.approx(100.0)
    assert live["inflation"] == pytest.approx(25 / 80 * 100)


def test_easing_index_marks_partial_and_never_scores_missing_as_zero():
    weights = {"inflation": 25, "labor": 25, "policy_stance": 20, "credit": 15, "external": 15}
    scores = {"inflation": 80.0, "labor": 80.0, "policy_stance": None, "credit": 80.0, "external": 80.0}

    metric = compute.easing_pressure_index(scores, weights, {"asof": "2026-09-05"})
    # 빠진 레이어를 0으로 쳤다면 64가 나온다. 재정규화했으므로 80이어야 한다.
    assert metric.value == pytest.approx(80.0)
    assert metric.note and "부분 산출" in metric.note
    assert metric.inputs["missing_layers"] == ["policy_stance"]


def test_percentile_rank_refuses_tiny_samples():
    """⚠ 다섯 점으로 만든 백분위는 숫자만 그럴듯하다."""
    assert T.percentile_rank([1, 2, 3, 4, 5], 3) is None
    assert T.percentile_rank(list(range(20)), 10) == pytest.approx(52.5, abs=0.1)


def test_catalog_definitions_are_present_and_units_declared():
    """⚠ 정의가 비면 화면에 「설명 없음」이 뜨고 그 상태가 오래 간다."""
    for series in load_catalog():
        assert series.definition_ko.strip(), f"{series.series_id}: 정의가 비었습니다"
        assert series.unit.strip(), f"{series.series_id}: 단위가 비었습니다"
        assert series.source_url.startswith("https://"), series.series_id


def test_trimmed_pce_is_declared_as_percent_not_index():
    """⚠ 정의가 다른 지표를 섞지 않는다 — 이 계열을 index로 적으면 YoY를 또 계산하게 된다."""
    catalog = {s.series_id: s for s in load_catalog()}
    assert catalog["PCETRIM12M159SFRBDAL"].unit == "percent"
    assert catalog["PCEPI"].unit == "index"
    assert catalog["PCEPILFE"].unit == "index"


def test_credit_card_series_definition_warns_about_the_other_definition():
    """⚠ 잔액 기준과 연율화 전이율은 다른 숫자다. 정의 문장이 그 사실을 말해야 한다."""
    catalog = {s.series_id: s for s in load_catalog()}
    definition = catalog["DRCCLACBS"].definition_ko
    assert "잔액" in definition
    assert "전이율" in definition

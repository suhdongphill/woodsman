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


# ── 내보내기 기간 ────────────────────────────────────────────────
#
# ⚠ 7년으로 좁힌 것은 파일 크기 때문이고(10년치는 977KB로 1MB 경계에 붙었다), 그래서
#   「짧아진 것」과 「자료가 없는 것」을 화면이 구분해 말할 수 있어야 한다. meta에 기간을
#   싣는 이유가 그것이다 — 이 둘이 무너지면 화면이 다시 사람을 엉뚱한 곳으로 보낸다.


def test_payload_records_the_history_window_it_wrote():
    from pms.rates.pipeline import build_payload

    if not os.path.exists(DB_PATH):
        pytest.skip(f"{DB_PATH}가 없습니다 — `pms rates fetch`를 먼저 돌리세요")
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        asof = conn.execute("SELECT MAX(asof_date) FROM rates_snapshot").fetchone()[0]
        if not asof:
            pytest.skip("스냅숏이 없습니다 — `pms rates compute`를 먼저 돌리세요")

        payload = build_payload(conn, asof, 84)
        assert payload["meta"]["history_months"] == 84

        cutoff = T.shift_months(f"{asof[:7]}-01", -84)
        for sid, item in payload["series"].items():
            for obs_date, _ in item["observations"]:
                assert obs_date >= cutoff, f"{sid}의 {obs_date}가 기간 밖이다"

        # 좁히면 실제로 점이 줄어든다 — 기간 인자가 먹지 않는 채로 통과하지 않게.
        narrow = build_payload(conn, asof, 12)
        assert narrow["meta"]["history_months"] == 12
        wide_points = sum(len(v["observations"]) for v in payload["series"].values())
        narrow_points = sum(len(v["observations"]) for v in narrow["series"].values())
        assert narrow_points < wide_points
    finally:
        conn.close()


def test_default_history_window_is_seven_years():
    from pms.rates.pipeline import DEFAULT_HISTORY_MONTHS

    assert DEFAULT_HISTORY_MONTHS == 84


# ── 커브 · 물가 격차 · 순유동성 (사용자 요청 2026-09-07) ────────
#
# ⚠ 이 셋의 공통점은 **수준이 아니라 관계를 본다**는 것이다. 관계를 만드는 계산은
#   조용히 틀리기 쉽다 — 부호가 뒤집히거나, 단위가 다른 계열을 그냥 빼거나.


def test_curve_change_uses_the_previous_observation_not_yesterday():
    """⚠ 「전일 대비」를 달력으로 재면 휴장일에 조용히 None이 된다."""
    from pms.rates.compute import curve_levels

    points = [("2026-09-01", 4.00), ("2026-09-02", None), ("2026-09-03", 4.10)]
    out = {m.key: m for m in curve_levels({"DGS2": points}, "2026-09-03")}
    two = out["ust_2y"]
    assert two.value == 4.10
    # 9/2가 비어 있어도 직전 관측(9/1)과 견준다 — 10bp.
    assert round(two.inputs["change_bp"], 1) == 10.0


def test_curve_change_is_none_with_a_single_observation():
    from pms.rates.compute import curve_levels

    out = {m.key: m for m in curve_levels({"DGS2": [("2026-09-03", 4.10)]}, "2026-09-03")}
    assert out["ust_2y"].inputs["change_bp"] is None


def test_headline_trimmed_gap_is_headline_minus_trimmed():
    """⚠ 부호가 뒤집히면 「공급 요인 우세」가 정반대로 읽힌다."""
    from pms.rates.compute import headline_trimmed_gap

    # 헤드라인 지수: 1년 새 +4%. 절사평균은 이미 % 값이다.
    pcepi = [("2025-07-01", 100.0), ("2026-07-01", 104.0)]
    trimmed = [("2026-07-01", 2.5)]
    core = [("2025-07-01", 100.0), ("2026-07-01", 103.0)]
    m = headline_trimmed_gap(pcepi, trimmed, core, "2026-07")
    assert round(m.inputs["headline_yoy"], 2) == 4.0
    assert round(m.value, 2) == 1.5  # 4.0 − 2.5


def test_net_liquidity_matches_units_before_subtracting():
    """⚠ WALCL·TGA는 백만 달러, RRP는 십억 달러다. 그냥 빼면 값이 무의미해진다."""
    from pms.rates.compute import net_liquidity

    walcl = [("2026-09-02", 6_740_000.0)]   # 6.74조
    tga = [("2026-09-02", 970_000.0)]       # 0.97조
    rrp = [("2026-09-02", 300.0)]           # 0.30조
    out = {m.key: m for m in net_liquidity(walcl, tga, rrp, "2026-09-02")}
    assert round(out["net_liquidity"].value, 2) == 5.47


def test_net_liquidity_direction_says_which_way():
    from pms.rates.compute import net_liquidity

    walcl = [("2026-08-05", 6_740_000.0), ("2026-09-02", 6_640_000.0)]
    tga = [("2026-08-05", 970_000.0), ("2026-09-02", 970_000.0)]
    rrp = [("2026-08-05", 300.0), ("2026-09-02", 300.0)]
    out = {m.key: m for m in net_liquidity(walcl, tga, rrp, "2026-09-02")}
    four = out["net_liquidity_change_4w"]
    assert four.value is not None and four.value < 0
    assert four.band == "falling"


def test_net_liquidity_refuses_to_guess_when_a_part_is_missing():
    """⚠ 구성 셋 중 하나가 없으면 0으로 채우지 않는다 — 빈 칸을 0으로 만들지 않는다."""
    from pms.rates.compute import net_liquidity

    out = {m.key: m for m in net_liquidity([("2026-09-02", 6_740_000.0)], [], [], "2026-09-02")}
    assert out["net_liquidity"].value is None

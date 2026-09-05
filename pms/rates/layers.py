"""인하 압력 지수의 다섯 레이어 점수 — 명세 §4-7.

## ⚠ 여기 있는 임계값은 **우리가 고른 값**이다
명세는 레이어 구성만 정하고 점수화 방법은 정하지 않았다. 그래서 각 성분을 0~100으로 옮기는
**기준점(anchor)을 이 파일에 적고**, 산출할 때 ``inputs``에 그대로 실어 보낸다. 화면 각주가
그 값을 보여줄 수 있어야 "이 지수가 왜 60인가"에 답할 수 있다.

## 규칙
- 점수는 **높을수록 인하 논거가 강한 쪽**이다(명세 §4-7).
- ⚠ 성분이 없으면 그 성분을 **빼고** 평균한다. 0점으로 치면 「안 본 것」이 「인하 논거가
  없는 것」이 된다.
- ⚠ 레이어 전체가 비면 ``None``을 돌려주고, 지수 쪽에서 가중치를 재정규화한다.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Sequence

from . import transforms as T

Point = tuple[str, float | None]


def ramp(value: float, low: float, high: float) -> float:
    """``low``에서 0점, ``high``에서 100점인 직선. 범위 밖은 끝값으로 자른다."""
    if high == low:
        return 50.0
    pct = (value - low) / (high - low) * 100.0
    return max(0.0, min(100.0, pct))


@dataclass
class LayerScore:
    value: float | None
    inputs: dict[str, Any]


def _average(parts: dict[str, float | None]) -> float | None:
    live = [v for v in parts.values() if v is not None]
    return sum(live) / len(live) if live else None


def inflation_layer(
    trimmed: Sequence[Point], core_pce: Sequence[Point], bei: Sequence[Point], day: str, target: float
) -> LayerScore:
    """물가가 목표에 가까울수록 인하 논거가 강하다.

    기준점: 절사평균이 **목표+2%p(=4%)면 0점, 목표(=2%)면 100점**.
    근원 PCE 3개월 연율도 같은 자로 재고, 기대인플레(BEI)는 2.6%에서 0점·2.0%에서 100점.
    """
    trim_pair = T.as_of(trimmed, day)
    core_map = T.to_map(core_pce)
    core_pair = T.as_of(core_pce, day)
    bei_pair = T.as_of(bei, day)

    # 근원 PCE 3개월 연율: (지수[t]/지수[t-3])^4 − 1
    core_3m = None
    if core_pair:
        prev = core_map.get(T.shift_months(core_pair[0], -3))
        if prev:
            core_3m = ((core_pair[1] / prev) ** 4 - 1) * 100.0

    parts = {
        "trimmed_vs_target": None if not trim_pair else ramp(trim_pair[1], target + 2.0, target),
        "core_pce_3m_annualized": None if core_3m is None else ramp(core_3m, target + 2.0, target),
        "bei_10y": None if not bei_pair else ramp(bei_pair[1], 2.6, 2.0),
    }
    return LayerScore(
        _average(parts),
        {
            "scores": parts,
            "anchors": {"trimmed": [target + 2.0, target], "bei": [2.6, 2.0]},
            "PCETRIM12M159SFRBDAL": None if not trim_pair else {"date": trim_pair[0], "value": trim_pair[1]},
            "PCEPILFE": None if not core_pair else {"date": core_pair[0], "annualized_3m": core_3m},
            "T10YIE": None if not bei_pair else {"date": bei_pair[0], "value": bei_pair[1]},
        },
    )


def labor_layer(
    cooling: float | None, participation_gap: float | None, payems_ma3: float | None
) -> LayerScore:
    """노동시장이 식을수록 인하 논거가 강하다.

    기준점: 참가율 조정 격차 **0%p에서 0점, 1.5%p에서 100점**(숨은 실업이 클수록 강함).
    고용 3개월 평균 증감은 **20만에서 0점, 0에서 100점**.
    """
    parts = {
        "labor_cooling": cooling,
        "participation_gap": None if participation_gap is None else ramp(participation_gap, 0.0, 1.5),
        "payems_ma3": None if payems_ma3 is None else ramp(payems_ma3, 200.0, 0.0),
    }
    return LayerScore(
        _average(parts),
        {"scores": parts, "anchors": {"participation_gap": [0.0, 1.5], "payems_ma3": [200.0, 0.0]}},
    )


def policy_stance_layer(
    real_policy: float | None, neutral_rate: float | None, dfii10: Sequence[Point], day: str
) -> LayerScore:
    """정책이 제약적일수록 인하 논거가 강하다.

    ⚠ **r*가 없으면 이 레이어는 산출하지 않는다**(명세 §4-7). 중립금리를 임의로 가정하면
       지수 전체가 그 가정 위에 서게 된다.
    """
    if neutral_rate is None:
        return LayerScore(None, {"reason": "r*(중립금리)가 설정에 없습니다 — config/rates_params.yaml"})

    dfii_pair = T.as_of(dfii10, day)
    parts = {
        # 실질금리가 r*보다 2%p 높으면 100점(강한 제약), 같으면 0점
        "restrictiveness": None if real_policy is None else ramp(real_policy - neutral_rate, 0.0, 2.0),
        "dfii10": None if not dfii_pair else ramp(dfii_pair[1], 1.0, 2.5),
    }
    return LayerScore(
        _average(parts),
        {
            "scores": parts,
            "neutral_rate": neutral_rate,
            "anchors": {"restrictiveness": [0.0, 2.0], "dfii10": [1.0, 2.5]},
            "DFII10": None if not dfii_pair else {"date": dfii_pair[0], "value": dfii_pair[1]},
        },
    )


def credit_layer(
    psavert: Sequence[Point],
    delinquency: Sequence[Point],
    hy_oas: Sequence[Point],
    rsafs_real_yoy: float | None,
    day: str,
    years: int = 10,
) -> LayerScore:
    """가계·신용이 조여질수록 인하 논거가 강하다.

    기준점: 저축률 **6%에서 0점, 2%에서 100점**. 연체율은 **2%에서 0점, 4%에서 100점**.
    하이일드 OAS는 과거 10년 백분위를 그대로 쓴다. 실질 소매판매는 **+4%에서 0점, −2%에서 100점**.
    """
    sav_pair = T.as_of(psavert, day)
    del_pair = T.as_of(delinquency, day)
    oas_pair = T.as_of(hy_oas, day)

    oas_pct = None
    if oas_pair:
        start = T.shift_months(oas_pair[0], -12 * years)
        window = [v for d, v in T.observed(hy_oas) if start <= d <= oas_pair[0]]
        oas_pct = T.percentile_rank(window, oas_pair[1])

    parts = {
        "savings_rate": None if not sav_pair else ramp(sav_pair[1], 6.0, 2.0),
        "card_delinquency": None if not del_pair else ramp(del_pair[1], 2.0, 4.0),
        "hy_oas_percentile": oas_pct,
        "retail_real_yoy": None if rsafs_real_yoy is None else ramp(rsafs_real_yoy, 4.0, -2.0),
    }
    return LayerScore(
        _average(parts),
        {
            "scores": parts,
            "anchors": {"savings_rate": [6.0, 2.0], "card_delinquency": [2.0, 4.0], "retail_real_yoy": [4.0, -2.0]},
            "PSAVERT": None if not sav_pair else {"date": sav_pair[0], "value": sav_pair[1]},
            "DRCCLACBS": None if not del_pair else {"date": del_pair[0], "value": del_pair[1]},
            "BAMLH0A0HYM2": None if not oas_pair else {"date": oas_pair[0], "value": oas_pair[1], "percentile": oas_pct},
        },
    )


def external_layer(policy_gap: float | None, fx: Sequence[Point], day: str) -> LayerScore:
    """한·미 금리차가 벌어지고 원화가 약할수록 (한국 관점에서) 인하 여력이 좁다.

    ⚠ 이 레이어는 **미국의 인하 논거**가 아니라 **한국이 따라갈 여력**을 본다. 그래서 금리차가
       클수록 점수가 **낮아진다**. 화면 문구가 이 방향을 분명히 적어야 한다.
    """
    fx_pair = T.as_of(fx, day)
    fx_map = T.to_map(fx)
    fx_3m = None
    if fx_pair:
        prev = T.as_of(fx, T.shift_months(fx_pair[0], -3))
        if prev and prev[1]:
            fx_3m = (fx_pair[1] / prev[1] - 1) * 100.0

    parts = {
        # 금리차 2.5%p면 0점(여력 없음), 0%p면 100점
        "kr_us_policy_gap": None if policy_gap is None else ramp(policy_gap, 2.5, 0.0),
        # 원화가 3개월간 5% 약세면 0점, 5% 강세면 100점
        "krw_3m_trend": None if fx_3m is None else ramp(fx_3m, 5.0, -5.0),
    }
    return LayerScore(
        _average(parts),
        {
            "scores": parts,
            "anchors": {"kr_us_policy_gap": [2.5, 0.0], "krw_3m_trend": [5.0, -5.0]},
            "DEXKOUS": None if not fx_pair else {"date": fx_pair[0], "value": fx_pair[1], "change_3m": fx_3m},
        },
    )


def conflicting_signals(
    pce_yoy: float | None, core_yoy: float | None, retail_yoy: float | None, oas_percentile: float | None
) -> list[dict[str, Any]]:
    """반대 논거 패널 — 인하 논거가 강해도 이 값들이 높으면 「상충 신호」다(명세 §4-7).

    ⚠ 지수 하나로 결론을 내지 않게 하는 장치다. 지수와 **함께** 화면에 띄운다.
    """
    out: list[dict[str, Any]] = []
    if pce_yoy is not None and pce_yoy >= 3.0:
        out.append({"key": "pce_yoy", "value": pce_yoy, "text": f"헤드라인 PCE가 {pce_yoy:.1f}%로 목표의 1.5배를 넘는다"})
    if core_yoy is not None and core_yoy >= 3.0:
        out.append({"key": "core_pce_yoy", "value": core_yoy, "text": f"근원 PCE가 {core_yoy:.1f}%로 여전히 3%대다"})
    if retail_yoy is not None and retail_yoy >= 4.0:
        out.append({"key": "retail_yoy", "value": retail_yoy, "text": f"소매판매가 전년비 {retail_yoy:.1f}%로 식지 않았다"})
    if oas_percentile is not None and oas_percentile <= 20:
        out.append({"key": "hy_oas", "value": oas_percentile, "text": f"하이일드 스프레드가 과거 10년 하위 {oas_percentile:.0f}% — 신용시장은 무풍이다"})
    return out

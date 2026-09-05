"""계열 변환 — **순수 함수**. 네트워크도 DB도 없다.

## ⚠ 이 파일이 지키는 것
- **지수 계열과 이미 % 인 계열을 구분한다.** ``PCEPI``는 지수라 전년동월비를 계산해야 하고,
  ``PCETRIM12M159SFRBDAL``은 이미 %라 다시 계산하면 **비율의 비율**이 된다(명세 §3-1).
- **보간하지 않는다.** 앞뒤 값으로 메우면 없는 관측이 생긴다. 짝이 되는 관측이 없으면
  ``None``을 돌려준다(명세 §0-1).
- **위치가 아니라 날짜로 짝을 찾는다.** ``shift(12)``는 중간에 결측 월이 있으면 조용히 13개월
  전과 비교한다. 여기서는 **같은 달의 1년 전 키**를 직접 찾는다.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Iterable, Mapping, Sequence

Point = tuple[str, float | None]
SeriesMap = Mapping[str, float | None]


def to_map(points: Iterable[Point]) -> dict[str, float | None]:
    """``[(날짜, 값)]`` → ``{날짜: 값}``. 결측도 키로 남긴다 — 구멍이 있었다는 사실이다."""
    return {d: v for d, v in points}


def observed(points: Iterable[Point]) -> list[tuple[str, float]]:
    """값이 있는 관측만, 날짜 오름차순."""
    return sorted(((d, v) for d, v in points if v is not None), key=lambda x: x[0])


def latest(points: Iterable[Point]) -> tuple[str, float] | None:
    rows = observed(points)
    return rows[-1] if rows else None


def value_at(series: SeriesMap, day: str) -> float | None:
    """그 날짜의 값. ⚠ 없으면 ``None``이다 — 가장 가까운 값을 대신 주지 않는다."""
    return series.get(day)


def as_of(points: Iterable[Point], day: str) -> tuple[str, float] | None:
    """``day`` 이하에서 값이 있는 **마지막** 관측.

    ⚠ 이건 보간이 아니다. 일별 계열에서 주말·휴장일을 건너뛰기 위한 것이고, 돌려줄 때
       **그 값의 실제 관측일을 함께** 준다 — 화면과 ``inputs_json``이 날짜를 속이지 않게.
    """
    rows = [(d, v) for d, v in observed(points) if d <= day]
    return rows[-1] if rows else None


def shift_months(day: str, months: int) -> str:
    """``2026-07-01``에서 ``-12`` → ``2025-07-01``. 월 단위 계열의 짝을 찾는 데 쓴다."""
    d = datetime.strptime(day, "%Y-%m-%d").date()
    total = (d.year * 12 + (d.month - 1)) + months
    year, month = divmod(total, 12)
    return date(year, month + 1, min(d.day, 28)).isoformat()


def yoy(series: SeriesMap, day: str) -> float | None:
    """전년동월비(%). ⚠ **지수 계열에만** 쓴다. 이미 %인 계열에 쓰면 비율의 비율이 된다."""
    now = series.get(day)
    then = series.get(shift_months(day, -12))
    if now is None or then is None or then == 0:
        return None
    return (now / then - 1.0) * 100.0


def mom(series: SeriesMap, day: str) -> float | None:
    """전월비(%)."""
    now = series.get(day)
    then = series.get(shift_months(day, -1))
    if now is None or then is None or then == 0:
        return None
    return (now / then - 1.0) * 100.0


def diff_months(series: SeriesMap, day: str, months: int = 1) -> float | None:
    """전월차(원단위). 고용처럼 "몇 명 늘었나"를 보는 계열에 쓴다."""
    now = series.get(day)
    then = series.get(shift_months(day, -months))
    if now is None or then is None:
        return None
    return now - then


def monthly_mean(points: Iterable[Point], month: str) -> float | None:
    """일별 계열의 월평균. ``month``는 ``YYYY-MM``.

    ⚠ 그 달에 관측이 하나도 없으면 ``None``이다. 이웃 달로 대신하지 않는다.
    """
    values = [v for d, v in observed(points) if d[:7] == month]
    return sum(values) / len(values) if values else None


def percentile_rank(values: Sequence[float], target: float) -> float | None:
    """``values`` 안에서 ``target``의 백분위(0~100).

    ⚠ 표본이 너무 적으면 ``None``이다. 다섯 점으로 만든 백분위는 숫자만 그럴듯하다.
    """
    clean = [v for v in values if v is not None]
    if len(clean) < 12:
        return None
    below = sum(1 for v in clean if v < target)
    equal = sum(1 for v in clean if v == target)
    return (below + 0.5 * equal) / len(clean) * 100.0


def moving_average(points: Iterable[Point], day: str, months: int) -> float | None:
    """관측일 기준 최근 ``months``개월 이동평균. ⚠ 구간에 결측이 있으면 ``None``."""
    keys = [shift_months(day, -i) for i in range(months)]
    series = to_map(points)
    values = [series.get(k) for k in keys]
    if any(v is None for v in values):
        return None
    return sum(v for v in values if v is not None) / len(values)  # type: ignore[misc]

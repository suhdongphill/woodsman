"""계열 ID 유효성 확인 — **화면을 만들기 전에 여기가 먼저 통과해야 한다**(명세 §10).

## 무엇을 보나
1. 카탈로그의 모든 ID가 **실제로 응답하는가**
2. **최신 관측일**이 발표 주기 + 유예기간을 넘지 않았는가 (월간 45일 · 분기 100일)
3. FRED 키가 있으면 **단위·계절조정**이 카탈로그와 같은가
4. ECOS **항목코드 캐시**가 지금 API 응답과 일치하는가

## ⚠ 왜 이걸 먼저 하나
계열 ID가 틀린 채로 화면부터 만들면 **잘못된 숫자에 맞춰 디자인이 굳는다.** 그리고 틀린
ID는 조용히 실패하지 않는다 — 비슷한 이름의 **다른 계열**이 응답해 버리는 쪽이 훨씬 위험하다
(잔액 기준 연체율 자리에 연율화 전이율이 들어가는 것처럼).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta

from .catalog import SeriesDef
from . import sources

# 발표 주기별 유예기간(일) — 명세 §8의 "월간 45일 · 분기 100일"이 이 값이다.
#
# ⚠ **관측일로부터가 아니라 「다음 관측이 나올 때가 지났는가」로 잰다.**
#    월간 계열의 관측일은 그 달 1일인데 발표는 4~6주 뒤다. 관측일 기준으로 45일을 재면
#    7월치가 9월 초에 66일로 찍혀 **정상인 계열이 매번 경고**를 낸다(2026-09-05 실측).
#    상시 켜진 경고는 경고가 아니므로, 주기 길이를 더한 값과 비교한다.
GRACE_DAYS = {"D": 10, "W": 21, "M": 45, "Q": 100}
PERIOD_DAYS = {"D": 3, "W": 7, "M": 31, "Q": 92}


@dataclass
class VerifyRow:
    series_id: str
    ok: bool
    latest: str | None = None
    value: float | None = None
    stale_days: int | None = None
    warnings: list[str] | None = None
    error: str | None = None

    @property
    def notes(self) -> list[str]:
        return self.warnings or []


def _age_days(latest: str, today: date) -> int:
    return (today - datetime.strptime(latest, "%Y-%m-%d").date()).days


def verify_series(
    definition: SeriesDef,
    today: date | None = None,
    fred_api_key: str | None = None,
    ecos_api_key: str | None = None,
) -> VerifyRow:
    """계열 하나를 실제로 두드려 본다."""
    today = today or date.today()
    warnings: list[str] = []

    try:
        if definition.source == "FRED":
            since = (today - timedelta(days=800)).isoformat()
            points = sources.fred_observations(definition.series_id, since=since)
        else:
            if not ecos_api_key:
                return VerifyRow(
                    definition.series_id,
                    ok=False,
                    error="ECOS_API_KEY가 없어 확인하지 못했습니다",
                )
            since = (today - timedelta(days=800)).isoformat()
            points = sources.ecos_observations(
                definition.table or "",
                definition.item or "",
                definition.cycle or definition.frequency,
                ecos_api_key,
                since,
                today.isoformat(),
                rows=1000,
            )
    except sources.SourceError as exc:
        return VerifyRow(definition.series_id, ok=False, error=str(exc))

    observed = [(d, v) for d, v in points if v is not None]
    if not observed:
        return VerifyRow(definition.series_id, ok=False, error="값이 있는 관측이 없습니다")

    latest, value = observed[-1]
    age = _age_days(latest, today)
    grace = PERIOD_DAYS.get(definition.frequency, 31) + GRACE_DAYS.get(definition.frequency, 45)
    if age > grace:
        # ⚠ 경고이지 실패가 아니다. 계열이 폐기됐을 수도, 발표가 늦은 것일 수도 있다.
        warnings.append(f"최신 관측일이 {age}일 전입니다(유예 {grace}일)")

    # FRED 메타데이터는 키가 있을 때만 본다.
    if definition.source == "FRED" and fred_api_key:
        try:
            meta = sources.fred_metadata(definition.series_id, fred_api_key)
        except sources.SourceError as exc:
            warnings.append(f"메타데이터를 읽지 못했습니다: {exc}")
        else:
            freq_code = (meta.get("frequency_short") or "").upper()
            if freq_code and freq_code[0] != definition.frequency:
                warnings.append(
                    f"주기 불일치 — 카탈로그 {definition.frequency}, FRED {freq_code}"
                )
            sa = (meta.get("seasonal_adjustment_short") or "").upper()
            if definition.seasonal_adj and sa and sa != definition.seasonal_adj:
                warnings.append(
                    f"계절조정 불일치 — 카탈로그 {definition.seasonal_adj}, FRED {sa}"
                )
            units = meta.get("units_short") or meta.get("units")
            if units:
                warnings.append(f"FRED 단위: {units}")
    elif definition.source == "FRED":
        warnings.append("단위 미확인 — FRED_API_KEY를 넣으면 메타데이터로 대조합니다")

    return VerifyRow(
        definition.series_id,
        ok=True,
        latest=latest,
        value=value,
        stale_days=age,
        warnings=warnings,
    )


def verify_ecos_items(
    definitions: list[SeriesDef], ecos_api_key: str
) -> list[tuple[str, bool, str]]:
    """캐싱한 ECOS 항목코드가 지금 응답과 같은지 대조한다.

    ⚠ 통계표는 항목을 바꾸거나 폐기한다. 캐시를 믿고 계속 부르면, 어느 날부터 **다른 항목**이
       같은 코드로 응답하는 사고가 난다. 이름까지 함께 본다.
    """
    out: list[tuple[str, bool, str]] = []
    tables = sorted({d.table for d in definitions if d.source == "ECOS" and d.table})

    for table in tables:
        try:
            rows = sources.ecos_items(table, ecos_api_key)
        except sources.SourceError as exc:
            for d in definitions:
                if d.table == table:
                    out.append((d.series_id, False, f"항목 목록을 못 읽었습니다: {exc}"))
            continue

        by_code: dict[str, set[str]] = {}
        for row in rows:
            by_code.setdefault(str(row.get("ITEM_CODE")), set()).add(str(row.get("ITEM_NAME")))

        for d in definitions:
            if d.table != table:
                continue
            names = by_code.get(str(d.item))
            if not names:
                out.append((d.series_id, False, f"항목코드 {d.item}이 목록에 없습니다"))
            elif d.name_ko not in names:
                out.append(
                    (d.series_id, True, f"이름이 다릅니다 — 카탈로그 「{d.name_ko}」, ECOS 「{'·'.join(sorted(names))}」")
                )
            else:
                out.append((d.series_id, True, "이름 일치"))
    return out

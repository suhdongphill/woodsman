"""계열 카탈로그 — ``config/rates_series.yaml``을 읽어 검증하고 DB에 심는다.

## ⚠ 왜 YAML이 원본인가
계열 ID를 코드 곳곳에 흩어 두면, 하나가 폐기됐을 때 어디를 고쳐야 하는지 알 수 없다.
그래서 **파일 하나가 유일한 목록**이고 코드는 그것을 읽기만 한다(명세 §0-4).
DB의 ``rates_series``는 그 사본이며, 원본은 언제나 YAML이다.

## ⚠ 정의 문장은 세 곳에서 갈라지면 안 된다
``definition_ko``는 ``docs/금리섹션_지표해설.md``와 같은 문장을 쓰고, 화면 툴팁도 이 값을
그대로 받는다(명세 §9). 그래서 여기서 **비어 있으면 실패**시킨다 — 빈 정의로 심어 두면
화면에 "설명 없음"이 뜨고, 그 상태가 오래 간다.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any, Iterator

import yaml

VALID_FREQ = {"D", "W", "M", "Q"}
VALID_SOURCE = {"FRED", "ECOS"}

FRED_URL = "https://fred.stlouisfed.org/series/{id}"
ECOS_URL = "https://ecos.bok.or.kr/#/Short/{table}"


def default_config_path() -> str:
    """저장소 루트의 ``config/rates_series.yaml``. ⚠ 경로를 흩뿌리지 않는다."""
    env = os.environ.get("PMS_RATES_CONFIG")
    if env:
        return env
    here = os.path.dirname(os.path.abspath(__file__))
    root = os.path.dirname(os.path.dirname(here))  # pms/rates → pms → repo root
    return os.path.join(root, "config", "rates_series.yaml")


@dataclass(frozen=True)
class SeriesDef:
    """한 계열의 정의. DB 행과 1:1로 대응한다."""

    series_id: str
    source: str
    name_ko: str
    name_en: str | None
    unit: str
    frequency: str
    seasonal_adj: str | None
    definition_ko: str
    source_url: str
    layer: str | None
    # ECOS 전용 — 통계표·항목·주기 코드
    table: str | None = None
    item: str | None = None
    cycle: str | None = None

    def as_row(self) -> dict[str, Any]:
        return {
            "series_id": self.series_id,
            "source": self.source,
            "name_ko": self.name_ko,
            "name_en": self.name_en,
            "unit": self.unit,
            "frequency": self.frequency,
            "seasonal_adj": self.seasonal_adj,
            "definition_ko": self.definition_ko,
            "source_url": self.source_url,
            "layer": self.layer,
        }


def ecos_series_id(table: str, item: str) -> str:
    """ECOS 계열의 ID 규약. ⚠ 이 형식을 바꾸면 쌓인 관측치가 통째로 끊긴다."""
    return f"ECOS:{table}:{item}"


def _require(entry: dict[str, Any], field: str, where: str) -> Any:
    value = entry.get(field)
    if value is None or (isinstance(value, str) and not value.strip()):
        raise ValueError(f"{where}: '{field}'가 비어 있습니다")
    return value


def load_catalog(path: str | None = None) -> list[SeriesDef]:
    """YAML을 읽어 계열 정의 목록으로. ⚠ 하나라도 규격을 어기면 **전부 실패**시킨다.

    일부만 심고 넘어가면 "왜 이 지표만 없지"를 나중에 추적하게 된다.
    """
    path = path or default_config_path()
    with open(path, "r", encoding="utf-8") as fp:
        raw = yaml.safe_load(fp) or {}

    out: list[SeriesDef] = []

    for entry in raw.get("fred") or []:
        sid = _require(entry, "id", "fred")
        freq = _require(entry, "frequency", f"fred:{sid}")
        if freq not in VALID_FREQ:
            raise ValueError(f"fred:{sid}: frequency '{freq}'는 D/W/M/Q 중 하나여야 합니다")
        out.append(
            SeriesDef(
                series_id=sid,
                source="FRED",
                name_ko=_require(entry, "name_ko", f"fred:{sid}"),
                name_en=entry.get("name_en"),
                unit=_require(entry, "unit", f"fred:{sid}"),
                frequency=freq,
                seasonal_adj=entry.get("seasonal_adj"),
                definition_ko=_require(entry, "definition_ko", f"fred:{sid}"),
                source_url=FRED_URL.format(id=sid),
                layer=entry.get("layer"),
            )
        )

    for entry in raw.get("ecos") or []:
        table = str(_require(entry, "table", "ecos"))
        item = str(_require(entry, "item", f"ecos:{table}"))
        sid = ecos_series_id(table, item)
        freq = _require(entry, "frequency", f"ecos:{sid}")
        if freq not in VALID_FREQ:
            raise ValueError(f"ecos:{sid}: frequency '{freq}'는 D/W/M/Q 중 하나여야 합니다")
        out.append(
            SeriesDef(
                series_id=sid,
                source="ECOS",
                name_ko=_require(entry, "name_ko", f"ecos:{sid}"),
                name_en=entry.get("name_en"),
                unit=_require(entry, "unit", f"ecos:{sid}"),
                frequency=freq,
                seasonal_adj=entry.get("seasonal_adj"),
                definition_ko=_require(entry, "definition_ko", f"ecos:{sid}"),
                source_url=ECOS_URL.format(table=table),
                layer=entry.get("layer"),
                table=table,
                item=item,
                cycle=entry.get("cycle") or freq,
            )
        )

    ids = [s.series_id for s in out]
    dupes = {i for i in ids if ids.count(i) > 1}
    if dupes:
        raise ValueError(f"계열 ID가 중복입니다: {sorted(dupes)}")

    return out


def pending_series(path: str | None = None) -> list[dict[str, Any]]:
    """아직 **사람이 고르지 않은** 후보들.

    ⚠ 설비투자처럼 "ID를 추정하지 말고 사람이 고른다"고 정한 자리다(명세 §3-1).
    `chosen: true`가 되기 전에는 수집·계산에 넣지 않는다.
    """
    path = path or default_config_path()
    with open(path, "r", encoding="utf-8") as fp:
        raw = yaml.safe_load(fp) or {}
    return [e for e in (raw.get("fred_pending") or []) if not e.get("chosen")]


def by_id(catalog: list[SeriesDef]) -> dict[str, SeriesDef]:
    return {s.series_id: s for s in catalog}


def iter_source(catalog: list[SeriesDef], source: str) -> Iterator[SeriesDef]:
    for s in catalog:
        if s.source == source:
            yield s

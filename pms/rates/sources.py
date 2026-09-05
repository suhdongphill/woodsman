"""FRED·ECOS에서 관측치를 받아 온다.

## ⚠ 이 파일이 지키는 것
- **받은 것만 돌려준다.** 결측(FRED의 ``.``, ECOS의 빈 문자열)은 ``None``으로 넘기고
  0으로 바꾸지 않는다(명세 §0-1). 보간·외삽은 이 파일에 없다.
- **실패를 삼키지 않는다.** 429/5xx는 지수 백오프로 세 번 다시 시도하고, 그래도 안 되면
  예외를 올린다. 호출부가 그 계열을 건너뛰되 **목록으로 남긴다**(명세 §1).
- **키는 환경변수로만 읽는다.** 코드·설정 파일에 값을 적지 않는다.

## FRED에 키가 없어도 되는 이유
관측치는 ``fredgraph.csv``로 키 없이 받을 수 있다. 다만 **단위·계절조정 같은 메타데이터**는
``/fred/series`` API에만 있고 그건 키가 필요하다 — ``verify``가 그 차이를 화면에 밝힌다.
"""

from __future__ import annotations

import csv
import io
import json
import os
import time
import urllib.parse
import urllib.request
from typing import Any

USER_AGENT = "Mozilla/5.0 (compatible; WoodsmanRatesBot/1.0)"
TIMEOUT_SEC = 30
MAX_ATTEMPTS = 3

FRED_CSV = "https://fred.stlouisfed.org/graph/fredgraph.csv"
FRED_API = "https://api.stlouisfed.org/fred"
ECOS_API = "https://ecos.bok.or.kr/api"


class SourceError(RuntimeError):
    """이 계열은 못 받았다. ⚠ 삼키지 말고 호출부가 목록으로 남긴다."""


def _get(url: str) -> bytes:
    """지수 백오프 3회. ⚠ 429/5xx만 다시 시도한다 — 400/404를 반복해 두드리지 않는다."""
    last: Exception | None = None
    for attempt in range(MAX_ATTEMPTS):
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT_SEC) as res:
                return res.read()
        except urllib.error.HTTPError as exc:  # type: ignore[attr-defined]
            last = exc
            if exc.code not in (429, 500, 502, 503, 504):
                raise SourceError(f"HTTP {exc.code}") from exc
        except Exception as exc:  # noqa: BLE001 — 네트워크 예외는 종류가 많다
            last = exc
        time.sleep(2 ** attempt)
    raise SourceError(f"세 번 시도했으나 실패: {last}")


# ── FRED ────────────────────────────────────────────────────────


def fred_observations(series_id: str, since: str | None = None) -> list[tuple[str, float | None]]:
    """관측치를 ``[(YYYY-MM-DD, 값 또는 None)]``으로.

    ⚠ FRED는 결측을 ``.``으로 준다. 그대로 ``None``으로 옮긴다 — 0으로 채우면 휴장일이
      폭락으로 보이고, 지워 버리면 구멍이 있었다는 사실이 사라진다.
    """
    params = {"id": series_id}
    if since:
        params["cosd"] = since
    raw = _get(f"{FRED_CSV}?{urllib.parse.urlencode(params)}")

    text = raw.decode("utf-8", errors="replace")
    if text.lstrip()[:1] == "<":
        # 봇 차단 페이지가 200으로 오는 경우가 있다. 조용히 "값 없음"으로 넘기지 않는다.
        raise SourceError("CSV가 아닌 응답(차단 페이지로 보임)")

    out: list[tuple[str, float | None]] = []
    for row in csv.reader(io.StringIO(text)):
        if len(row) < 2 or not row[0] or row[0].lower().startswith("observation"):
            continue
        date, raw_value = row[0].strip(), row[1].strip()
        if len(date) != 10 or date[4] != "-":
            continue
        if raw_value in (".", ""):
            out.append((date, None))
            continue
        try:
            out.append((date, float(raw_value)))
        except ValueError:
            out.append((date, None))
    if not out:
        raise SourceError("응답에 행이 없습니다")
    return out


def fred_metadata(series_id: str, api_key: str) -> dict[str, Any]:
    """단위·계절조정·최신 관측일. ⚠ 키가 있을 때만 부를 수 있다."""
    params = {"series_id": series_id, "api_key": api_key, "file_type": "json"}
    raw = _get(f"{FRED_API}/series?{urllib.parse.urlencode(params)}")
    data = json.loads(raw.decode("utf-8"))
    items = data.get("seriess") or []
    if not items:
        raise SourceError("메타데이터에 계열이 없습니다")
    return items[0]


def fred_search(text: str, api_key: str, limit: int = 10) -> list[dict[str, Any]]:
    """계열 후보 검색. ⚠ 결과를 코드가 고르지 않는다 — 사람이 고른다(명세 §3-1)."""
    params = {
        "search_text": text,
        "api_key": api_key,
        "file_type": "json",
        "limit": limit,
        "order_by": "popularity",
        "sort_order": "desc",
    }
    raw = _get(f"{FRED_API}/series/search?{urllib.parse.urlencode(params)}")
    return (json.loads(raw.decode("utf-8")).get("seriess") or [])[:limit]


# ── ECOS ────────────────────────────────────────────────────────


def _ecos_period(day: str, cycle: str) -> str:
    """주기별 기간 표기. ``D``면 ``20260905``, ``M``이면 ``202609``."""
    digits = day.replace("-", "")
    if cycle == "D":
        return digits
    if cycle in ("M", "Q", "S"):
        return digits[:6]
    return digits[:4]


def _ecos_date(time_code: str) -> str | None:
    """``202609``·``20260905``·``2026`` → ``YYYY-MM-DD``. 낯선 형식이면 버린다."""
    if len(time_code) == 4 and time_code.isdigit():
        return f"{time_code}-01-01"
    if len(time_code) == 6 and time_code.isdigit():
        return f"{time_code[:4]}-{time_code[4:6]}-01"
    if len(time_code) == 8 and time_code.isdigit():
        return f"{time_code[:4]}-{time_code[4:6]}-{time_code[6:8]}"
    return None


def ecos_observations(
    table: str, item: str, cycle: str, api_key: str, since: str, until: str, rows: int = 10000
) -> list[tuple[str, float | None]]:
    """ECOS 관측치.

    ⚠ **오류도 HTTP 200으로 온다.** 인증키가 틀려도 ``{"RESULT": {...}}``가 200으로 돌아온다.
      빈 목록으로 넘기면 "받을 값이 없었다"와 구분이 사라지므로 **예외로 올린다.**
    """
    url = (
        f"{ECOS_API}/StatisticSearch/{urllib.parse.quote(api_key)}/json/kr/1/{rows}/"
        f"{table}/{cycle}/{_ecos_period(since, cycle)}/{_ecos_period(until, cycle)}/{item}"
    )
    data = json.loads(_get(url).decode("utf-8"))

    result = data.get("RESULT")
    if result:
        raise SourceError(f"ECOS {result.get('CODE', '')} {result.get('MESSAGE', '')}".strip())

    out: list[tuple[str, float | None]] = []
    for row in (data.get("StatisticSearch") or {}).get("row") or []:
        date = _ecos_date(str(row.get("TIME") or ""))
        if not date:
            continue
        raw_value = row.get("DATA_VALUE")
        if raw_value in (None, ""):
            out.append((date, None))
            continue
        try:
            out.append((date, float(raw_value)))
        except (TypeError, ValueError):
            out.append((date, None))
    if not out:
        raise SourceError("응답에 행이 없습니다")
    return out


def ecos_items(table: str, api_key: str, rows: int = 200) -> list[dict[str, Any]]:
    """통계표의 항목 목록. ``verify``가 캐싱된 항목코드를 이것과 대조한다."""
    url = f"{ECOS_API}/StatisticItemList/{urllib.parse.quote(api_key)}/json/kr/1/{rows}/{table}"
    data = json.loads(_get(url).decode("utf-8"))
    result = data.get("RESULT")
    if result:
        raise SourceError(f"ECOS {result.get('CODE', '')} {result.get('MESSAGE', '')}".strip())
    return (data.get("StatisticItemList") or {}).get("row") or []


# ── 키 ──────────────────────────────────────────────────────────


def fred_key() -> str | None:
    """⚠ 없어도 관측치는 받는다. 메타데이터 확인만 못 한다."""
    value = (os.environ.get("FRED_API_KEY") or "").strip()
    return value or None


def ecos_key() -> str | None:
    value = (os.environ.get("ECOS_API_KEY") or "").strip()
    return value or None

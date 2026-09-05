"""금리·거시(rates) 섹션의 SQLite 스키마와 접근 헬퍼.

기존 ``pms`` DB(``pms.db``)에 테이블 넷을 더한다. 가격·매매 테이블과 같은 파일을 쓰되
이름 앞에 ``rates_``를 붙여 섞이지 않게 한다.

## ⚠ 이 파일이 지키는 것
- **관측치와 추정치를 섞지 않는다.** 미발표·결측은 ``NULL``이다. 0으로 채우거나 보간하지
  않는다(명세 §0-1). 그래서 ``value``에 ``NOT NULL``을 걸지 않았다.
- **파생 지표는 입력을 되짚을 수 있어야 한다.** ``rates_snapshot.inputs_json``에 어떤 계열의
  어느 관측일·어떤 값을 썼는지 남긴다(명세 §0-2). 이 칸이 비면 그 숫자는 근거가 없는 숫자다.
- **정의가 다른 지표를 한 칸에 담지 않는다.** 계열마다 ``unit``·``definition_ko``를 붙여 두고,
  화면 툴팁과 문서가 같은 문장을 쓰게 한다(명세 §0-3).
"""

from __future__ import annotations

import json
import sqlite3
from typing import Any, Iterable, Mapping, Sequence

RATES_SCHEMA = """
CREATE TABLE IF NOT EXISTS rates_series (
    series_id     TEXT PRIMARY KEY,       -- 'DFF', 'ECOS:722Y001:0101000'
    source        TEXT NOT NULL,          -- 'FRED' | 'ECOS'
    name_ko       TEXT NOT NULL,
    name_en       TEXT,
    unit          TEXT NOT NULL,
    frequency     TEXT NOT NULL,          -- 'D' | 'W' | 'M' | 'Q'
    seasonal_adj  TEXT,                   -- 'SA' | 'NSA'
    definition_ko TEXT NOT NULL,
    source_url    TEXT NOT NULL,
    layer         TEXT,                   -- policy | inflation | labor | credit | two_speed | liquidity | krus
    last_obs_date TEXT,
    retrieved_at  TEXT
);

CREATE TABLE IF NOT EXISTS rates_observation (
    series_id    TEXT NOT NULL,
    obs_date     TEXT NOT NULL,
    value        REAL,                    -- ⚠ 결측은 NULL. 0으로 채우지 않는다
    retrieved_at TEXT NOT NULL,
    PRIMARY KEY (series_id, obs_date),
    FOREIGN KEY (series_id) REFERENCES rates_series(series_id)
);

CREATE INDEX IF NOT EXISTS idx_rates_obs_series_date
    ON rates_observation (series_id, obs_date);

CREATE TABLE IF NOT EXISTS rates_snapshot (
    asof_date   TEXT NOT NULL,
    metric_key  TEXT NOT NULL,
    value       REAL,
    unit        TEXT NOT NULL,
    band        TEXT,
    inputs_json TEXT NOT NULL,            -- ⚠ 비어 있으면 근거 없는 숫자다
    computed_at TEXT NOT NULL,
    PRIMARY KEY (asof_date, metric_key)
);

CREATE TABLE IF NOT EXISTS rates_release (
    release_date  TEXT NOT NULL,
    indicator     TEXT NOT NULL,
    period        TEXT NOT NULL,
    actual        REAL,
    prior         REAL,
    revised_prior REAL,
    note          TEXT,
    PRIMARY KEY (release_date, indicator, period)
);
"""


def init_rates(conn: sqlite3.Connection) -> None:
    """rates 테이블을 만든다. 이미 있으면 아무 일도 하지 않는다."""
    conn.executescript(RATES_SCHEMA)
    conn.commit()


# ── 계열 정의 ────────────────────────────────────────────────────


def upsert_series(conn: sqlite3.Connection, rows: Iterable[Mapping[str, Any]]) -> int:
    """계열 정의를 넣거나 갱신한다.

    ⚠ ``last_obs_date``·``retrieved_at``은 여기서 건드리지 않는다. 그건 수집이 쓰는 칸이고,
       정의를 다시 심었다고 "방금 받아 온 것"처럼 보이면 안 된다.
    """
    sql = """
    INSERT INTO rates_series
        (series_id, source, name_ko, name_en, unit, frequency, seasonal_adj,
         definition_ko, source_url, layer)
    VALUES (:series_id, :source, :name_ko, :name_en, :unit, :frequency, :seasonal_adj,
            :definition_ko, :source_url, :layer)
    ON CONFLICT(series_id) DO UPDATE SET
        source        = excluded.source,
        name_ko       = excluded.name_ko,
        name_en       = excluded.name_en,
        unit          = excluded.unit,
        frequency     = excluded.frequency,
        seasonal_adj  = excluded.seasonal_adj,
        definition_ko = excluded.definition_ko,
        source_url    = excluded.source_url,
        layer         = excluded.layer
    """
    count = 0
    for row in rows:
        conn.execute(sql, dict(row))
        count += 1
    conn.commit()
    return count


def list_series(conn: sqlite3.Connection, source: str | None = None) -> list[sqlite3.Row]:
    if source:
        return list(
            conn.execute(
                "SELECT * FROM rates_series WHERE source = ? ORDER BY series_id", (source,)
            )
        )
    return list(conn.execute("SELECT * FROM rates_series ORDER BY series_id"))


def get_series(conn: sqlite3.Connection, series_id: str) -> sqlite3.Row | None:
    cur = conn.execute("SELECT * FROM rates_series WHERE series_id = ?", (series_id,))
    return cur.fetchone()


# ── 관측치 ──────────────────────────────────────────────────────


def last_obs_date(conn: sqlite3.Connection, series_id: str) -> str | None:
    """이 계열에서 **값이 있는** 마지막 관측일. 증분 수집의 출발점이다.

    ⚠ ``value IS NOT NULL``을 건다. 결측만 잔뜩 들어온 뒤로는 다시 받지 않는 사고를 막는다.
    """
    cur = conn.execute(
        "SELECT MAX(obs_date) FROM rates_observation WHERE series_id = ? AND value IS NOT NULL",
        (series_id,),
    )
    row = cur.fetchone()
    return row[0] if row and row[0] else None


def upsert_observations(
    conn: sqlite3.Connection,
    series_id: str,
    points: Sequence[tuple[str, float | None]],
    retrieved_at: str,
) -> int:
    """관측치를 넣거나 덮어쓴다.

    ⚠ **같은 날짜를 다시 받으면 덮어쓴다.** 통계는 사후에 개정된다(고용·GDP는 두 번 고쳐진다).
       처음 받은 값을 고집하면 틀린 숫자가 영원히 남는다.
    """
    if not points:
        return 0

    conn.executemany(
        """
        INSERT INTO rates_observation (series_id, obs_date, value, retrieved_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(series_id, obs_date) DO UPDATE SET
            value = excluded.value,
            retrieved_at = excluded.retrieved_at
        """,
        [(series_id, date, value, retrieved_at) for date, value in points],
    )

    latest = max((d for d, v in points if v is not None), default=None)
    if latest:
        conn.execute(
            "UPDATE rates_series SET last_obs_date = ?, retrieved_at = ? WHERE series_id = ?",
            (latest, retrieved_at, series_id),
        )
    conn.commit()
    return len(points)


def load_observations(
    conn: sqlite3.Connection, series_id: str, since: str | None = None
) -> list[tuple[str, float | None]]:
    """관측치를 날짜 오름차순으로. ⚠ 결측(NULL)도 그대로 돌려준다 — 지우면 구멍이 사라진다."""
    if since:
        cur = conn.execute(
            "SELECT obs_date, value FROM rates_observation "
            "WHERE series_id = ? AND obs_date >= ? ORDER BY obs_date",
            (series_id, since),
        )
    else:
        cur = conn.execute(
            "SELECT obs_date, value FROM rates_observation WHERE series_id = ? ORDER BY obs_date",
            (series_id,),
        )
    return [(r[0], r[1]) for r in cur]


# ── 파생 지표 스냅숏 ─────────────────────────────────────────────


def upsert_snapshot(
    conn: sqlite3.Connection,
    asof_date: str,
    metric_key: str,
    value: float | None,
    unit: str,
    band: str | None,
    inputs: Mapping[str, Any],
    computed_at: str,
) -> None:
    """파생 지표 한 줄. ⚠ ``inputs``가 비면 저장을 거부한다 — 근거 없는 숫자를 남기지 않는다."""
    if not inputs:
        raise ValueError(f"{metric_key}: inputs가 비어 있습니다 — 입력 계열을 남겨야 합니다")

    conn.execute(
        """
        INSERT INTO rates_snapshot
            (asof_date, metric_key, value, unit, band, inputs_json, computed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(asof_date, metric_key) DO UPDATE SET
            value = excluded.value,
            unit = excluded.unit,
            band = excluded.band,
            inputs_json = excluded.inputs_json,
            computed_at = excluded.computed_at
        """,
        (
            asof_date,
            metric_key,
            value,
            unit,
            band,
            json.dumps(inputs, ensure_ascii=False, sort_keys=True),
            computed_at,
        ),
    )
    conn.commit()


def load_snapshot(conn: sqlite3.Connection, asof_date: str) -> list[sqlite3.Row]:
    return list(
        conn.execute(
            "SELECT * FROM rates_snapshot WHERE asof_date = ? ORDER BY metric_key", (asof_date,)
        )
    )


def latest_snapshot_date(conn: sqlite3.Connection) -> str | None:
    row = conn.execute("SELECT MAX(asof_date) FROM rates_snapshot").fetchone()
    return row[0] if row and row[0] else None


# ── 발표 일정 ───────────────────────────────────────────────────


def upsert_release(conn: sqlite3.Connection, row: Mapping[str, Any]) -> None:
    conn.execute(
        """
        INSERT INTO rates_release
            (release_date, indicator, period, actual, prior, revised_prior, note)
        VALUES (:release_date, :indicator, :period, :actual, :prior, :revised_prior, :note)
        ON CONFLICT(release_date, indicator, period) DO UPDATE SET
            actual = excluded.actual,
            prior = excluded.prior,
            revised_prior = excluded.revised_prior,
            note = excluded.note
        """,
        {"actual": None, "prior": None, "revised_prior": None, "note": None, **dict(row)},
    )
    conn.commit()


def load_releases(conn: sqlite3.Connection, since: str, until: str) -> list[sqlite3.Row]:
    return list(
        conn.execute(
            "SELECT * FROM rates_release WHERE release_date BETWEEN ? AND ? "
            "ORDER BY release_date, indicator",
            (since, until),
        )
    )

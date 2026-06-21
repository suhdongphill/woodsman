"""SQLite 접근 계층 — 스키마 정의와 조회/적재 헬퍼.

기본 DB 경로는 환경변수 ``PMS_DB`` 또는 현재 작업 디렉터리의 ``pms.db``.
CLI에서 ``--db`` 옵션으로 덮어쓸 수 있다.
"""

from __future__ import annotations

import os
import sqlite3

import pandas as pd


def default_db_path() -> str:
    return os.environ.get("PMS_DB") or os.path.join(os.getcwd(), "pms.db")


SCHEMA = """
CREATE TABLE IF NOT EXISTS prices (
    ticker TEXT    NOT NULL,
    date   TEXT    NOT NULL,          -- ISO 'YYYY-MM-DD'
    open   REAL,
    high   REAL,
    low    REAL,
    close  REAL,
    volume INTEGER,
    PRIMARY KEY (ticker, date)
);

CREATE INDEX IF NOT EXISTS idx_prices_ticker_date ON prices (ticker, date);

CREATE TABLE IF NOT EXISTS trades (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker TEXT    NOT NULL,
    date   TEXT    NOT NULL,          -- ISO 'YYYY-MM-DD'
    side   TEXT    NOT NULL CHECK (side IN ('buy', 'sell')),
    price  REAL    NOT NULL,
    qty    REAL    NOT NULL,
    note   TEXT
);

CREATE INDEX IF NOT EXISTS idx_trades_ticker_date ON trades (ticker, date);
"""


def connect(db_path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db(db_path: str) -> None:
    with connect(db_path) as conn:
        conn.executescript(SCHEMA)


def load_prices(conn: sqlite3.Connection, ticker: str) -> pd.DataFrame:
    """티커의 OHLCV를 날짜 오름차순 DataFrame으로 반환한다."""
    df = pd.read_sql_query(
        "SELECT date, open, high, low, close, volume "
        "FROM prices WHERE ticker = ? ORDER BY date ASC",
        conn,
        params=(ticker,),
    )
    return df


def load_trades(conn: sqlite3.Connection, ticker: str) -> pd.DataFrame:
    """티커의 매매기록을 날짜 오름차순 DataFrame으로 반환한다."""
    df = pd.read_sql_query(
        "SELECT date, side, price, qty, note "
        "FROM trades WHERE ticker = ? ORDER BY date ASC, id ASC",
        conn,
        params=(ticker,),
    )
    return df


def list_tickers(conn: sqlite3.Connection) -> list[str]:
    rows = conn.execute(
        "SELECT DISTINCT ticker FROM prices ORDER BY ticker"
    ).fetchall()
    return [r[0] for r in rows]


def upsert_prices(conn: sqlite3.Connection, ticker: str, rows: pd.DataFrame) -> int:
    """OHLCV DataFrame을 prices 테이블에 UPSERT. 반영된 행 수를 반환."""
    cols = ["date", "open", "high", "low", "close", "volume"]
    records = [
        (ticker, str(r["date"]), _f(r["open"]), _f(r["high"]),
         _f(r["low"]), _f(r["close"]), _i(r["volume"]))
        for _, r in rows[cols].iterrows()
    ]
    conn.executemany(
        "INSERT INTO prices (ticker, date, open, high, low, close, volume) "
        "VALUES (?, ?, ?, ?, ?, ?, ?) "
        "ON CONFLICT(ticker, date) DO UPDATE SET "
        "open=excluded.open, high=excluded.high, low=excluded.low, "
        "close=excluded.close, volume=excluded.volume",
        records,
    )
    conn.commit()
    return len(records)


def insert_trade(
    conn: sqlite3.Connection,
    ticker: str,
    date: str,
    side: str,
    price: float,
    qty: float,
    note: str | None = None,
) -> int:
    cur = conn.execute(
        "INSERT INTO trades (ticker, date, side, price, qty, note) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (ticker, date, side, price, qty, note),
    )
    conn.commit()
    return cur.lastrowid


def _f(v):
    try:
        return None if v is None else float(v)
    except (TypeError, ValueError):
        return None


def _i(v):
    try:
        return None if v is None else int(float(v))
    except (TypeError, ValueError):
        return None

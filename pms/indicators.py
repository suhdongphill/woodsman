"""pandas 기반 기술적 지표 계산.

lightweight-charts에는 RSI/MACD 같은 지표가 내장돼 있지 않으므로
여기서 계산해 line series 데이터로 넘긴다.
"""

from __future__ import annotations

import pandas as pd


def rsi(close: pd.Series, period: int = 14) -> pd.Series:
    """Wilder 평활(EWMA, alpha=1/period)을 사용하는 표준 RSI."""
    delta = close.diff()
    gain = delta.clip(lower=0.0)
    loss = -delta.clip(upper=0.0)

    avg_gain = gain.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()

    rs = avg_gain / avg_loss
    out = 100.0 - (100.0 / (1.0 + rs))
    # 손실 평균이 0이면 RS가 무한대 → RSI=100
    out = out.where(avg_loss != 0, 100.0)
    # 워밍업 구간은 NaN 유지
    out[avg_gain.isna() | avg_loss.isna()] = float("nan")
    return out


def add_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """OHLCV DataFrame에 MA20/60/120, RSI(14) 컬럼을 추가해 반환한다."""
    if df.empty:
        for c in ("ma20", "ma60", "ma120", "rsi14"):
            df[c] = pd.Series(dtype="float64")
        return df

    df = df.sort_values("date").reset_index(drop=True)
    close = df["close"].astype("float64")

    df["ma20"] = close.rolling(window=20, min_periods=20).mean()
    df["ma60"] = close.rolling(window=60, min_periods=60).mean()
    df["ma120"] = close.rolling(window=120, min_periods=120).mean()
    df["rsi14"] = rsi(close, 14)
    return df

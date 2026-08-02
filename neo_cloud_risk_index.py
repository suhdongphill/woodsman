# neo_cloud_risk_index.py
# 네오클라우드 차트 리스크 인덱스 프로그램
# 사용법:
#   pip install yfinance pandas numpy plotly streamlit
#   streamlit run neo_cloud_risk_index.py

import numpy as np
import pandas as pd
import yfinance as yf
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import streamlit as st


DEFAULT_TICKERS = "CRWV, NBIS, IREN"
BENCHMARK = "QQQ"


def rsi(series: pd.Series, period: int = 14) -> pd.Series:
    delta = series.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(alpha=1 / period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / period, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    return 100 - (100 / (1 + rs))


def macd(close: pd.Series):
    ema12 = close.ewm(span=12, adjust=False).mean()
    ema26 = close.ewm(span=26, adjust=False).mean()
    macd_line = ema12 - ema26
    signal = macd_line.ewm(span=9, adjust=False).mean()
    hist = macd_line - signal
    return macd_line, signal, hist


def score_distance(close, ma20):
    dist = close / ma20 * 100
    score = pd.Series(0, index=close.index, dtype=float)
    score[dist > 130] = 20
    score[(dist > 120) & (dist <= 130)] = 15
    score[(dist > 110) & (dist <= 120)] = 10
    score[dist < 95] = 5
    return score, dist


def score_rsi(rsi14):
    score = pd.Series(0, index=rsi14.index, dtype=float)
    score[rsi14 > 80] = 15
    score[(rsi14 > 70) & (rsi14 <= 80)] = 10
    score[(rsi14 >= 50) & (rsi14 <= 70)] = 5
    return score


def score_volume(volume):
    v5 = volume.rolling(5).mean()
    v60 = volume.rolling(60).mean()
    ratio = v5 / v60
    score = pd.Series(0, index=volume.index, dtype=float)
    score[ratio > 3] = 15
    score[(ratio > 2) & (ratio <= 3)] = 10
    score[(ratio > 1.5) & (ratio <= 2)] = 5
    return score, ratio


def score_macd(hist):
    # MACD 히스토그램이 3일 연속 둔화하면 경고
    falling_3 = (hist.diff() < 0).rolling(3).sum() >= 3
    below_zero = hist < 0
    score = pd.Series(0, index=hist.index, dtype=float)
    score[falling_3] = 10
    score[below_zero] = 15
    return score


def score_relative_strength(close, benchmark_close):
    rs_line = close / benchmark_close.reindex(close.index).ffill()
    rs_ma20 = rs_line.rolling(20).mean()
    score = pd.Series(0, index=close.index, dtype=float)
    score[rs_line < rs_ma20] = 15
    return score, rs_line, rs_ma20


def score_trend(close):
    ma20 = close.rolling(20).mean()
    ma60 = close.rolling(60).mean()
    ma120 = close.rolling(120).mean()

    score = pd.Series(0, index=close.index, dtype=float)
    warning = (close < ma20) & (ma20.diff() < 0)
    downtrend = (close < ma60) & (ma20 < ma60)
    bear = (ma20 < ma60) & (ma60 < ma120)

    score[warning] = 10
    score[downtrend] = 15
    score[bear] = 20
    return score, ma20, ma60, ma120


def distribution_score(close, volume):
    # CANSLIM식 기관 분산 감지: 최근 20일 하락일 거래량 / 상승일 거래량
    ret = close.pct_change()
    down_vol = volume.where(ret < 0, 0).rolling(20).sum()
    up_vol = volume.where(ret > 0, 0).rolling(20).sum()
    ratio = down_vol / up_vol.replace(0, np.nan)

    score = pd.Series(0, index=close.index, dtype=float)
    score[(ratio > 1.2) & (ratio <= 1.8)] = 5
    score[ratio > 1.8] = 10
    return score, ratio


def build_index(ticker: str, benchmark: str, period="1y"):
    raw = yf.download([ticker, benchmark], period=period, auto_adjust=True, progress=False)

    if isinstance(raw.columns, pd.MultiIndex):
        close = raw["Close"][ticker].dropna()
        volume = raw["Volume"][ticker].reindex(close.index)
        bench_close = raw["Close"][benchmark].dropna()
    else:
        raise ValueError("데이터 다운로드 형식 오류")

    ma20 = close.rolling(20).mean()
    rsi14 = rsi(close)
    _, _, hist = macd(close)

    s_dist, dist = score_distance(close, ma20)
    s_rsi = score_rsi(rsi14)
    s_vol, vol_ratio = score_volume(volume)
    s_macd = score_macd(hist)
    s_rs, rs_line, rs_ma20 = score_relative_strength(close, bench_close)
    s_trend, ma20, ma60, ma120 = score_trend(close)
    s_distn, distn_ratio = distribution_score(close, volume)

    # 총점 100점으로 정규화
    raw_score = s_dist + s_rsi + s_vol + s_macd + s_rs + s_trend + s_distn
    risk_index = (raw_score / 110 * 100).clip(0, 100)

    df = pd.DataFrame({
        "Close": close,
        "MA20": ma20,
        "MA60": ma60,
        "MA120": ma120,
        "RSI14": rsi14,
        "MA20_Distance": dist,
        "Volume_Ratio_5_60": vol_ratio,
        "MACD_Hist": hist,
        "Relative_Strength": rs_line,
        "RS_MA20": rs_ma20,
        "Distribution_Ratio": distn_ratio,
        "Risk_Index": risk_index,
        "Score_Distance": s_dist,
        "Score_RSI": s_rsi,
        "Score_Volume": s_vol,
        "Score_MACD": s_macd,
        "Score_RS": s_rs,
        "Score_Trend": s_trend,
        "Score_Distribution": s_distn,
    }).dropna()

    return df


def risk_zone(value):
    if value >= 80:
        return "매우 위험"
    if value >= 60:
        return "위험"
    if value >= 40:
        return "경고"
    if value >= 20:
        return "주의"
    return "정상"


def plot_dashboard(ticker, df):
    fig = make_subplots(
        rows=4, cols=1,
        shared_xaxes=True,
        vertical_spacing=0.04,
        row_heights=[0.42, 0.22, 0.18, 0.18],
        subplot_titles=(
            f"{ticker} 가격·이동평균",
            "네오클라우드 리스크 인덱스",
            "RSI 14",
            "MACD Histogram"
        )
    )

    fig.add_trace(go.Candlestick(
        x=df.index, open=df["Close"], high=df["Close"], low=df["Close"], close=df["Close"],
        name="Close"
    ), row=1, col=1)

    fig.add_trace(go.Scatter(x=df.index, y=df["MA20"], name="MA20"), row=1, col=1)
    fig.add_trace(go.Scatter(x=df.index, y=df["MA60"], name="MA60"), row=1, col=1)
    fig.add_trace(go.Scatter(x=df.index, y=df["MA120"], name="MA120"), row=1, col=1)

    fig.add_trace(go.Scatter(x=df.index, y=df["Risk_Index"], name="Risk Index", fill="tozeroy"), row=2, col=1)
    fig.add_hline(y=20, line_dash="dot", row=2, col=1)
    fig.add_hline(y=40, line_dash="dot", row=2, col=1)
    fig.add_hline(y=60, line_dash="dot", row=2, col=1)
    fig.add_hline(y=80, line_dash="dot", row=2, col=1)

    fig.add_trace(go.Scatter(x=df.index, y=df["RSI14"], name="RSI14"), row=3, col=1)
    fig.add_hline(y=70, line_dash="dot", row=3, col=1)
    fig.add_hline(y=80, line_dash="dot", row=3, col=1)

    fig.add_trace(go.Bar(x=df.index, y=df["MACD_Hist"], name="MACD Hist"), row=4, col=1)

    fig.update_layout(
        height=950,
        xaxis_rangeslider_visible=False,
        title=f"{ticker} Neo Cloud Risk Dashboard",
        legend_orientation="h",
        legend_y=1.02
    )
    return fig


st.set_page_config(page_title="Neo Cloud Risk Index", layout="wide")
st.title("네오클라우드 차트 리스크 인덱스")

tickers = st.sidebar.text_input("티커 입력", DEFAULT_TICKERS)
benchmark = st.sidebar.text_input("벤치마크", BENCHMARK)
period = st.sidebar.selectbox("기간", ["6mo", "1y", "2y", "5y"], index=1)

ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()]

for ticker in ticker_list:
    try:
        df = build_index(ticker, benchmark.upper(), period=period)
        latest = df.iloc[-1]

        st.subheader(f"{ticker} | 현재 리스크: {latest['Risk_Index']:.1f}점 / {risk_zone(latest['Risk_Index'])}")

        c1, c2, c3, c4, c5 = st.columns(5)
        c1.metric("20일선 이격도", f"{latest['MA20_Distance']:.1f}%")
        c2.metric("RSI", f"{latest['RSI14']:.1f}")
        c3.metric("거래량 과열", f"{latest['Volume_Ratio_5_60']:.2f}배")
        c4.metric("기관분산 비율", f"{latest['Distribution_Ratio']:.2f}")
        c5.metric("위험지수", f"{latest['Risk_Index']:.1f}")

        st.plotly_chart(plot_dashboard(ticker, df), use_container_width=True)

        with st.expander(f"{ticker} 세부 점수"):
            st.dataframe(df.tail(30)[[
                "Risk_Index", "Score_Distance", "Score_RSI", "Score_Volume",
                "Score_MACD", "Score_RS", "Score_Trend", "Score_Distribution"
            ]])

    except Exception as e:
        st.error(f"{ticker} 처리 실패: {e}")

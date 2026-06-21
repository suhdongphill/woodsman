"""lightweight-charts(unpkg CDN)로 self-contained HTML을 생성하고 브라우저로 연다.

외부 시세 의존 없음 — 입력은 로컬 SQLite에서 읽어온 DataFrame뿐이다.
TradingView 계정/엔타이틀먼트 불필요.
"""

from __future__ import annotations

import json
import math
import tempfile
import webbrowser

import pandas as pd

# 다크 테마 팔레트
BG = "#0b1220"
PRIMARY = "#34d6ff"   # 상승/주색 (시안)
SECONDARY = "#ffb347"  # 보조 (오렌지)
DOWN = "#ff5d73"       # 하락 (대비되는 코랄 레드)
MA20_C = "#ffb347"     # 보조색
MA60_C = "#c792ea"     # 퍼플
MA120_C = "#8fa0b3"    # 슬레이트
TEXT = "#9aa4b2"
GRID = "rgba(255,255,255,0.06)"

LWC_CDN = (
    "https://unpkg.com/lightweight-charts@4.2.0/dist/"
    "lightweight-charts.standalone.production.js"
)


def _clean(v):
    """NaN/inf → None (lightweight-charts는 NaN을 허용하지 않음)."""
    if v is None:
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    if math.isnan(f) or math.isinf(f):
        return None
    return f


def _line(df: pd.DataFrame, col: str) -> list[dict]:
    """NaN 행을 제외한 {time, value} 리스트."""
    out = []
    for _, r in df.iterrows():
        v = _clean(r[col])
        if v is not None:
            out.append({"time": str(r["date"]), "value": v})
    return out


def build_payload(ticker: str, df: pd.DataFrame, trades: pd.DataFrame) -> dict:
    """차트에 주입할 JSON 직렬화용 dict를 구성한다."""
    candles, volume = [], []
    for _, r in df.iterrows():
        o, h, l, c = (_clean(r["open"]), _clean(r["high"]),
                      _clean(r["low"]), _clean(r["close"]))
        if None in (o, h, l, c):
            continue
        t = str(r["date"])
        candles.append({"time": t, "open": o, "high": h, "low": l, "close": c})
        vol = _clean(r["volume"]) or 0
        up = c >= o
        volume.append({
            "time": t,
            "value": vol,
            "color": "rgba(52,214,255,0.45)" if up else "rgba(255,93,115,0.45)",
        })

    markers = []
    for _, r in trades.iterrows():
        buy = str(r["side"]).lower() == "buy"
        qty = _clean(r["qty"]) or 0
        price = _clean(r["price"]) or 0
        markers.append({
            "time": str(r["date"]),
            "position": "belowBar" if buy else "aboveBar",
            "color": PRIMARY if buy else DOWN,
            "shape": "arrowUp" if buy else "arrowDown",
            "text": f"{'B' if buy else 'S'} {qty:g}@{price:g}",
        })
    # 마커는 시간 오름차순이어야 함
    markers.sort(key=lambda m: m["time"])

    return {
        "title": ticker,
        "candles": candles,
        "volume": volume,
        "ma20": _line(df, "ma20"),
        "ma60": _line(df, "ma60"),
        "ma120": _line(df, "ma120"),
        "rsi": _line(df, "rsi14"),
        "markers": markers,
    }


def render_html(payload: dict) -> str:
    data_json = json.dumps(payload, ensure_ascii=False)
    return _TEMPLATE.replace("__DATA_JSON__", data_json)


def open_chart(ticker: str, df: pd.DataFrame, trades: pd.DataFrame) -> str:
    """HTML을 임시파일로 쓰고 기본 브라우저로 연다. 파일 경로를 반환."""
    payload = build_payload(ticker, df, trades)
    html = render_html(payload)
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=f"_{ticker}_chart.html", delete=False, encoding="utf-8"
    ) as fh:
        fh.write(html)
        path = fh.name
    webbrowser.open(f"file://{path}")
    return path


_TEMPLATE = """<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>PMS Chart</title>
<script src="%CDN%"></script>
<style>
  html, body { margin: 0; height: 100%; background: %BG%; color: %TEXT%;
    font-family: -apple-system, "Segoe UI", Roboto, "Malgun Gothic", sans-serif; }
  #wrap { display: flex; flex-direction: column; height: 100vh; }
  #head { padding: 10px 14px; display: flex; align-items: baseline; gap: 14px;
    border-bottom: 1px solid rgba(255,255,255,0.06); }
  #head h1 { margin: 0; font-size: 18px; color: #e6edf3; letter-spacing: .5px; }
  #legend { font-size: 12px; color: %TEXT%; display: flex; gap: 14px; flex-wrap: wrap; }
  #legend span b { font-weight: 600; }
  .dot { display: inline-block; width: 9px; height: 9px; border-radius: 2px;
    margin-right: 5px; vertical-align: middle; }
  #main { flex: 1 1 70%; min-height: 0; position: relative; }
  #rsiLabel { position: absolute; left: 10px; top: 6px; z-index: 3; font-size: 12px;
    color: %TEXT%; }
  #rsiWrap { flex: 0 0 26%; min-height: 0; position: relative;
    border-top: 1px solid rgba(255,255,255,0.06); }
  #rsi { position: absolute; inset: 0; }
  #empty { position: absolute; inset: 0; display: none; align-items: center;
    justify-content: center; color: %TEXT%; font-size: 15px; }
</style>
</head>
<body>
<div id="wrap">
  <div id="head">
    <h1 id="title">—</h1>
    <div id="legend">
      <span><i class="dot" style="background:%PRIMARY%"></i>캔들(상승)</span>
      <span><i class="dot" style="background:%DOWN%"></i>하락</span>
      <span><i class="dot" style="background:%MA20%"></i>MA20</span>
      <span><i class="dot" style="background:%MA60%"></i>MA60</span>
      <span><i class="dot" style="background:%MA120%"></i>MA120</span>
      <span id="ohlc"></span>
    </div>
  </div>
  <div id="main"><div id="empty">데이터 없음 — 이 티커의 가격 데이터가 SQLite에 없습니다.</div></div>
  <div id="rsiWrap"><div id="rsiLabel">RSI(14)</div><div id="rsi"></div></div>
</div>

<script>
const DATA = __DATA_JSON__;
const C = {
  bg: "%BG%", text: "%TEXT%", grid: "%GRID%",
  primary: "%PRIMARY%", down: "%DOWN%",
  ma20: "%MA20%", ma60: "%MA60%", ma120: "%MA120%"
};

document.getElementById("title").textContent = DATA.title;

if (!DATA.candles || DATA.candles.length === 0) {
  document.getElementById("empty").style.display = "flex";
}

const LWC = LightweightCharts;
const baseLayout = {
  layout: { background: { type: "solid", color: C.bg }, textColor: C.text,
            fontSize: 11 },
  grid: { vertLines: { color: C.grid }, horzLines: { color: C.grid } },
  rightPriceScale: { borderColor: "rgba(255,255,255,0.12)" },
  timeScale: { borderColor: "rgba(255,255,255,0.12)", timeVisible: false },
  crosshair: { mode: LWC.CrosshairMode.Normal },
};

const mainEl = document.getElementById("main");
const rsiEl = document.getElementById("rsi");

const mainChart = LWC.createChart(mainEl, baseLayout);
const rsiChart = LWC.createChart(rsiEl, baseLayout);

// --- 메인: 캔들 + MA + 거래량(하단 오버레이) ---
const candle = mainChart.addCandlestickSeries({
  upColor: C.primary, borderUpColor: C.primary, wickUpColor: C.primary,
  downColor: C.down, borderDownColor: C.down, wickDownColor: C.down,
});
candle.setData(DATA.candles);

function addMA(data, color, title) {
  const s = mainChart.addLineSeries({ color, lineWidth: 1.5, title,
    priceLineVisible: false, lastValueVisible: false,
    crosshairMarkerVisible: false });
  s.setData(data);
  return s;
}
addMA(DATA.ma20, C.ma20, "MA20");
addMA(DATA.ma60, C.ma60, "MA60");
addMA(DATA.ma120, C.ma120, "MA120");

const vol = mainChart.addHistogramSeries({
  priceFormat: { type: "volume" },
  priceScaleId: "vol", lastValueVisible: false, priceLineVisible: false,
});
vol.setData(DATA.volume);
mainChart.priceScale("vol").applyOptions({
  scaleMargins: { top: 0.8, bottom: 0 },
});

if (DATA.markers && DATA.markers.length) {
  candle.setMarkers(DATA.markers);
}

// --- 별도 패널: RSI(14) ---
const rsiLine = rsiChart.addLineSeries({ color: C.primary, lineWidth: 1.5,
  priceLineVisible: false, lastValueVisible: true });
rsiLine.setData(DATA.rsi);
rsiChart.priceScale("right").applyOptions({
  scaleMargins: { top: 0.1, bottom: 0.1 },
  autoScale: false,
});
// RSI는 0~100 고정
rsiLine.applyOptions({ autoscaleInfoProvider: () => ({
  priceRange: { minValue: 0, maxValue: 100 } }) });
rsiLine.createPriceLine({ price: 70, color: C.down, lineWidth: 1,
  lineStyle: 2, axisLabelVisible: true, title: "70" });
rsiLine.createPriceLine({ price: 30, color: C.primary, lineWidth: 1,
  lineStyle: 2, axisLabelVisible: true, title: "30" });
rsiLine.createPriceLine({ price: 50, color: "rgba(255,255,255,0.18)",
  lineWidth: 1, lineStyle: 3, axisLabelVisible: false });

// --- 두 차트 시간축 동기화 ---
let syncing = false;
function link(a, b) {
  a.timeScale().subscribeVisibleLogicalRangeChange((range) => {
    if (syncing || !range) return;
    syncing = true;
    b.timeScale().setVisibleLogicalRange(range);
    syncing = false;
  });
}
link(mainChart, rsiChart);
link(rsiChart, mainChart);

// 크로스헤어 동기화
function linkCrosshair(src, dst, dstSeries) {
  src.subscribeCrosshairMove((param) => {
    if (!param.time) { dst.clearCrosshairPosition(); return; }
    dst.setCrosshairPosition(0, param.time, dstSeries);
  });
}
linkCrosshair(mainChart, rsiChart, rsiLine);
linkCrosshair(rsiChart, mainChart, candle);

// OHLC 레전드 업데이트
const ohlcEl = document.getElementById("ohlc");
mainChart.subscribeCrosshairMove((param) => {
  const d = param.seriesData && param.seriesData.get(candle);
  if (!d) { ohlcEl.textContent = ""; return; }
  const f = (x) => (x == null ? "-" : Number(x).toLocaleString());
  ohlcEl.innerHTML = "<b>O</b> " + f(d.open) + "  <b>H</b> " + f(d.high) +
    "  <b>L</b> " + f(d.low) + "  <b>C</b> " + f(d.close);
});

mainChart.timeScale().fitContent();

// 리사이즈 대응
function resize() {
  mainChart.applyOptions({ width: mainEl.clientWidth, height: mainEl.clientHeight });
  rsiChart.applyOptions({ width: rsiEl.clientWidth, height: rsiEl.clientHeight });
}
new ResizeObserver(resize).observe(mainEl);
new ResizeObserver(resize).observe(rsiEl);
resize();
</script>
</body>
</html>
"""

# %%-style 토큰을 실제 색상 값으로 치환 (JS의 %% 이스케이프는 아래에서 정리)
_TEMPLATE = (
    _TEMPLATE
    .replace("%CDN%", LWC_CDN)
    .replace("%BG%", BG)
    .replace("%TEXT%", TEXT)
    .replace("%GRID%", GRID)
    .replace("%PRIMARY%", PRIMARY)
    .replace("%DOWN%", DOWN)
    .replace("%MA20%", MA20_C)
    .replace("%MA60%", MA60_C)
    .replace("%MA120%", MA120_C)
    .replace("%SECONDARY%", SECONDARY)
)

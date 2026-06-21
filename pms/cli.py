"""``pms`` click 진입점과 서브커맨드.

    pms init-db                      스키마 생성
    pms import-prices TICKER CSV     CSV(OHLCV)를 적재
    pms add-trade TICKER ...         매매기록 1건 추가
    pms list-trades TICKER           매매기록 조회
    pms seed-demo TICKER             검증용 합성 OHLCV/매매 데이터 생성
    pms chart TICKER                 차트 HTML 생성 후 브라우저로 열기
"""

from __future__ import annotations

import os
import sys

import click
import pandas as pd

# Windows 기본 콘솔(cp949)에서 한글/기호 출력이 깨지지 않도록 UTF-8로 재설정
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    except Exception:
        pass

from . import __version__, chart as chartmod, db
from .indicators import add_indicators


@click.group(context_settings={"help_option_names": ["-h", "--help"]})
@click.version_option(__version__, prog_name="pms")
@click.option(
    "--db",
    "db_path",
    default=None,
    envvar="PMS_DB",
    type=click.Path(dir_okay=False),
    help="SQLite DB 경로 (기본: $PMS_DB 또는 ./pms.db).",
)
@click.pass_context
def cli(ctx: click.Context, db_path: str | None) -> None:
    """PMS — 로컬 SQLite 기반 포트폴리오/시세 관리 CLI."""
    ctx.ensure_object(dict)
    ctx.obj["db_path"] = db_path or db.default_db_path()


@cli.command("init-db")
@click.pass_context
def init_db_cmd(ctx: click.Context) -> None:
    """가격/매매 테이블 스키마를 생성한다."""
    path = ctx.obj["db_path"]
    db.init_db(path)
    click.echo(f"초기화 완료: {path}")


@cli.command("import-prices")
@click.argument("ticker")
@click.argument("csv_path", type=click.Path(exists=True, dir_okay=False))
@click.pass_context
def import_prices_cmd(ctx: click.Context, ticker: str, csv_path: str) -> None:
    """CSV(date,open,high,low,close,volume)를 prices에 적재한다."""
    path = ctx.obj["db_path"]
    df = pd.read_csv(csv_path)
    df.columns = [c.strip().lower() for c in df.columns]
    required = {"date", "open", "high", "low", "close", "volume"}
    missing = required - set(df.columns)
    if missing:
        raise click.ClickException(f"CSV에 누락된 컬럼: {sorted(missing)}")
    db.init_db(path)
    with db.connect(path) as conn:
        n = db.upsert_prices(conn, ticker.upper(), df)
    click.echo(f"{ticker.upper()}: {n}개 가격 행 적재")


@cli.command("add-trade")
@click.argument("ticker")
@click.option("--date", "date", required=True, help="매매일 (YYYY-MM-DD).")
@click.option("--side", type=click.Choice(["buy", "sell"]), required=True)
@click.option("--price", type=float, required=True)
@click.option("--qty", type=float, required=True)
@click.option("--note", default=None)
@click.pass_context
def add_trade_cmd(ctx, ticker, date, side, price, qty, note) -> None:
    """매매기록 1건을 추가한다."""
    path = ctx.obj["db_path"]
    db.init_db(path)
    with db.connect(path) as conn:
        tid = db.insert_trade(conn, ticker.upper(), date, side, price, qty, note)
    click.echo(f"매매기록 추가 (id={tid}): {ticker.upper()} {side} {qty}@{price}")


@cli.command("list-trades")
@click.argument("ticker")
@click.pass_context
def list_trades_cmd(ctx: click.Context, ticker: str) -> None:
    """티커의 매매기록을 출력한다."""
    path = ctx.obj["db_path"]
    db.init_db(path)
    with db.connect(path) as conn:
        df = db.load_trades(conn, ticker.upper())
    if df.empty:
        click.echo(f"{ticker.upper()}: 매매기록 없음")
        return
    click.echo(df.to_string(index=False))


@cli.command("chart")
@click.argument("ticker")
@click.option("--no-open", is_flag=True, help="브라우저를 열지 않고 파일만 생성.")
@click.pass_context
def chart_cmd(ctx: click.Context, ticker: str, no_open: bool) -> None:
    """TICKER의 OHLCV/지표/매매기록으로 차트를 생성해 브라우저로 연다."""
    path = ctx.obj["db_path"]
    if not os.path.exists(path):
        raise click.ClickException(
            f"DB가 없습니다: {path}\n먼저 `pms init-db` 후 데이터를 적재하세요 "
            f"(또는 `pms seed-demo {ticker.upper()}`)."
        )
    ticker = ticker.upper()
    with db.connect(path) as conn:
        prices = db.load_prices(conn, ticker)
        trades = db.load_trades(conn, ticker)

    if prices.empty:
        click.echo(
            f"경고: {ticker} 가격 데이터가 없습니다. 빈 차트를 생성합니다.",
            err=True,
        )

    prices = add_indicators(prices)

    if no_open:
        payload = chartmod.build_payload(ticker, prices, trades)
        html = chartmod.render_html(payload)
        import tempfile
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=f"_{ticker}_chart.html", delete=False, encoding="utf-8"
        ) as fh:
            fh.write(html)
            out = fh.name
        click.echo(f"생성: {out}")
    else:
        out = chartmod.open_chart(ticker, prices, trades)
        click.echo(f"브라우저에서 열기: {out}")


@cli.command("seed-demo")
@click.argument("ticker")
@click.option("--days", default=400, show_default=True, help="생성할 거래일 수.")
@click.pass_context
def seed_demo_cmd(ctx: click.Context, ticker: str, days: int) -> None:
    """검증용 합성 OHLCV/매매 데이터를 생성한다 (외부 시세 미사용)."""
    import datetime as _dt
    import math as _m

    ticker = ticker.upper()
    path = ctx.obj["db_path"]
    db.init_db(path)

    # 결정적 의사난수(시드 고정) 랜덤워크 — 외부 의존 없음
    import random as _r
    rng = _r.Random(hash(ticker) & 0xFFFFFFFF)

    start = _dt.date.today() - _dt.timedelta(days=int(days * 1.5))
    rows = []
    price = 100.0
    d = start
    made = 0
    while made < days:
        if d.weekday() < 5:  # 평일만
            drift = _m.sin(made / 30.0) * 0.4
            change = rng.gauss(drift, 1.6) / 100.0
            o = price
            c = max(1.0, o * (1 + change))
            hi = max(o, c) * (1 + abs(rng.gauss(0, 0.006)))
            lo = min(o, c) * (1 - abs(rng.gauss(0, 0.006)))
            vol = int(abs(rng.gauss(1_000_000, 350_000)))
            rows.append({"date": d.isoformat(), "open": round(o, 2),
                         "high": round(hi, 2), "low": round(lo, 2),
                         "close": round(c, 2), "volume": vol})
            price = c
            made += 1
        d += _dt.timedelta(days=1)

    df = pd.DataFrame(rows)
    with db.connect(path) as conn:
        n = db.upsert_prices(conn, ticker, df)
        # 매매 마커 몇 개 생성
        conn.execute("DELETE FROM trades WHERE ticker = ? AND note = 'demo'", (ticker,))
        for n_th, idx in enumerate((days // 5, days // 2, int(days * 0.8))):
            r = rows[idx]
            side = "buy" if n_th % 2 == 0 else "sell"
            db.insert_trade(conn, ticker, r["date"], side,
                            r["close"], 10, "demo")
    click.echo(f"{ticker}: 합성 가격 {n}행 + 매매 3건 생성 ({path})")


if __name__ == "__main__":
    cli()

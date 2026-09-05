"""``pms rates`` 서브커맨드.

명세 §1의 여섯 명령을 담는다. 이 파일은 **조립만** 한다 — 판단은
``catalog``·``sources``·``verify``·``compute``·``export``에 있다.

⚠ 실패한 계열이 있으면 **종료 코드 1**과 함께 목록을 낸다. 스케줄러가 성공으로 넘기면
   "도는 줄 알았는데 몇 달째 안 들어온" 상태가 된다.
"""

from __future__ import annotations

import os
import sqlite3
from datetime import date, datetime, timedelta

import click

from ..db import connect, default_db_path
from . import sources
from .catalog import default_config_path, load_catalog, pending_series
from .db import (
    init_rates,
    last_obs_date,
    list_series,
    load_observations,
    upsert_observations,
    upsert_series,
)
from .pipeline import build_payload, compute_all, default_export_path, save_metrics, write_payload
from .verify import verify_ecos_items, verify_series

# 처음 받을 때 어디까지 거슬러 올라가나. 사이클을 보려면 두 번의 침체가 필요하다.
DEFAULT_SINCE = "2005-01-01"
# 이미 쌓여 있을 때 되감는 일수. ⚠ 통계는 사후 개정되므로 최근 구간을 다시 받는다.
REWIND_DAYS = 400


def _load_dotenv() -> None:
    """``.env``에서 키를 읽는다(이미 환경에 있으면 건드리지 않는다).

    ⚠ 저장소 루트 → ``web/.env`` 순으로 본다. 값은 로그에 남기지 않는다.
    """
    here = os.path.dirname(os.path.abspath(__file__))
    root = os.path.dirname(os.path.dirname(here))
    for path in (os.path.join(root, ".env"), os.path.join(root, "web", ".env")):
        if not os.path.exists(path):
            continue
        with open(path, "r", encoding="utf-8") as fp:
            for line in fp:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, value = line.partition("=")
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                if key and value and not os.environ.get(key):
                    os.environ[key] = value


def _conn(ctx: click.Context) -> sqlite3.Connection:
    conn = connect(ctx.obj["db_path"])
    init_rates(conn)
    return conn


@click.group("rates")
@click.pass_context
def rates(ctx: click.Context) -> None:
    """금리·거시 지표 수집과 파생 계산."""
    _load_dotenv()
    ctx.ensure_object(dict)
    ctx.obj.setdefault("db_path", default_db_path())


@rates.command("seed")
@click.option("--config", "config_path", default=None, help="계열 카탈로그 YAML 경로.")
@click.pass_context
def seed_cmd(ctx: click.Context, config_path: str | None) -> None:
    """카탈로그(YAML)를 DB의 ``rates_series``에 심는다."""
    catalog = load_catalog(config_path)
    with _conn(ctx) as conn:
        count = upsert_series(conn, (s.as_row() for s in catalog))

    click.echo(f"계열 {count}개를 심었습니다 ({config_path or default_config_path()}).")
    for entry in pending_series(config_path):
        click.echo(f"  ⚠ 미확정 후보(사람이 고를 것): {entry['id']} — {entry.get('name_ko')}")


@rates.command("verify")
@click.option("--golden", is_flag=True, help="골든 테스트도 함께 돌린다.")
@click.option("--config", "config_path", default=None)
@click.pass_context
def verify_cmd(ctx: click.Context, golden: bool, config_path: str | None) -> None:
    """계열 ID의 존재·최신 관측일·단위를 실제 API로 확인한다."""
    catalog = load_catalog(config_path)
    fred = sources.fred_key()
    ecos = sources.ecos_key()

    if not fred:
        click.echo("⚠ FRED_API_KEY가 없습니다 — 관측치는 확인하지만 단위·계절조정은 대조하지 못합니다.")
    if not ecos:
        click.echo("⚠ ECOS_API_KEY가 없습니다 — 한국 계열은 확인하지 못합니다.")

    failed: list[str] = []
    for definition in catalog:
        row = verify_series(definition, fred_api_key=fred, ecos_api_key=ecos)
        if row.ok:
            click.echo(f"OK   {row.series_id:<24} {row.latest}  {row.value}")
            for note in row.notes:
                click.echo(f"       · {note}")
        else:
            failed.append(row.series_id)
            click.echo(f"FAIL {row.series_id:<24} {row.error}")

    if ecos:
        click.echo("\n[ECOS 항목코드 대조]")
        for series_id, ok, note in verify_ecos_items(catalog, ecos):
            click.echo(f"{'OK  ' if ok else 'FAIL'} {series_id:<24} {note}")
            if not ok:
                failed.append(series_id)

    for entry in pending_series(config_path):
        click.echo(f"\n⚠ 미확정 계열: {entry['id']} — 사람이 고른 뒤 chosen: true 로 바꾸세요.")

    if golden:
        click.echo("\n[골든 테스트] pytest tests/test_rates.py -k golden 으로 돌립니다.")

    if failed:
        click.echo(f"\n실패 {len(failed)}건: {', '.join(sorted(set(failed)))}")
        raise SystemExit(1)
    click.echo(f"\n계열 {len(catalog)}개 확인 완료.")


@rates.command("fetch")
@click.option("--since", default=DEFAULT_SINCE, show_default=True, help="처음 받을 때의 시작일.")
@click.option(
    "--source",
    "source_filter",
    type=click.Choice(["fred", "ecos", "all"]),
    default="all",
    show_default=True,
)
@click.option("--series", "series_filter", default=None, help="쉼표로 구분한 계열 ID.")
@click.option("--force", is_flag=True, help="증분이 아니라 전체를 다시 받는다.")
@click.option("--config", "config_path", default=None)
@click.pass_context
def fetch_cmd(
    ctx: click.Context,
    since: str,
    source_filter: str,
    series_filter: str | None,
    force: bool,
    config_path: str | None,
) -> None:
    """관측치를 증분 수집한다. ⚠ 실패한 계열은 건너뛰되 목록으로 남기고 종료 코드 1."""
    catalog = load_catalog(config_path)
    wanted = {s.strip() for s in series_filter.split(",")} if series_filter else None

    ecos = sources.ecos_key()
    now = datetime.now().astimezone().isoformat(timespec="seconds")
    today = date.today().isoformat()

    ok_count = 0
    added_total = 0
    failed: list[tuple[str, str]] = []

    with _conn(ctx) as conn:
        upsert_series(conn, (s.as_row() for s in catalog))

        for definition in catalog:
            if wanted and definition.series_id not in wanted:
                continue
            if source_filter != "all" and definition.source.lower() != source_filter:
                continue

            known = None if force else last_obs_date(conn, definition.series_id)
            start = since
            if known:
                start = (
                    datetime.strptime(known, "%Y-%m-%d").date() - timedelta(days=REWIND_DAYS)
                ).isoformat()

            try:
                if definition.source == "FRED":
                    points = sources.fred_observations(definition.series_id, since=start)
                else:
                    if not ecos:
                        raise sources.SourceError("ECOS_API_KEY가 없습니다")
                    points = sources.ecos_observations(
                        definition.table or "",
                        definition.item or "",
                        definition.cycle or definition.frequency,
                        ecos,
                        start,
                        today,
                    )
            except sources.SourceError as exc:
                failed.append((definition.series_id, str(exc)))
                click.echo(f"FAIL {definition.series_id:<24} {exc}")
                continue

            written = upsert_observations(conn, definition.series_id, points, now)
            new_points = sum(1 for d, v in points if v is not None and (not known or d > known))
            ok_count += 1
            added_total += new_points
            click.echo(
                f"OK   {definition.series_id:<24} {len(points):>5}행 · 새 값 {new_points:>4} · "
                f"최신 {max((d for d, v in points if v is not None), default='—')}"
            )

    click.echo(f"\n성공 {ok_count} · 실패 {len(failed)} · 새 관측 {added_total}")
    if failed:
        for series_id, why in failed:
            click.echo(f"  실패: {series_id} — {why}")
        raise SystemExit(1)


@rates.command("show")
@click.option(
    "--layer",
    type=click.Choice(["all", "policy", "inflation", "labor", "credit", "two_speed", "liquidity", "krus"]),
    default="all",
    show_default=True,
)
@click.option("--format", "fmt", type=click.Choice(["table", "json"]), default="table")
@click.pass_context
def show_cmd(ctx: click.Context, layer: str, fmt: str) -> None:
    """수집된 계열의 최신값을 본다."""
    import json as _json

    with _conn(ctx) as conn:
        rows = list_series(conn)
        out = []
        for row in rows:
            if layer != "all" and (row["layer"] or "") != layer:
                continue
            points = load_observations(conn, row["series_id"])
            observed = [(d, v) for d, v in points if v is not None]
            latest = observed[-1] if observed else (None, None)
            out.append(
                {
                    "series_id": row["series_id"],
                    "name_ko": row["name_ko"],
                    "layer": row["layer"],
                    "unit": row["unit"],
                    "last_obs_date": latest[0],
                    "value": latest[1],
                    "n": len(points),
                }
            )

    if fmt == "json":
        click.echo(_json.dumps(out, ensure_ascii=False, indent=2))
        return

    if not out:
        click.echo("아직 받은 계열이 없습니다. `pms rates fetch`를 먼저 돌리세요.")
        return
    click.echo(f"{'계열':<24}{'최신일':<12}{'값':>14}{'관측수':>8}  이름")
    for row in out:
        # ⚠ 값이 없으면 0이 아니라 '—'다. 미발표와 0을 같은 칸에 그리지 않는다.
        value = "—" if row["value"] is None else format(row["value"], ",.3f")
        click.echo(
            f"{row['series_id']:<24}{row['last_obs_date'] or '—':<12}"
            f"{value:>14}{row['n']:>8}  {row['name_ko']}"
        )


@rates.command("compute")
@click.option("--asof", default=None, help="기준일(YYYY-MM-DD). 기본값은 오늘.")
@click.pass_context
def compute_cmd(ctx: click.Context, asof: str | None) -> None:
    """파생 지표를 계산해 스냅숏으로 남긴다. ⚠ 입력이 없으면 값은 None으로 저장된다."""
    asof = asof or date.today().isoformat()

    with _conn(ctx) as conn:
        metrics = compute_all(conn, asof)
        save_metrics(conn, asof, metrics)

    for metric in metrics:
        value = "—" if metric.value is None else format(metric.value, ",.3f")
        band = f" [{metric.band}]" if metric.band else ""
        click.echo(f"{metric.key:<34}{value:>12} {metric.unit}{band}")
        if metric.note:
            click.echo(f"    · {metric.note}")

    empty = [m.key for m in metrics if m.value is None]
    click.echo("")
    click.echo(f"{len(metrics)}개 계산 · 값 없음 {len(empty)}개")
    if empty:
        click.echo("  값 없음: " + ", ".join(empty))


@rates.command("export")
@click.option("--out", "out_path", default=None, help="내보낼 파일 경로.")
@click.option("--history-months", default=120, show_default=True)
@click.option("--asof", default=None)
@click.pass_context
def export_cmd(ctx: click.Context, out_path: str | None, history_months: int, asof: str | None) -> None:
    """`rates.json` 한 파일로 내보낸다. ⚠ 결측은 null로 나가고 프런트가 선을 끊는다."""
    out_path = out_path or default_export_path()

    with _conn(ctx) as conn:
        asof = asof or (conn.execute("SELECT MAX(asof_date) FROM rates_snapshot").fetchone()[0])
        if not asof:
            raise SystemExit("스냅숏이 없습니다 — `pms rates compute`를 먼저 돌리세요")
        payload = build_payload(conn, asof, history_months)

    size = write_payload(payload, out_path)
    click.echo(f"{out_path} · {size / 1024:.0f}KB · 계열 {len(payload['series'])}개 · 지표 {len(payload['metrics'])}개")
    if size > 1024 * 1024:
        click.echo("⚠ 1MB를 넘었습니다 — --history-months를 줄이세요(명세 §5).")
    if payload["meta"]["missing_series"]:
        click.echo("⚠ 값이 하나도 없는 계열: " + ", ".join(payload["meta"]["missing_series"]))


@rates.command("calendar")
@click.option("--days", default=30, show_default=True)
@click.pass_context
def calendar_cmd(ctx: click.Context, days: int) -> None:
    """향후 발표 일정. ⚠ 비어 있으면 비어 있다고 말한다 — 지어내지 않는다."""
    today = date.today()
    until = (today + timedelta(days=days)).isoformat()

    with _conn(ctx) as conn:
        rows = conn.execute(
            "SELECT * FROM rates_release WHERE release_date BETWEEN ? AND ? ORDER BY release_date",
            (today.isoformat(), until),
        ).fetchall()

    if not rows:
        click.echo(f"{today} ~ {until} 사이에 기록된 발표 일정이 없습니다.")
        click.echo("⚠ 일정은 아직 사람이 넣습니다(rates_release). 자동 수집은 다음 단계입니다.")
        return
    for row in rows:
        click.echo(f"{row['release_date']}  {row['indicator']:<12} {row['period']}  {row['note'] or ''}")


@rates.command("daily")
@click.option("--commit", is_flag=True, help="rates.json을 커밋한다(푸시하면 배포로 이어진다).")
@click.option("--log-dir", default=None, help="실행 로그 폴더. 기본값 logs/.")
@click.pass_context
def daily_cmd(ctx: click.Context, commit: bool, log_dir: str | None) -> None:
    """fetch → compute → export를 한 번에 (명세 §7 A안).

    ⚠ **실패하면 이전 rates.json을 그대로 둔다.** 다만 그 파일의 meta.stale을 켜서
       화면이 「이 자료는 언제 기준이고 갱신이 실패했다」고 말하게 한다 —
       오래된 데이터를 최신인 것처럼 보여주지 않는다.
    ⚠ 커밋은 **기본값이 아니다.** 스케줄러가 저 혼자 저장소를 밀지 않게 한다.
    """
    import json
    import subprocess

    root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    logs = log_dir or os.path.join(root, "logs")
    os.makedirs(logs, exist_ok=True)
    log_path = os.path.join(logs, f"rates_{date.today():%Y%m%d}.log")

    def log(line: str) -> None:
        stamp = datetime.now().astimezone().isoformat(timespec="seconds")
        click.echo(line)
        with open(log_path, "a", encoding="utf-8") as fp:
            fp.write(f"{stamp} {line}" + chr(10))

    asof = date.today().isoformat()
    out_path = default_export_path()

    try:
        with _conn(ctx) as conn:
            catalog = load_catalog()
            upsert_series(conn, (s.as_row() for s in catalog))

            ecos = sources.ecos_key()
            failed: list[str] = []
            for definition in catalog:
                known = last_obs_date(conn, definition.series_id)
                start = (
                    (datetime.strptime(known, "%Y-%m-%d").date() - timedelta(days=REWIND_DAYS)).isoformat()
                    if known
                    else DEFAULT_SINCE
                )
                try:
                    if definition.source == "FRED":
                        points = sources.fred_observations(definition.series_id, since=start)
                    else:
                        if not ecos:
                            raise sources.SourceError("ECOS_API_KEY가 없습니다")
                        points = sources.ecos_observations(
                            definition.table or "", definition.item or "",
                            definition.cycle or definition.frequency, ecos, start, asof,
                        )
                except sources.SourceError as exc:
                    failed.append(f"{definition.series_id}({exc})")
                    continue
                upsert_observations(
                    conn, definition.series_id, points,
                    datetime.now().astimezone().isoformat(timespec="seconds"),
                )

            log(f"fetch 완료 · 실패 {len(failed)}건")
            if failed:
                log("  실패: " + ", ".join(failed))

            metrics = compute_all(conn, asof)
            save_metrics(conn, asof, metrics)
            log(f"compute 완료 · 지표 {len(metrics)}개 · 값 없음 {sum(1 for m in metrics if m.value is None)}개")

            payload = build_payload(conn, asof)

        size = write_payload(payload, out_path)
        log(f"export 완료 · {out_path} · {size / 1024:.0f}KB")

    except Exception as exc:  # noqa: BLE001 — 스케줄러는 어떤 예외에도 상태를 남겨야 한다
        log(f"⚠ 실패: {exc}")
        # ⚠ 이전 파일을 지우지 않는다. 대신 낡았다고 표시한다.
        if os.path.exists(out_path):
            with open(out_path, "r", encoding="utf-8") as fp:
                stale = json.load(fp)
            stale["meta"]["stale"] = True
            stale["meta"]["stale_since"] = asof
            write_payload(stale, out_path)
            log("이전 rates.json을 유지하고 meta.stale을 켰습니다 — 화면이 그 사실을 말합니다.")
        raise SystemExit(1)

    if commit:
        rel = os.path.relpath(out_path, root)
        subprocess.run(["git", "add", rel], cwd=root, check=True)
        result = subprocess.run(
            ["git", "commit", "-m", f"금리 자료 갱신 ({asof})"], cwd=root, capture_output=True, text=True
        )
        log(result.stdout.strip() or result.stderr.strip())
        log("⚠ push는 하지 않았습니다 — 배포로 이어지는 단계는 사람이 누릅니다.")

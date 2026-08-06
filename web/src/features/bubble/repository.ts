/**
 * 버블 모니터의 DB 접근 — **판정과 트리거 상태만** 쌓는다.
 * 레이어·가중치·임계값은 `lib/bubble/catalog.ts`가 원본이다(코드 = 카탈로그, DB = 값).
 */
import { execute, queryAll, toBool } from "@/lib/d1";
import type { BubblePoints, BubbleReading, BubbleTriggerState } from "@/lib/bubble/types";

function dayOf(v: string | null): string | undefined {
  return v ? String(v).slice(0, 10) : undefined;
}

function toStoredDate(day: string): string {
  return `${day}T12:00:00.000Z`;
}

export async function loadReadings(): Promise<Map<string, BubbleReading>> {
  const rows = await queryAll<{
    indicatorKey: string;
    points: number;
    value: string | null;
    asOf: string | null;
    note: string | null;
  }>(`SELECT indicatorKey, points, value, asOf, note FROM BubbleReading`);

  return new Map(
    rows.map((r) => [
      r.indicatorKey,
      {
        indicatorKey: r.indicatorKey,
        // 0·1·2 밖의 값이 들어와도 화면이 깨지지 않게 좁힌다.
        points: (r.points === 1 || r.points === 2 ? r.points : 0) as BubblePoints,
        value: r.value ?? undefined,
        asOf: dayOf(r.asOf),
        note: r.note ?? undefined,
      },
    ]),
  );
}

export async function saveReading(input: {
  indicatorKey: string;
  points: BubblePoints;
  value?: string;
  asOf?: string;
  note?: string;
}): Promise<void> {
  await execute(
    `INSERT INTO BubbleReading (indicatorKey, points, value, asOf, note, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(indicatorKey) DO UPDATE SET
       points = excluded.points, value = excluded.value, asOf = excluded.asOf,
       note = excluded.note, updatedAt = excluded.updatedAt`,
    [
      input.indicatorKey,
      input.points,
      input.value ?? null,
      input.asOf ? toStoredDate(input.asOf) : null,
      input.note ?? null,
      new Date().toISOString(),
    ],
  );
}

export async function deleteReading(indicatorKey: string): Promise<void> {
  await execute(`DELETE FROM BubbleReading WHERE indicatorKey = ?`, [indicatorKey]);
}

export async function loadTriggerStates(): Promise<Map<string, BubbleTriggerState>> {
  const rows = await queryAll<{
    triggerKey: string;
    fired: number;
    proximity: string;
    now: string | null;
    asOf: string | null;
  }>(`SELECT triggerKey, fired, proximity, now, asOf FROM BubbleTriggerState`);

  return new Map(
    rows.map((r) => [
      r.triggerKey,
      {
        key: r.triggerKey,
        fired: toBool(r.fired),
        proximity: r.proximity === "near" ? "near" : "far",
        now: r.now ?? undefined,
        asOf: dayOf(r.asOf),
      },
    ]),
  );
}

export async function saveTriggerState(input: {
  key: string;
  fired: boolean;
  proximity: "far" | "near";
  now?: string;
  asOf?: string;
}): Promise<void> {
  await execute(
    `INSERT INTO BubbleTriggerState (triggerKey, fired, proximity, now, asOf, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(triggerKey) DO UPDATE SET
       fired = excluded.fired, proximity = excluded.proximity, now = excluded.now,
       asOf = excluded.asOf, updatedAt = excluded.updatedAt`,
    [
      input.key,
      input.fired ? 1 : 0,
      input.proximity,
      input.now ?? null,
      input.asOf ? toStoredDate(input.asOf) : null,
      new Date().toISOString(),
    ],
  );
}

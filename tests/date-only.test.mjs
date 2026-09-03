import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  differenceInDateOnlyDays,
  isDateOnly,
  storedDateToDateOnly,
  validateDateOnlyRange,
} from "../src/lib/date-only.ts";
import { buildTimeBandRows } from "../src/lib/scheduling.ts";

const migrationFiles = [
  "../drizzle/0000_ancient_sentinels.sql",
  "../drizzle/20260903165745_ancient_leo.sql",
  "../drizzle/20260904120000_event_limits.sql",
  "../drizzle/20260904140000_date_only.sql",
];

function readMigration(path) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

function runInTimezone(timeZone) {
  const script = [
    'import { dateOnlyToDate, dateToDateOnly } from "./src/lib/date-only.ts";',
    'const calendarDate = new Date(2026, 7, 13);',
    'console.log(JSON.stringify({ selected: dateToDateOnly(calendarDate), roundTrip: dateToDateOnly(dateOnlyToDate("2026-08-13")) }));',
  ].join(" ");

  return JSON.parse(
    execFileSync(
      process.execPath,
      ["--experimental-strip-types", "--input-type=module", "-e", script],
      {
        cwd: new URL("..", import.meta.url),
        env: { ...process.env, TZ: timeZone },
        encoding: "utf8",
      }
    )
  );
}

test("the same calendar selection remains the same date-only value across time zones", () => {
  const results = ["Asia/Tokyo", "UTC", "America/New_York"].map(runInTimezone);

  assert.deepEqual(results, [
    { selected: "2026-08-13", roundTrip: "2026-08-13" },
    { selected: "2026-08-13", roundTrip: "2026-08-13" },
    { selected: "2026-08-13", roundTrip: "2026-08-13" },
  ]);
});

test("legacy stored timestamps normalize to the Tokyo calendar date", () => {
  const tokyoMidnight = Date.parse("2026-08-12T15:00:00.000Z") / 1000;

  assert.equal(storedDateToDateOnly(tokyoMidnight), "2026-08-13");
  assert.equal(storedDateToDateOnly("2026-08-13"), "2026-08-13");
  assert.throws(() => storedDateToDateOnly("2026-02-30"), /保存された日付/);
});

test("date-only validation rejects malformed, impossible, reversed, and overlong ranges", () => {
  assert.equal(isDateOnly("2026-08-13"), true);
  assert.equal(isDateOnly("2026-8-13"), false);
  assert.equal(isDateOnly("2026-02-29"), false);
  assert.equal(isDateOnly("2024-02-29"), true);

  assert.throws(
    () => validateDateOnlyRange("2026-08-14", "2026-08-13", 93),
    /終了日は開始日より後/
  );
  assert.throws(
    () => validateDateOnlyRange("2026-08-13", "2026-11-15", 93),
    /3か月以内/
  );
  assert.throws(
    () => validateDateOnlyRange("2026-02-30", "2026-03-01", 93),
    /日付が正しくありません/
  );
  assert.equal(differenceInDateOnlyDays("2024-02-28", "2024-03-01"), 2);
});

test("same-date responses are grouped into one heatmap row", () => {
  const rows = buildTimeBandRows([
    {
      id: "alice",
      name: "Alice",
      timeSlots: [{ date: "2026-08-13", startTime: "09:00", endTime: "11:00" }],
    },
    {
      id: "bob",
      name: "Bob",
      timeSlots: [{ date: "2026-08-13", startTime: "10:00", endTime: "12:00" }],
    },
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].date, "2026-08-13");
  assert.deepEqual(rows[0].cells.filter((cell) => cell.count > 0), [
    { hour: 9, attendeeNames: ["Alice"], count: 1 },
    { hour: 10, attendeeNames: ["Alice", "Bob"], count: 2 },
    { hour: 11, attendeeNames: ["Bob"], count: 1 },
  ]);
});

test("legacy timestamp migration preserves data and rebuilds date-only schema safeguards", () => {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");
  database.exec(readMigration(migrationFiles[0]));
  database.exec(readMigration(migrationFiles[1]));
  database.exec(readMigration(migrationFiles[2]));

  const eventId = "11111111-1111-4111-8111-111111111111";
  const participantId = "participant-1";
  const unixSeconds = (value) => Math.floor(Date.parse(value) / 1000);

  database
    .prepare(
      "INSERT INTO events (id, name, description, start_date, end_date, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(
      eventId,
      "Event",
      "Memo",
      unixSeconds("2026-08-12T15:00:00.000Z"),
      unixSeconds("2026-08-14T15:00:00.000Z"),
      unixSeconds("2026-08-01T00:00:00.000Z")
    );
  database
    .prepare("INSERT INTO participants (id, event_id, name) VALUES (?, ?, ?)")
    .run(participantId, eventId, "Alice");
  database
    .prepare(
      "INSERT INTO time_slots (id, participant_id, date, start_time, end_time) VALUES (?, ?, ?, ?, ?)"
    )
    .run(
      "slot-1",
      participantId,
      unixSeconds("2026-08-13T15:00:00.000Z"),
      "09:00",
      "10:00"
    );
  database
    .prepare(
      "INSERT INTO events (id, name, description, start_date, end_date, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(
      "22222222-2222-4222-8222-222222222222",
      "New-format event",
      null,
      "2026-09-01",
      "2026-09-02",
      unixSeconds("2026-08-01T00:00:00.000Z")
    );

  database.exec(readMigration(migrationFiles[3]));

  assert.deepEqual(
    database
      .prepare("SELECT start_date, end_date, created_at FROM events ORDER BY id")
      .all()
      .map((row) => ({ ...row })),
    [
      {
        start_date: "2026-08-13",
        end_date: "2026-08-15",
        created_at: unixSeconds("2026-08-01T00:00:00.000Z"),
      },
      {
        start_date: "2026-09-01",
        end_date: "2026-09-02",
        created_at: unixSeconds("2026-08-01T00:00:00.000Z"),
      },
    ]
  );
  assert.deepEqual(
    database
      .prepare("SELECT date FROM time_slots")
      .all()
      .map((row) => ({ ...row })),
    [{ date: "2026-08-14" }]
  );
  assert.deepEqual(
    database.prepare("PRAGMA foreign_key_check").all(),
    []
  );
  assert.deepEqual(
    database
      .prepare("PRAGMA table_info(events)")
      .all()
      .filter((column) => ["start_date", "end_date"].includes(column.name))
      .map((column) => [column.name, column.type]),
    [
      ["start_date", "TEXT"],
      ["end_date", "TEXT"],
    ]
  );

  const objectNames = database
    .prepare("SELECT type, name FROM sqlite_master")
    .all()
    .filter((row) =>
      [
        "participants_event_id_name_unique",
        "time_slots_participant_id_idx",
        "participants_event_limit_before_insert",
        "time_slots_event_limit_before_insert",
      ].includes(row.name)
    )
    .map((row) => `${row.type}:${row.name}`)
    .sort();
  assert.deepEqual(objectNames, [
    "index:participants_event_id_name_unique",
    "index:time_slots_participant_id_idx",
    "trigger:participants_event_limit_before_insert",
    "trigger:time_slots_event_limit_before_insert",
  ]);
});

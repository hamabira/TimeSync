import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTimeBandRows,
  buildTopSegments,
  getBandSegmentAtHour,
  parseTimeRange,
} from "../src/lib/scheduling.ts";

const date = "2026-08-13";

function participant(id, name, startTime, endTime) {
  return {
    id,
    name,
    timeSlots: [{ date, startTime, endTime }],
  };
}

function populatedCells(startTime, endTime) {
  const [row] = buildTimeBandRows([participant("p1", "A", startTime, endTime)]);
  return row.cells.filter((cell) => cell.count > 0);
}

test("09:00-10:00 is counted only in the 09:00 hourly cell", () => {
  assert.deepEqual(populatedCells("09:00", "10:00"), [
    { hour: 9, attendeeNames: ["A"], count: 1 },
  ]);
});

test("partial-hour availability does not count as a complete hourly cell", async (t) => {
  await t.test("09:30-10:30", () => {
    assert.deepEqual(populatedCells("09:30", "10:30"), []);
  });

  await t.test("09:00-09:30", () => {
    assert.deepEqual(populatedCells("09:00", "09:30"), []);
  });
});

test("start, end, and end-of-day boundaries are handled exactly", () => {
  assert.deepEqual(
    populatedCells("08:00", "10:00").map((cell) => cell.hour),
    [8, 9]
  );

  const endOfDayCells = populatedCells("23:00", "00:00");
  assert.deepEqual(endOfDayCells, [{ hour: 23, attendeeNames: ["A"], count: 1 }]);
  assert.deepEqual(parseTimeRange("23:00", "00:00"), {
    startMinutes: 23 * 60,
    endMinutes: 24 * 60,
  });
});

test("minute-based ranges stay valid without being rounded", () => {
  assert.deepEqual(parseTimeRange("09:30", "10:30"), {
    startMinutes: 9 * 60 + 30,
    endMinutes: 10 * 60 + 30,
  });
  assert.equal(parseTimeRange("10:00", "09:00"), null);
  assert.equal(parseTimeRange("00:00", "00:00"), null);
});

test("partial-hour responses never enter the top candidates", () => {
  const rows = buildTimeBandRows([
    participant("valid", "Valid", "11:00", "12:00"),
    participant("partial-1", "Partial 1", "09:30", "10:30"),
    participant("partial-2", "Partial 2", "09:30", "10:30"),
    participant("partial-3", "Partial 3", "09:00", "09:30"),
  ]);

  assert.deepEqual(buildTopSegments(rows).slice(0, 3), [
    {
      date,
      startHour: 11,
      endHour: 12,
      attendeeNames: ["Valid"],
      count: 1,
    },
  ]);
});

test("a later, longer segment wins when attendee counts are tied", () => {
  const [row] = buildTimeBandRows([
    participant("early", "A", "06:00", "08:00"),
    {
      id: "late",
      name: "A",
      timeSlots: [{ date, startTime: "10:00", endTime: "13:00" }],
    },
  ]);

  assert.deepEqual(row.bestSegment, {
    date,
    startHour: 10,
    endHour: 13,
    attendeeNames: ["A"],
    count: 1,
  });
});

test("segment lookup keeps adjacent cells with different attendees separate", () => {
  const [row] = buildTimeBandRows([
    participant("a", "A", "09:00", "11:00"),
    participant("b", "B", "10:00", "12:00"),
  ]);

  assert.deepEqual(getBandSegmentAtHour(row, 9), {
    date,
    startHour: 9,
    endHour: 10,
    attendeeNames: ["A"],
    count: 1,
  });
  assert.deepEqual(getBandSegmentAtHour(row, 10), {
    date,
    startHour: 10,
    endHour: 11,
    attendeeNames: ["A", "B"],
    count: 2,
  });
  assert.deepEqual(getBandSegmentAtHour(row, 11), {
    date,
    startHour: 11,
    endHour: 12,
    attendeeNames: ["B"],
    count: 1,
  });
});

test("attendee names containing the display delimiter do not merge different groups", () => {
  const [row] = buildTimeBandRows([
    participant("a-delimiter", "A、B", "09:00", "10:00"),
    participant("c", "C", "09:00", "10:00"),
    participant("a", "A", "10:00", "11:00"),
    participant("b-delimiter", "B、C", "10:00", "11:00"),
  ]);

  assert.equal(row.segments.length, 2);
  assert.deepEqual(
    row.segments.map((segment) => [segment.startHour, segment.endHour]),
    [
      [9, 10],
      [10, 11],
    ]
  );
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  getDateRangeDays,
  getMaxEndDate,
  getPresetDateRange,
} from "../src/lib/date-range.ts";

function dateParts(date) {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()];
}

test("date presets use inclusive ranges", () => {
  const today = new Date(2026, 7, 13);

  assert.deepEqual(dateParts(getPresetDateRange("week", today).from), [2026, 8, 13]);
  assert.deepEqual(dateParts(getPresetDateRange("week", today).to), [2026, 8, 19]);
  assert.deepEqual(dateParts(getPresetDateRange("twoWeeks", today).to), [2026, 8, 26]);
  assert.deepEqual(dateParts(getPresetDateRange("month", today).to), [2026, 9, 12]);
  assert.equal(getDateRangeDays(getPresetDateRange("week", today)), 7);
  assert.equal(getDateRangeDays(getPresetDateRange("twoWeeks", today)), 14);
});

test("one-month preset follows the next-month-minus-one-day rule", () => {
  const today = new Date(2026, 0, 31);

  assert.deepEqual(dateParts(getPresetDateRange("month", today).to), [2026, 2, 27]);
});

test("the UI end-date limit is three calendar months from the start", () => {
  const start = new Date(2026, 4, 31);

  assert.deepEqual(dateParts(getMaxEndDate(start)), [2026, 8, 31]);
  assert.equal(getDateRangeDays({ from: start, to: getMaxEndDate(start) }), 93);
  assert.equal(getDateRangeDays({ from: start, to: new Date(2026, 8, 1) }), 94);
});

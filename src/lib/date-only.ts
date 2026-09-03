export type DateOnly = string;

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAYS_BEFORE_MONTH = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
const tokyoDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function isLeapYear(year: number) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number) {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }

  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function parseDateOnlyParts(value: DateOnly) {
  const match = DATE_ONLY_PATTERN.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    return null;
  }

  return { year, month, day };
}

export function isDateOnly(value: unknown): value is DateOnly {
  return typeof value === "string" && parseDateOnlyParts(value) !== null;
}

/**
 * Accept the new date-only storage value and the legacy Unix-second timestamp.
 * This keeps the application available while the production D1 migration is
 * applied after the compatible application version has been deployed.
 */
export function storedDateToDateOnly(value: unknown): DateOnly {
  if (isDateOnly(value)) {
    return value;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("保存された日付が正しくありません。");
  }

  const date = new Date(value * 1000);
  if (Number.isNaN(date.getTime())) {
    throw new Error("保存された日付が正しくありません。");
  }

  const parts = tokyoDateFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  const dateOnly = `${year}-${month}-${day}`;

  if (!isDateOnly(dateOnly)) {
    throw new Error("保存された日付が正しくありません。");
  }

  return dateOnly;
}

/** Return the ordinal day in the proleptic Gregorian calendar. */
export function dateOnlyToOrdinal(value: DateOnly) {
  const parts = parseDateOnlyParts(value);

  if (!parts) {
    throw new Error("日付が正しくありません。");
  }

  const yearsBefore = parts.year - 1;
  const leapDaysBeforeYear =
    Math.floor(yearsBefore / 4) -
    Math.floor(yearsBefore / 100) +
    Math.floor(yearsBefore / 400);
  const leapDay = parts.month > 2 && isLeapYear(parts.year) ? 1 : 0;

  return (
    365 * yearsBefore +
    leapDaysBeforeYear +
    DAYS_BEFORE_MONTH[parts.month - 1] +
    leapDay +
    parts.day
  );
}

export function compareDateOnly(left: DateOnly, right: DateOnly) {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function differenceInDateOnlyDays(from: DateOnly, to: DateOnly) {
  return dateOnlyToOrdinal(to) - dateOnlyToOrdinal(from);
}

export function validateDateOnlyRange(
  startDate: unknown,
  endDate: unknown,
  maxDifferenceDays: number
) {
  if (!isDateOnly(startDate) || !isDateOnly(endDate)) {
    throw new Error("対象期間の日付が正しくありません。");
  }

  if (compareDateOnly(startDate, endDate) > 0) {
    throw new Error("対象期間の終了日は開始日より後にしてください。");
  }

  const rangeDays = differenceInDateOnlyDays(startDate, endDate);

  if (rangeDays > maxDifferenceDays) {
    throw new Error("対象期間は3か月以内で指定してください。");
  }

  return { startDate, endDate, rangeDays };
}

/**
 * Convert a calendar component supplied by a date picker to the domain value.
 * The Date is interpreted by its local calendar fields, never as an instant.
 */
export function dateToDateOnly(date: Date): DateOnly {
  if (Number.isNaN(date.getTime())) {
    throw new Error("日付が正しくありません。");
  }

  const year = date.getFullYear();

  if (year < 0 || year > 9999) {
    throw new Error("日付が正しくありません。");
  }

  const value = `${String(year).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

  if (!isDateOnly(value)) {
    throw new Error("日付が正しくありません。");
  }

  return value;
}

/**
 * Adapt a domain date-only value to the local Date shape required by the
 * calendar component. This is presentation-only and must not be persisted.
 */
export function dateOnlyToDate(value: DateOnly) {
  const parts = parseDateOnlyParts(value);

  if (!parts) {
    throw new Error("日付が正しくありません。");
  }

  // setFullYear handles years 0000-0099 without Date's 1900 offset. Noon
  // avoids rare local-midnight DST transitions while retaining the same local
  // calendar date for react-day-picker and date-fns formatting.
  const date = new Date(0);
  date.setHours(12, 0, 0, 0);
  date.setFullYear(parts.year, parts.month - 1, parts.day);
  return date;
}

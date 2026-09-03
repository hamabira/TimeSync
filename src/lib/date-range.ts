import { addDays, addMonths, differenceInCalendarDays, subDays } from "date-fns";
import type { DateRange } from "react-day-picker";

export type DateRangePreset = "today" | "week" | "twoWeeks" | "month";

function normalizeRangeDate(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getTodayDate() {
  return normalizeRangeDate(new Date());
}

export function getPresetDateRange(
  preset: DateRangePreset,
  today: Date = getTodayDate()
): DateRange {
  const start = normalizeRangeDate(today);

  switch (preset) {
    case "today":
      return { from: start, to: start };
    case "week":
      return { from: start, to: addDays(start, 6) };
    case "twoWeeks":
      return { from: start, to: addDays(start, 13) };
    case "month":
      return { from: start, to: subDays(addMonths(start, 1), 1) };
  }
}

export function getMaxEndDate(startDate: Date) {
  return addMonths(normalizeRangeDate(startDate), 3);
}

export function getDateRangeDays(range: DateRange | undefined) {
  if (!range?.from || !range.to) {
    return null;
  }

  const difference = differenceInCalendarDays(range.to, range.from);
  return difference >= 0 ? difference + 1 : null;
}

export function cloneDateRange(range: DateRange | undefined): DateRange | undefined {
  if (!range) {
    return undefined;
  }

  return {
    from: range.from ? normalizeRangeDate(range.from) : undefined,
    to: range.to ? normalizeRangeDate(range.to) : undefined,
  };
}

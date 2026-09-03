import type { DateOnly } from "./date-only.ts";

export const SCHEDULE_START_HOUR = 0;
export const SCHEDULE_END_HOUR = 24;

export {
  MAX_EVENT_PARTICIPANTS,
  MAX_EVENT_SLOTS,
  MAX_RESPONSE_SLOTS,
} from "./limits.ts";

export const SCHEDULE_HOURS = Array.from(
  { length: SCHEDULE_END_HOUR - SCHEDULE_START_HOUR },
  (_, index) => SCHEDULE_START_HOUR + index
);

export const SCHEDULE_AXIS_HOURS = Array.from(
  { length: SCHEDULE_END_HOUR - SCHEDULE_START_HOUR + 1 },
  (_, index) => SCHEDULE_START_HOUR + index
);

export type TimeSlotRecord = {
  date: DateOnly;
  startTime: string;
  endTime: string;
};

export type ParticipantRecord = {
  id: string;
  name: string;
  timeSlots: TimeSlotRecord[];
};

export type EventRecord = {
  id: string;
  name: string;
  description: string | null;
  startDate: DateOnly;
  endDate: DateOnly;
  createdAt: Date;
};

export type EventWithParticipants = {
  event: EventRecord;
  participants: ParticipantRecord[];
};

export type TimeBandCell = {
  hour: number;
  attendeeNames: string[];
  count: number;
};

export type TimeBandSegment = {
  date: DateOnly;
  startHour: number;
  endHour: number;
  attendeeNames: string[];
  count: number;
};

export type TimeBandRow = {
  date: DateOnly;
  cells: TimeBandCell[];
  segments: TimeBandSegment[];
  bestSegment: TimeBandSegment | null;
};

function haveSameAttendees(left: string[], right: string[]) {
  return left.length === right.length && left.every((name, index) => name === right[index]);
}

export function normalizeParticipantName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

export function isValidTimeString(value: string) {
  return /^\d{2}:\d{2}$/.test(value);
}

export function timeStringToMinutes(value: string) {
  if (!isValidTimeString(value)) {
    return null;
  }

  const [hourPart, minutePart] = value.split(":");
  const hour = Number(hourPart);
  const minute = Number(minutePart);

  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    return null;
  }

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  return hour * 60 + minute;
}

export function parseTimeRange(startTime: string, endTime: string) {
  const startMinutes = timeStringToMinutes(startTime);
  const parsedEndMinutes = timeStringToMinutes(endTime);

  if (startMinutes === null || parsedEndMinutes === null) {
    return null;
  }

  // 日付をまたぐ回答は扱わないため、開始後の 00:00 は同日末の 24:00 と解釈する。
  const endMinutes = parsedEndMinutes === 0 && startMinutes > 0 ? 24 * 60 : parsedEndMinutes;

  if (startMinutes >= endMinutes) {
    return null;
  }

  return { startMinutes, endMinutes };
}

export function formatHourRange(startHour: number, endHour: number) {
  return `${String(startHour).padStart(2, "0")}:00 - ${String(endHour).padStart(2, "0")}:00`;
}

export function formatShortHour(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

export function getTimeBandKey(date: DateOnly, startHour: number) {
  return `${date}-${startHour}`;
}

export function formatBandSummary(segment: TimeBandSegment) {
  return `${formatShortHour(segment.startHour)} - ${formatShortHour(segment.endHour)} / ${segment.count}人参加可能`;
}

export function formatParticipantLine(attendeeNames: string[]) {
  if (attendeeNames.length === 0) {
    return "参加者: なし";
  }

  return `参加者: ${attendeeNames.join("、")}`;
}

export function getHeatmapCellClass(count: number, participantCount: number) {
  if (count === 0) {
    return "bg-slate-100 text-slate-400";
  }

  if (participantCount > 0 && count === participantCount) {
    return "bg-blue-600 text-white";
  }

  if (count >= 3) {
    return "bg-blue-500 text-white";
  }

  if (count === 2) {
    return "bg-sky-300 text-sky-950";
  }

  return "bg-sky-100 text-sky-900";
}

function compareSegments(left: TimeBandSegment, right: TimeBandSegment) {
  if (right.count !== left.count) {
    return right.count - left.count;
  }

  const leftDuration = left.endHour - left.startHour;
  const rightDuration = right.endHour - right.startHour;

  if (rightDuration !== leftDuration) {
    return rightDuration - leftDuration;
  }

  if (left.date !== right.date) {
    return left.date < right.date ? -1 : 1;
  }

  return left.startHour - right.startHour;
}

function buildRowSegments(date: DateOnly, cells: TimeBandCell[]): TimeBandSegment[] {
  const segments: TimeBandSegment[] = [];
  let current: TimeBandSegment | null = null;

  cells.forEach((cell) => {
    if (cell.count === 0) {
      if (current) {
        segments.push(current);
        current = null;
      }
      return;
    }

    if (
      current &&
      haveSameAttendees(current.attendeeNames, cell.attendeeNames) &&
      current.endHour === cell.hour
    ) {
      current = { ...current, endHour: cell.hour + 1 };
      return;
    }

    if (current) {
      segments.push(current);
    }

    current = {
      date,
      startHour: cell.hour,
      endHour: cell.hour + 1,
      attendeeNames: cell.attendeeNames,
      count: cell.count,
    };
  });

  if (current) {
    segments.push(current);
  }

  return segments;
}

export function buildTimeBandRows(participants: ParticipantRecord[]): TimeBandRow[] {
  const dateSet = new Set<DateOnly>();

  participants.forEach((participant) => {
    participant.timeSlots.forEach((slot) => {
      dateSet.add(slot.date);
    });
  });

  return [...dateSet]
    .sort()
    .map((date) => {
      const cells = SCHEDULE_HOURS.map((hour) => {
        const attendeeNames = participants
          .filter((participant) =>
            participant.timeSlots.some((slot) => {
              if (slot.date !== date) {
                return false;
              }

              const range = parseTimeRange(slot.startTime, slot.endTime);

              if (!range) {
                return false;
              }

              // その1時間にフルで参加できる場合だけカウントする(1時間単位集計)
              return (
                hour * 60 >= range.startMinutes && (hour + 1) * 60 <= range.endMinutes
              );
            })
          )
          .map((participant) => participant.name)
          .sort((left, right) => left.localeCompare(right, "ja"));

        return {
          hour,
          attendeeNames,
          count: attendeeNames.length,
        };
      });

      const segments = buildRowSegments(date, cells);
      const bestSegment = segments.length > 0 ? [...segments].sort(compareSegments)[0] : null;

      return {
        date,
        cells,
        segments,
        bestSegment,
      };
    });
}

export function buildTopSegments(rows: TimeBandRow[]) {
  return rows.flatMap((row) => row.segments).sort(compareSegments);
}

export function getBandSegmentAtHour(row: TimeBandRow, hour: number) {
  return (
    row.segments.find((segment) => segment.startHour <= hour && hour < segment.endHour) ?? null
  );
}

export function isCellWithinBand(row: TimeBandRow, hour: number, segment: TimeBandSegment | null) {
  if (!segment || row.date !== segment.date) {
    return false;
  }

  const cell = row.cells.find((entry) => entry.hour === hour);
  if (!cell || cell.count === 0) {
    return false;
  }

  return (
    hour >= segment.startHour &&
    hour < segment.endHour &&
    cell.count === segment.count &&
    haveSameAttendees(cell.attendeeNames, segment.attendeeNames)
  );
}

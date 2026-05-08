export const SCHEDULE_START_HOUR = 0;
export const SCHEDULE_END_HOUR = 24;

export const SCHEDULE_HOURS = Array.from(
  { length: SCHEDULE_END_HOUR - SCHEDULE_START_HOUR },
  (_, index) => SCHEDULE_START_HOUR + index
);

export const SCHEDULE_AXIS_HOURS = Array.from(
  { length: SCHEDULE_END_HOUR - SCHEDULE_START_HOUR + 1 },
  (_, index) => SCHEDULE_START_HOUR + index
);

export type TimeSlotRecord = {
  date: Date;
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
  startDate: Date;
  endDate: Date;
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
  date: Date;
  startHour: number;
  endHour: number;
  attendeeNames: string[];
  count: number;
};

export type TimeBandRow = {
  date: Date;
  cells: TimeBandCell[];
  bestSegment: TimeBandSegment | null;
};

function getAttendeeKey(attendeeNames: string[]) {
  return attendeeNames.join("、");
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

export function formatHourRange(startHour: number, endHour: number) {
  return `${String(startHour).padStart(2, "0")}:00 - ${String(endHour).padStart(2, "0")}:00`;
}

export function formatShortHour(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

export function normalizeDateOnly(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function compareDateOnly(left: Date, right: Date) {
  const leftKey = normalizeDateOnly(left).getTime();
  const rightKey = normalizeDateOnly(right).getTime();

  if (leftKey < rightKey) return -1;
  if (leftKey > rightKey) return 1;
  return 0;
}

const tokyoDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function getTokyoDateKey(date: Date) {
  const parts = tokyoDateFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("日付キーの生成に失敗しました。");
  }

  return `${year}-${month}-${day}`;
}

export function getTimeBandKey(date: Date, startHour: number) {
  return `${date.getTime()}-${startHour}`;
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

export function buildTimeBandRows(participants: ParticipantRecord[]): TimeBandRow[] {
  const dateMap = new Map<number, Date>();

  participants.forEach((participant) => {
    participant.timeSlots.forEach((slot) => {
      dateMap.set(slot.date.getTime(), slot.date);
    });
  });

  return [...dateMap.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, date]) => {
      const cells = SCHEDULE_HOURS.map((hour) => {
        const attendeeNames = participants
          .filter((participant) =>
            participant.timeSlots.some((slot) => {
              if (slot.date.getTime() !== date.getTime()) {
                return false;
              }

              const startMinutes = timeStringToMinutes(slot.startTime);
              const endMinutes = timeStringToMinutes(slot.endTime);

              if (startMinutes === null || endMinutes === null) {
                return false;
              }

              return hour * 60 >= startMinutes && hour * 60 < endMinutes;
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

      const bestSegment = cells.reduce<TimeBandSegment | null>((best, cell) => {
        if (cell.count === 0) {
          return best;
        }

        if (!best) {
          return {
            date,
            startHour: cell.hour,
            endHour: cell.hour + 1,
            attendeeNames: cell.attendeeNames,
            count: cell.count,
          };
        }

        const sameGroup = getAttendeeKey(best.attendeeNames) === getAttendeeKey(cell.attendeeNames) && best.endHour === cell.hour;

        const candidate = sameGroup
          ? {
              ...best,
              endHour: cell.hour + 1,
            }
          : {
              date,
              startHour: cell.hour,
              endHour: cell.hour + 1,
              attendeeNames: cell.attendeeNames,
              count: cell.count,
            };

        const bestDuration = best.endHour - best.startHour;
        const candidateDuration = candidate.endHour - candidate.startHour;

        if (candidate.count > best.count) {
          return candidate;
        }

        if (candidate.count === best.count && candidateDuration > bestDuration) {
          return candidate;
        }

        if (
          candidate.count === best.count &&
          candidateDuration === bestDuration &&
          candidate.startHour < best.startHour
        ) {
          return candidate;
        }

        return best;
      }, null);

      return {
        date,
        cells,
        bestSegment,
      };
    });
}

export function buildTopSegments(rows: TimeBandRow[]) {
  const segments: TimeBandSegment[] = [];

  rows.forEach((row) => {
    let current: TimeBandSegment | null = null;

    row.cells.forEach((cell) => {
      if (cell.count === 0) {
        if (current) {
          segments.push(current);
          current = null;
        }
        return;
      }

      if (
        current &&
        getAttendeeKey(current.attendeeNames) === getAttendeeKey(cell.attendeeNames) &&
        current.endHour === cell.hour
      ) {
        current = {
          ...current,
          endHour: cell.hour + 1,
        };
        return;
      }

      if (current) {
        segments.push(current);
      }

      current = {
        date: row.date,
        startHour: cell.hour,
        endHour: cell.hour + 1,
        attendeeNames: cell.attendeeNames,
        count: cell.count,
      };
    });

    if (current) {
      segments.push(current);
    }
  });

  return segments.sort((left, right) => {
    if (right.count !== left.count) {
      return right.count - left.count;
    }

    const leftDuration = left.endHour - left.startHour;
    const rightDuration = right.endHour - right.startHour;

    if (rightDuration !== leftDuration) {
      return rightDuration - leftDuration;
    }

    if (left.date.getTime() !== right.date.getTime()) {
      return left.date.getTime() - right.date.getTime();
    }

    return left.startHour - right.startHour;
  });
}

export function getBandSegmentAtHour(row: TimeBandRow, hour: number) {
  const cell = row.cells.find((entry) => entry.hour === hour);

  if (!cell || cell.count === 0) {
    return null;
  }

  const segmentCells = row.cells.filter(
    (entry) => entry.count > 0 && getAttendeeKey(entry.attendeeNames) === getAttendeeKey(cell.attendeeNames)
  );

  const startCell = segmentCells.find((entry) => entry.hour <= hour && hour < entry.hour + 1);
  if (!startCell) {
    return null;
  }

  let startHour = startCell.hour;
  let endHour = startCell.hour + 1;

  for (let index = row.cells.findIndex((entry) => entry.hour === startHour) - 1; index >= 0; index--) {
    const previous = row.cells[index];

    if (
      previous.count > 0 &&
      getAttendeeKey(previous.attendeeNames) === getAttendeeKey(cell.attendeeNames) &&
      previous.hour + 1 === startHour
    ) {
      startHour = previous.hour;
    } else {
      break;
    }
  }

  for (let index = row.cells.findIndex((entry) => entry.hour === endHour); index < row.cells.length; index++) {
    const next = row.cells[index];

    if (
      next.count > 0 &&
      getAttendeeKey(next.attendeeNames) === getAttendeeKey(cell.attendeeNames) &&
      next.hour === endHour
    ) {
      endHour = next.hour + 1;
    } else {
      break;
    }
  }

  return {
    date: row.date,
    startHour,
    endHour,
    attendeeNames: cell.attendeeNames,
    count: cell.count,
  };
}

export function isCellWithinBand(row: TimeBandRow, hour: number, segment: TimeBandSegment | null) {
  if (!segment || row.date.getTime() !== segment.date.getTime()) {
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
    getAttendeeKey(cell.attendeeNames) === getAttendeeKey(segment.attendeeNames)
  );
}

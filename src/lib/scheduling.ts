export const SCHEDULE_START_HOUR = 6;
export const SCHEDULE_END_HOUR = 23;

export const SCHEDULE_HOURS = Array.from(
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

        const sameGroup =
          best.attendeeNames.join("、") === cell.attendeeNames.join("、") &&
          best.endHour === cell.hour;

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
        current.attendeeNames.join("、") === cell.attendeeNames.join("、") &&
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

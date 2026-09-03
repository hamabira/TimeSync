"use client";

import {
  eachDayOfInterval,
  eachMonthOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ja } from "date-fns/locale";

import { dateOnlyToDate, dateToDateOnly, type DateOnly } from "@/lib/date-only";
import {
  formatHourRange,
  getHeatmapCellClass,
  type TimeBandRow,
  type TimeBandSegment,
} from "@/lib/scheduling";
import { cn } from "@/lib/utils";

type CalendarAvailabilityHeatmapProps = {
  startDate: DateOnly;
  endDate: DateOnly;
  rows: TimeBandRow[];
  participantCount: number;
  selectedBand: TimeBandSegment | null;
  onSelectBand: (band: TimeBandSegment | null) => void;
};

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export function CalendarAvailabilityHeatmap({
  startDate,
  endDate,
  rows,
  participantCount,
  selectedBand,
  onSelectBand,
}: CalendarAvailabilityHeatmapProps) {
  const rowByDate = new Map(rows.map((row) => [row.date, row]));
  const months = eachMonthOfInterval({
    start: dateOnlyToDate(startDate),
    end: dateOnlyToDate(endDate),
  });

  return (
    <div className="space-y-4" data-testid="calendar-availability-heatmap">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-slate-800">カレンダー表示</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            数字は各日の最大参加人数です。日付を押すと、その日の最良の帯を確認できます。
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-500" aria-label="濃さの凡例">
          <span>少ない</span>
          {[1, 2, 3].map((count) => (
            <span
              key={count}
              className={cn(
                "h-4 w-4 rounded border border-white shadow-sm",
                getHeatmapCellClass(count, Math.max(participantCount, 4))
              )}
            />
          ))}
          <span>多い</span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {months.map((month) => {
          const calendarDays = eachDayOfInterval({
            start: startOfWeek(startOfMonth(month), { weekStartsOn: 0 }),
            end: endOfWeek(endOfMonth(month), { weekStartsOn: 0 }),
          });

          return (
            <section
              key={format(month, "yyyy-MM")}
              className="rounded-xl border-2 border-slate-200 bg-white p-3"
            >
              <h4 className="mb-3 text-center text-sm font-bold text-slate-700">
                {format(month, "yyyy年M月", { locale: ja })}
              </h4>
              <div className="grid grid-cols-7 gap-1">
                {WEEKDAYS.map((weekday, index) => (
                  <div
                    key={weekday}
                    className={cn(
                      "pb-1 text-center text-[11px] font-medium text-slate-400",
                      index === 0 && "text-rose-400",
                      index === 6 && "text-blue-400"
                    )}
                  >
                    {weekday}
                  </div>
                ))}

                {calendarDays.map((date) => {
                  const dateKey = dateToDateOnly(date);
                  const isInMonth = isSameMonth(date, month);
                  const isInEvent = dateKey >= startDate && dateKey <= endDate;
                  const row = rowByDate.get(dateKey);
                  const bestSegment = row?.bestSegment ?? null;
                  const count = bestSegment?.count ?? 0;
                  const isSelected = selectedBand?.date === dateKey;

                  if (!isInMonth) {
                    return <div key={dateKey} aria-hidden="true" className="aspect-square" />;
                  }

                  return (
                    <button
                      key={dateKey}
                      type="button"
                      disabled={!isInEvent || !bestSegment}
                      onClick={() => onSelectBand(bestSegment)}
                      aria-label={
                        isInEvent
                          ? bestSegment
                            ? `${format(date, "M月d日 (E)", { locale: ja })}: 最大${count}人、${formatHourRange(bestSegment.startHour, bestSegment.endHour)}`
                            : `${format(date, "M月d日 (E)", { locale: ja })}: 回答なし`
                          : `${format(date, "M月d日 (E)", { locale: ja })}: 対象期間外`
                      }
                      className={cn(
                        "flex aspect-square min-h-10 flex-col items-center justify-center rounded-lg border-2 border-transparent text-xs transition-all",
                        isInEvent
                          ? getHeatmapCellClass(count, participantCount)
                          : "bg-slate-50 text-slate-300",
                        bestSegment && "hover:border-blue-300 hover:shadow-sm",
                        isSelected && "border-blue-600 ring-2 ring-blue-500/30",
                        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/40",
                        "disabled:cursor-default disabled:opacity-100"
                      )}
                    >
                      <span className="leading-none">{format(date, "d")}</span>
                      {isInEvent ? (
                        <span className="mt-1 text-[10px] font-bold leading-none">
                          {count > 0 ? `${count}人` : "—"}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

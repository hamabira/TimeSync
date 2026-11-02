"use client";

import { useState, useSyncExternalStore, type ComponentProps } from "react";
import { addYears, endOfYear, format, isAfter, isBefore, isSameDay, startOfMonth, startOfYear } from "date-fns";
import { ja } from "date-fns/locale";
import { DayButton, Root, type DateRange } from "react-day-picker";
import { Calendar as CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  cloneDateRange,
  getMaxEndDate,
  getPresetDateRange,
  getTodayDate,
  normalizeCalendarDate,
  type DateRangePreset,
} from "@/lib/date-range";
import { cn } from "@/lib/utils";

type DateRangePickerProps = {
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
};

const presets: { preset: Exclude<DateRangePreset, "today">; label: string }[] = [
  { preset: "week", label: "1週間" },
  { preset: "twoWeeks", label: "2週間" },
  { preset: "month", label: "1か月" },
];

const wideQuery = "(min-width: 768px)";

function subscribeWide(onChange: () => void) {
  const query = window.matchMedia(wideQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function useIsWide() {
  return useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(wideQuery).matches,
    () => false
  );
}

function formatField(date: Date | undefined, includeYear = false) {
  return date ? format(date, includeYear ? "yyyy/M/d(E)" : "M/d(E)", { locale: ja }) : "未選択";
}

// Keep the day component identity stable while the hover preview changes.
function DateRangeDayButton({ className, modifiers, ...props }: ComponentProps<typeof DayButton>) {
  return (
    <DayButton
      {...props}
      modifiers={modifiers}
      data-range-start={modifiers.range_start}
      data-range-middle={modifiers.range_middle}
      data-range-end={modifiers.range_end}
      data-selected-single={modifiers.selected && !modifiers.range_start && !modifiers.range_end && !modifiers.range_middle}
      className={cn(
        "relative z-10 flex h-(--cell-size) w-full min-w-(--cell-size) items-center justify-center rounded-lg text-sm outline-none hover:bg-blue-50 focus-visible:ring-3 focus-visible:ring-blue-600/40 disabled:pointer-events-none disabled:opacity-50 data-[range-start=true]:bg-blue-600 data-[range-start=true]:text-white data-[range-end=true]:bg-blue-600 data-[range-end=true]:text-white data-[range-middle=true]:rounded-none data-[range-middle=true]:bg-blue-100 data-[selected-single=true]:bg-blue-600 data-[selected-single=true]:text-white",
        className
      )}
    />
  );
}

function FieldPart({ label, date, active }: { label: string; date: Date | undefined; active: boolean }) {
  return (
    <span
      className={cn(
        "flex min-w-0 flex-1 flex-col justify-center rounded-md px-2 py-1",
        active && "bg-blue-50"
      )}
    >
      <span className={cn("text-xs font-medium", active ? "text-blue-700" : "text-slate-500")}>
        {label}{date ? ` ${format(date, "yyyy年")}` : ""}
      </span>
      <span
        className={cn(
          "truncate text-[15px] font-semibold tabular-nums",
          date ? "text-slate-900" : "font-normal text-slate-400"
        )}
      >
        {formatField(date)}
      </span>
    </span>
  );
}

/**
 * The form receives complete ranges only; an unfinished selection stays local.
 * The first tap sets the start, the second sets the end, commits and closes.
 * Dismissing before the second tap leaves the form value untouched.
 */
export function DateRangePicker({
  value,
  onChange,
}: DateRangePickerProps) {
  const [today] = useState(getTodayDate);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>(() => cloneDateRange(value));
  const [month, setMonth] = useState(() => startOfMonth(value?.from ?? today));
  const [hovered, setHovered] = useState<Date | undefined>();
  const isWide = useIsWide();

  const shown = open ? draft : value;
  const from = draft?.from;
  const awaitingEnd = Boolean(from && !draft?.to);
  const maxEnd = from ? getMaxEndDate(from) : undefined;

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setDraft(cloneDateRange(value));
      setMonth(startOfMonth(value?.from ?? today));
    }
    setHovered(undefined);
    setOpen(nextOpen);
  };

  const commit = (range: DateRange) => {
    setDraft(range);
    onChange(range);
    setOpen(false);
  };

  const handleDay = (date: Date) => {
    const day = normalizeCalendarDate(date);
    setHovered(undefined);

    if (awaitingEnd && from && !isBefore(day, from)) {
      if (maxEnd && isAfter(day, maxEnd)) {
        return;
      }
      commit({ from, to: day });
      return;
    }

    setDraft({ from: day, to: undefined });
  };

  const preview =
    awaitingEnd && from && hovered && isAfter(hovered, from) && maxEnd && !isAfter(hovered, maxEnd)
      ? { from, to: hovered }
      : undefined;

  return (
    <div className="h-14 w-full min-w-0">
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger
          id="event-date-range"
          aria-label={`対象期間を選択。開始日${formatField(shown?.from, true)}、終了日${formatField(shown?.to, true)}`}
          className={cn(
            "flex h-14 w-full max-w-md min-w-0 items-center gap-1 rounded-lg border bg-white px-2 text-left shadow-xs transition-colors hover:border-slate-400 focus-visible:border-blue-600 focus-visible:ring-3 focus-visible:ring-blue-600/25 focus-visible:outline-none",
            open ? "border-blue-600 ring-3 ring-blue-600/25" : "border-slate-300"
          )}
        >
          <CalendarIcon aria-hidden="true" className="mx-1 size-5 shrink-0 text-slate-500" />
          <FieldPart label="開始日" date={shown?.from} active={open && !awaitingEnd} />
          <span aria-hidden="true" className="shrink-0 text-slate-400">
            –
          </span>
          <FieldPart label="終了日" date={shown?.to} active={open && awaitingEnd} />
        </PopoverTrigger>

        <PopoverContent aria-label="対象期間を選択" align="start" className="w-auto max-w-[calc(100vw-1rem)] gap-0 p-3">
          <p role="status" className="sr-only">
            {awaitingEnd
              ? `開始日 ${formatField(from, true)}。終了日を選ぶと期間が確定します。`
              : "開始日を選択してください。"}
          </p>
          <div onMouseLeave={() => setHovered(undefined)}>
            <Calendar
              mode="range"
              selected={draft}
              onSelect={(_next, triggerDate) => handleDay(triggerDate)}
              month={month}
              onMonthChange={setMonth}
              numberOfMonths={isWide ? 2 : 1}
              startMonth={startOfYear(today)}
              endMonth={endOfYear(addYears(today, 5))}
              today={today}
              disabled={awaitingEnd && maxEnd ? { after: maxEnd } : undefined}
              onDayMouseEnter={setHovered}
              modifiers={preview ? { preview } : undefined}
              modifiersClassNames={{ preview: "date-range-preview" }}
              locale={ja}
              showOutsideDays={false}
              fixedWeeks
              autoFocus
              formatters={{ formatCaption: (date) => format(date, "yyyy年M月") }}
              labels={{
                labelPrevious: () => "前の月",
                labelNext: () => "次の月",
                labelDayButton: (date, modifiers) =>
                  [
                    format(date, "yyyy年M月d日(E)", { locale: ja }),
                    from && isSameDay(date, from) ? "開始日" : null,
                    draft?.to && isSameDay(date, draft.to) ? "終了日" : null,
                    modifiers.today ? "今日" : null,
                    modifiers.disabled ? "3か月を超えるため選択不可" : null,
                  ]
                    .filter(Boolean)
                    .join("、"),
              }}
              className="date-range-calendar p-0 [--cell-size:min(2.75rem,calc((100vw-2.5rem)/7))]"
              components={{ Root, DayButton: DateRangeDayButton }}
              classNames={{
                caption_label: "text-base font-semibold select-none",
                today: "date-range-today",
              }}
            />
          </div>

          <div className="mt-3 flex items-center gap-2 border-t border-slate-200 pt-3">
            <span className="shrink-0 text-xs font-medium text-slate-500">今日から</span>
            {presets.map(({ preset, label }) => (
              <Button
                key={preset}
                type="button"
                variant="outline"
                className="h-11 min-w-0 flex-1 md:max-w-24"
                onClick={() => commit(getPresetDateRange(preset, today))}
              >
                {label}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

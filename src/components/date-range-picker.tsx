"use client";

import { useCallback, useState } from "react";
import {
  addYears,
  endOfYear,
  format,
  isBefore,
  isSameDay,
  startOfMonth,
  startOfYear,
} from "date-fns";
import { ja } from "date-fns/locale";
import { type DateRange, type Labels } from "react-day-picker";
import { Calendar as CalendarIcon } from "lucide-react";

import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  cloneDateRange,
  getDateRangeDays,
  getMaxEndDate,
  getPresetDateRange,
  getTodayDate,
  normalizeCalendarDate,
  type DateRangePreset,
} from "@/lib/date-range";
import { cn } from "@/lib/utils";

type SelectionField = "start" | "end";

type DateRangePickerProps = {
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
};

type DateRangeEditorProps = {
  draftRange: DateRange | undefined;
  activeField: SelectionField;
  canCommit: boolean;
  className?: string;
  calendar: React.ReactNode;
  onSelectField: (field: SelectionField) => void;
  onPreset: (preset: DateRangePreset) => void;
  onToday: () => void;
  onClear: () => void;
  onCommit: () => void;
};

function formatDateValue(date: Date | undefined) {
  return date ? format(date, "yyyy/MM/dd") : "未選択";
}

function getActiveFieldLabel(activeField: SelectionField) {
  return activeField === "start" ? "開始日" : "終了日";
}

function DateFieldButton({
  field,
  date,
  activeField,
  onSelect,
}: {
  field: SelectionField;
  date: Date | undefined;
  activeField: SelectionField;
  onSelect: () => void;
}) {
  const label = getActiveFieldLabel(field);
  const isActive = activeField === field;

  return (
    <Button
      type="button"
      variant="ghost"
      aria-pressed={isActive}
      aria-label={`${label}を選択${date ? `。現在${formatDateValue(date)}` : ""}`}
      onClick={onSelect}
      className={cn(
        "h-auto min-h-14 min-w-0 flex-1 flex-col items-start justify-center rounded-lg border-2 px-3 py-2 text-left transition-colors focus-visible:outline-none",
        isActive
          ? "border-blue-600 bg-blue-50 text-blue-950 ring-2 ring-blue-600/20"
          : "border-slate-200 bg-white text-slate-800 hover:border-blue-300 hover:bg-blue-50/50"
      )}
    >
      <span className="flex w-full items-center justify-between gap-2 text-xs font-semibold text-slate-500">
        <span>{label}</span>
        {isActive ? (
          <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[0.7rem] font-bold text-white">
            選択中
          </span>
        ) : null}
      </span>
      <span className="mt-1 whitespace-nowrap text-sm font-bold tracking-tight">
        {formatDateValue(date)}
      </span>
    </Button>
  );
}

function DateRangeEditor({
  draftRange,
  activeField,
  canCommit,
  className,
  calendar,
  onSelectField,
  onPreset,
  onToday,
  onClear,
  onCommit,
}: DateRangeEditorProps) {
  const activeFieldLabel = getActiveFieldLabel(activeField);
  const rangeDays = getDateRangeDays(draftRange);

  return (
    <div className={cn("min-w-0 space-y-4", className)}>
      <div className="space-y-2">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-2">
          <DateFieldButton
            field="start"
            date={draftRange?.from}
            activeField={activeField}
            onSelect={() => onSelectField("start")}
          />
          <span className="flex items-center justify-center text-sm font-semibold text-slate-400" aria-hidden="true">
            〜
          </span>
          <DateFieldButton
            field="end"
            date={draftRange?.to}
            activeField={activeField}
            onSelect={() => onSelectField("end")}
          />
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
          <p aria-live="polite" className="font-semibold text-blue-800">
            {activeFieldLabel}を選択中
          </p>
          <p className="font-semibold text-slate-700">
            <span className="text-slate-500">全日数:</span>{" "}
            {rangeDays === null ? "—" : `${rangeDays}日間`}
          </p>
        </div>
        <p className="text-xs leading-5 text-slate-500">
          {activeField === "start"
            ? "カレンダーから開始日を選びます。"
            : "カレンダーから終了日を選びます。開始日の3か月後まで指定できます。"}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2" role="group" aria-label="期間のプリセット">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11 w-full px-2"
          onClick={() => onPreset("week")}
        >
          <span className="leading-tight">今日から<br />1週間</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11 w-full px-2"
          onClick={() => onPreset("twoWeeks")}
        >
          <span className="leading-tight">今日から<br />2週間</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11 w-full px-2"
          onClick={() => onPreset("month")}
        >
          <span className="leading-tight">今日から<br />1か月</span>
        </Button>
      </div>

      <div className="w-full min-w-0">{calendar}</div>

      <div className="grid grid-cols-2 gap-2 border-t border-slate-200 pt-3 sm:grid-cols-[auto_auto_1fr]">
        <Button type="button" variant="outline" className="min-h-11" onClick={onToday}>
          今日
        </Button>
        <Button type="button" variant="ghost" className="min-h-11 text-slate-600 hover:text-slate-900" onClick={onClear}>
          クリア
        </Button>
        <Button
          type="button"
          disabled={!canCommit}
          className="col-span-2 min-h-11 bg-blue-600 font-bold text-white hover:bg-blue-700 sm:col-span-1"
          onClick={onCommit}
        >
          この期間に決定
        </Button>
      </div>
    </div>
  );
}

function TriggerSummary({ value }: { value: DateRange | undefined }) {
  const rangeDays = getDateRangeDays(value);

  return (
    <span className="min-w-0 flex-1 text-left">
      <span className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-baseline gap-x-2 text-sm font-semibold">
        <span className="text-xs font-medium text-slate-500">開始</span>
        <span className="whitespace-nowrap">{formatDateValue(value?.from)}</span>
        <span className="text-xs font-medium text-slate-500">終了</span>
        <span className="whitespace-nowrap">{formatDateValue(value?.to)}</span>
      </span>
      <span className="mt-0.5 block text-xs font-medium text-slate-500">
        全日数: {rangeDays === null ? "—" : `${rangeDays}日間`}
      </span>
    </span>
  );
}

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [today] = useState(getTodayDate);
  const [draftRange, setDraftRange] = useState<DateRange | undefined>(() =>
    cloneDateRange(value)
  );
  const [activeField, setActiveField] = useState<SelectionField>("start");
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const startMonth = startOfYear(today);
  const lastCalendarMonth = endOfYear(addYears(today, 5));
  const startDate = draftRange?.from;
  const maxEndDate = startDate ? getMaxEndDate(startDate) : getMaxEndDate(today);
  const endMonth =
    activeField === "end" && startDate && isBefore(maxEndDate, lastCalendarMonth)
      ? startOfMonth(maxEndDate)
      : lastCalendarMonth;

  const disabledDays =
    activeField === "end"
      ? startDate
        ? [{ before: startDate }, { after: maxEndDate }]
        : { after: maxEndDate }
      : undefined;

  const handleCalendarSelect = useCallback(
    (_selected: DateRange | undefined, triggerDate: Date) => {
      const selectedDate = normalizeCalendarDate(triggerDate);
      const currentStart = draftRange?.from;

      if (!isPopoverOpen) {
        onChange(undefined);
      }

      if (activeField === "start" || !currentStart) {
        const currentEnd = draftRange?.to;
        const nextMaxEndDate = getMaxEndDate(selectedDate);
        const nextEndDate =
          currentEnd &&
          !isBefore(currentEnd, selectedDate) &&
          !isBefore(nextMaxEndDate, currentEnd)
            ? normalizeCalendarDate(currentEnd)
            : undefined;

        setDraftRange({ from: selectedDate, to: nextEndDate });
        setActiveField("end");
        return;
      }

      if (isBefore(selectedDate, currentStart) || isBefore(maxEndDate, selectedDate)) {
        return;
      }

      setDraftRange({
        from: normalizeCalendarDate(currentStart),
        to: normalizeCalendarDate(selectedDate),
      });
      setActiveField("end");
    },
    [activeField, draftRange, isPopoverOpen, maxEndDate, onChange]
  );

  const dayLabel = useCallback<NonNullable<Labels["labelDayButton"]>>(
    (date, modifiers) => {
      const details = [format(date, "yyyy年M月d日(E)", { locale: ja })];

      if (modifiers.today) {
        details.push("今日");
      }
      if (modifiers.selected) {
        details.push("選択済み");
      }
      if (draftRange?.from && isSameDay(date, draftRange.from)) {
        details.push("開始日");
      }
      if (draftRange?.to && isSameDay(date, draftRange.to)) {
        details.push("終了日");
      }
      if (modifiers.disabled) {
        details.push("選択不可");
      }

      details.push(`${getActiveFieldLabel(activeField)}を選択中`);
      return details.join("、");
    },
    [activeField, draftRange]
  );

  const renderCalendar = (autoFocus: boolean) => (
    <CalendarComponent
      mode="range"
      selected={draftRange}
      onSelect={handleCalendarSelect}
      autoFocus={autoFocus}
      defaultMonth={draftRange?.from ?? today}
      startMonth={startMonth}
      endMonth={endMonth}
      disabled={disabledDays}
      today={today}
      locale={ja}
      showOutsideDays
      fixedWeeks
      captionLayout="label"
      navLayout="after"
      aria-label={`対象期間のカレンダー。${getActiveFieldLabel(activeField)}を選択中です。`}
      labels={{ labelDayButton: dayLabel }}
      className="mx-auto w-full max-w-sm p-0 [--cell-size:2.75rem] sm:p-2"
    />
  );

  const canCommit = Boolean(
    draftRange?.from &&
      draftRange.to &&
      !isBefore(draftRange.to, draftRange.from) &&
      !isBefore(getMaxEndDate(draftRange.from), draftRange.to)
  );

  const handlePreset = (preset: DateRangePreset) => {
    const nextRange = getPresetDateRange(preset, today);
    setDraftRange(nextRange);
    setActiveField("end");
    onChange(nextRange);
    setIsPopoverOpen(false);
  };

  const handleToday = () => {
    setDraftRange(getPresetDateRange("today", today));
    setActiveField("end");
    if (!isPopoverOpen) {
      onChange(undefined);
    }
  };

  const handleClear = () => {
    setDraftRange(undefined);
    setActiveField("start");
    onChange(undefined);
  };

  const handleCommit = () => {
    if (!draftRange?.from || !draftRange.to || !canCommit) {
      return;
    }

    const nextRange = {
      from: normalizeCalendarDate(draftRange.from),
      to: normalizeCalendarDate(draftRange.to),
    };

    setDraftRange(nextRange);
    setActiveField("end");
    onChange(nextRange);
    setIsPopoverOpen(false);
  };

  const handlePopoverOpenChange = (open: boolean) => {
    setIsPopoverOpen(open);
    if (open) {
      setDraftRange(cloneDateRange(value));
      setActiveField("start");
    }
  };

  return (
    <div className="w-[calc(100%+1.25rem)] min-w-0 -translate-x-2.5 md:w-full md:translate-x-0">
      <div className="md:hidden">
        <DateRangeEditor
          draftRange={draftRange}
          activeField={activeField}
          canCommit={canCommit}
          calendar={renderCalendar(false)}
          onSelectField={setActiveField}
          onPreset={handlePreset}
          onToday={handleToday}
          onClear={handleClear}
          onCommit={handleCommit}
        />
      </div>

      <div className="hidden md:block">
        <Popover open={isPopoverOpen} onOpenChange={handlePopoverOpenChange}>
          <PopoverTrigger
            id="event-date-range"
            aria-label={`対象期間を変更。開始日${formatDateValue(value?.from)}、終了日${formatDateValue(value?.to)}、全日数${getDateRangeDays(value) === null ? "未確定" : `${getDateRangeDays(value)}日間`}`}
            className="flex min-h-12 w-full max-w-xl min-w-0 items-center justify-start gap-3 rounded-lg border-2 border-input bg-background px-4 py-2 text-left text-base font-normal shadow-sm hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50"
          >
            <CalendarIcon className="h-5 w-5 shrink-0 text-slate-500" />
            <TriggerSummary value={value} />
          </PopoverTrigger>
          <PopoverContent
            className="w-[min(24rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] p-0 max-md:hidden"
            align="start"
          >
            <DateRangeEditor
              draftRange={draftRange}
              activeField={activeField}
              canCommit={canCommit}
              className="p-3 sm:p-4"
              calendar={renderCalendar(true)}
              onSelectField={setActiveField}
              onPreset={handlePreset}
              onToday={handleToday}
              onClear={handleClear}
              onCommit={handleCommit}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

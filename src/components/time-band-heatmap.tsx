"use client";

import { format } from "date-fns";
import { ja } from "date-fns/locale";

import {
  formatHourRange,
  formatShortHour,
  getHeatmapCellClass,
  getTimeBandKey,
  getBandSegmentAtHour,
  isCellWithinBand,
  SCHEDULE_AXIS_HOURS,
  SCHEDULE_END_HOUR,
  SCHEDULE_HOURS,
  SCHEDULE_START_HOUR,
  type TimeBandRow,
  type TimeBandSegment,
} from "@/lib/scheduling";
import { cn } from "@/lib/utils";

type TimeBandHeatmapProps = {
  rows: TimeBandRow[];
  participantCount: number;
  highlightedKey: string | null;
  selectedBand: TimeBandSegment | null;
  onSelectBand: (band: TimeBandSegment | null) => void;
};

const heatmapGridColumns = `180px repeat(${SCHEDULE_HOURS.length}, minmax(0, 1fr))`;
const axisLabelHours = SCHEDULE_AXIS_HOURS.filter(
  (hour) => (hour - SCHEDULE_START_HOUR) % 3 === 0
);
const mobileDateColumnWidth = 72;
const mobileTimeLabelWidth = 64;
const mobileCellHeight = 44;
const mobileCellGap = 4;
const mobileHeatmapHeight =
  SCHEDULE_HOURS.length * mobileCellHeight + (SCHEDULE_HOURS.length - 1) * mobileCellGap;

function getCellAtHour(row: TimeBandRow, hour: number) {
  return row.cells.find((cell) => cell.hour === hour);
}

function getMobileTimeLabelTop(hour: number) {
  if (hour === SCHEDULE_END_HOUR) {
    return mobileHeatmapHeight;
  }

  return (hour - SCHEDULE_START_HOUR) * (mobileCellHeight + mobileCellGap);
}

export function TimeBandHeatmap({
  rows,
  participantCount,
  highlightedKey,
  selectedBand,
  onSelectBand,
}: TimeBandHeatmapProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
        まだ回答がありません。最初の回答を入力すると、候補時間の帯が表示されます。
      </div>
    );
  }

  return (
    <>
      <div className="hidden overflow-x-auto sm:block">
        <div className="min-w-[920px] space-y-2">
          <div
            className="grid items-center gap-1 text-xs font-medium text-slate-500"
            style={{ gridTemplateColumns: heatmapGridColumns }}
          >
            <div className="sticky left-0 z-20 rounded-l-lg bg-slate-50 px-4 py-3 text-slate-600">
              日付
            </div>
            <div
              className="relative h-11"
              style={{ gridColumn: `span ${SCHEDULE_HOURS.length} / span ${SCHEDULE_HOURS.length}` }}
            >
              {axisLabelHours.map((hour) => {
                const position =
                  ((hour - SCHEDULE_START_HOUR) / (SCHEDULE_END_HOUR - SCHEDULE_START_HOUR)) *
                  100;

                return (
                  <div
                    key={hour}
                    className={cn(
                      "absolute top-1/2 flex -translate-y-1/2 items-center justify-center rounded py-3 text-slate-600",
                      hour === SCHEDULE_START_HOUR
                        ? "translate-x-0"
                        : hour === SCHEDULE_END_HOUR
                          ? "-translate-x-full"
                          : "-translate-x-1/2"
                    )}
                    style={{ left: `${position}%` }}
                  >
                    {formatShortHour(hour)}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            {rows.map((row) => {
              return (
                <div
                  key={row.date.getTime()}
                  id={`time-band-${row.date.getTime()}`}
                  className="grid gap-1"
                  style={{ gridTemplateColumns: heatmapGridColumns }}
                >
                  <div className="sticky left-0 z-10 flex flex-col justify-center rounded-l-xl border-2 border-slate-200 bg-white px-4 py-3 shadow-[1px_0_0_0_#cbd5e1]">
                    <div className="text-sm font-semibold text-slate-800">
                      {format(row.date, "M/d (E)", { locale: ja })}
                    </div>
                    {row.bestSegment ? (
                      <div className="mt-1 text-xs text-slate-500">
                        最高 {row.bestSegment.count} 人 /{" "}
                        {formatHourRange(row.bestSegment.startHour, row.bestSegment.endHour)}
                      </div>
                    ) : (
                      <div className="mt-1 text-xs text-slate-400">回答のある時間帯なし</div>
                    )}
                  </div>

                  {row.cells.map((cell) => {
                    const cellKey = getTimeBandKey(row.date, cell.hour);
                    const isHighlighted =
                      highlightedKey === cellKey ||
                      isCellWithinBand(row, cell.hour, selectedBand);

                    return (
                      <button
                        key={cell.hour}
                        type="button"
                        onClick={() => onSelectBand(getBandSegmentAtHour(row, cell.hour))}
                        className={cn(
                          "group relative h-12 rounded-md border-2 border-transparent transition-all",
                          "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/40 focus-visible:ring-offset-1",
                          getHeatmapCellClass(cell.count, participantCount),
                          isHighlighted && "ring-2 ring-blue-500 ring-offset-1"
                        )}
                        title={
                          cell.count > 0
                            ? `${formatHourRange(cell.hour, cell.hour + 1)}: ${cell.attendeeNames.join("、")}`
                            : `${formatHourRange(cell.hour, cell.hour + 1)}: 回答なし`
                        }
                      >
                        <span className="sr-only">
                          {formatHourRange(cell.hour, cell.hour + 1)}{" "}
                          {cell.count > 0 ? `${cell.count}人参加可能` : "回答なし"}
                        </span>
                        {cell.count > 0 ? (
                          <span className="flex h-full items-center justify-center text-xs font-semibold">
                            {cell.count}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto pb-1 sm:hidden">
        <div className="flex min-w-max">
          <div
            className="sticky left-0 z-30 shrink-0 bg-white pr-2"
            style={{ width: mobileTimeLabelWidth }}
          >
            <div className="flex h-16 items-center rounded-tl-lg bg-slate-50 px-2 text-xs font-medium text-slate-600">
              時間
            </div>
            <div className="relative mt-2" style={{ height: mobileHeatmapHeight }}>
              {SCHEDULE_AXIS_HOURS.map((hour) => (
                <div
                  key={hour}
                  className={cn(
                    "absolute right-2 text-[11px] font-medium leading-none text-slate-500",
                    hour === SCHEDULE_START_HOUR
                      ? "translate-y-0"
                      : hour === SCHEDULE_END_HOUR
                        ? "-translate-y-full"
                        : "-translate-y-1/2"
                  )}
                  style={{ top: getMobileTimeLabelTop(hour) }}
                >
                  {formatShortHour(hour)}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div
              className="grid gap-x-1"
              style={{
                gridTemplateColumns: `repeat(${rows.length}, ${mobileDateColumnWidth}px)`,
              }}
            >
              {rows.map((row) => (
                <div
                  key={row.date.getTime()}
                  className="flex h-16 flex-col justify-center rounded-t-lg border-2 border-slate-200 bg-white px-2 text-center"
                >
                  <div className="text-xs font-semibold text-slate-800">
                    {format(row.date, "M/d", { locale: ja })}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {format(row.date, "E", { locale: ja })}
                  </div>
                </div>
              ))}
            </div>

            <div
              className="mt-2 grid gap-x-1"
              style={{
                gridTemplateColumns: `repeat(${rows.length}, ${mobileDateColumnWidth}px)`,
              }}
            >
              {rows.map((row) => (
                <div
                  key={row.date.getTime()}
                  id={`time-band-mobile-${row.date.getTime()}`}
                  className="grid gap-y-1"
                  style={{
                    gridTemplateRows: `repeat(${SCHEDULE_HOURS.length}, ${mobileCellHeight}px)`,
                  }}
                >
                  {SCHEDULE_HOURS.map((hour) => {
                    const cell = getCellAtHour(row, hour);
                    const cellKey = getTimeBandKey(row.date, hour);
                    const isHighlighted =
                      highlightedKey === cellKey ||
                      isCellWithinBand(row, hour, selectedBand);
                    const count = cell?.count ?? 0;
                    const attendeeNames = cell?.attendeeNames ?? [];

                    return (
                      <button
                        key={hour}
                        type="button"
                        onClick={() => onSelectBand(getBandSegmentAtHour(row, hour))}
                        className={cn(
                          "group relative rounded-md border-2 border-transparent transition-all",
                          "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/40 focus-visible:ring-offset-1",
                          getHeatmapCellClass(count, participantCount),
                          isHighlighted && "ring-2 ring-blue-500 ring-offset-1"
                        )}
                        title={
                          count > 0
                            ? `${formatHourRange(hour, hour + 1)}: ${attendeeNames.join("、")}`
                            : `${formatHourRange(hour, hour + 1)}: 回答なし`
                        }
                      >
                        <span className="sr-only">
                          {format(row.date, "M/d (E)", { locale: ja })}{" "}
                          {formatHourRange(hour, hour + 1)}{" "}
                          {count > 0 ? `${count}人参加可能` : "回答なし"}
                        </span>
                        {count > 0 ? (
                          <span className="flex h-full items-center justify-center text-xs font-semibold">
                            {count}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

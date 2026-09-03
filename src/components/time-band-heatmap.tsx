"use client";

import { format } from "date-fns";
import { ja } from "date-fns/locale";

import { dateOnlyToDate } from "@/lib/date-only";
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
const mobileTimeColumnWidth = 64;
const mobileDateColumnWidth = 76;

function MobileTimeBandHeatmap({
  rows,
  participantCount,
  highlightedKey,
  selectedBand,
  onSelectBand,
}: TimeBandHeatmapProps) {
  const gridTemplateColumns = `${mobileTimeColumnWidth}px repeat(${rows.length}, minmax(${mobileDateColumnWidth}px, 1fr))`;
  const minWidth = mobileTimeColumnWidth + rows.length * mobileDateColumnWidth;

  return (
    <div data-testid="mobile-time-band-heatmap" className="lg:hidden">
      <p className="mb-2 text-xs leading-5 text-slate-500">
        時刻を縦に表示しています。日付が多い場合は横に、時間帯は上下にスクロールできます。
      </p>
      <div
        data-testid="mobile-time-band-scroller"
        className="max-h-[70vh] overflow-auto rounded-xl border-2 border-slate-200 bg-white"
      >
        <div style={{ minWidth }}>
          <div
            className="sticky top-0 z-20 grid gap-px border-b-2 border-slate-200 bg-slate-200"
            style={{ gridTemplateColumns }}
          >
            <div className="sticky left-0 z-30 flex min-h-16 items-center justify-center bg-slate-50 px-2 text-xs font-semibold text-slate-600">
              時刻
            </div>
            {rows.map((row) => (
              <div
                key={row.date}
                className="flex min-h-16 flex-col items-center justify-center bg-slate-50 px-1 py-2 text-center"
              >
                <span className="text-sm font-semibold text-slate-800">
                  {format(dateOnlyToDate(row.date), "M/d", { locale: ja })}
                </span>
                <span className="text-[11px] text-slate-500">
                  {format(dateOnlyToDate(row.date), "(E)", { locale: ja })}
                </span>
                <span className="mt-0.5 text-[10px] text-slate-400">
                  最大 {row.bestSegment?.count ?? 0}人
                </span>
              </div>
            ))}
          </div>

          {SCHEDULE_HOURS.map((hour) => (
            <div
              key={hour}
              className="grid gap-px border-b border-slate-100 bg-white last:border-b-0"
              style={{ gridTemplateColumns }}
            >
              <div className="sticky left-0 z-10 flex h-10 items-center justify-center border-r-2 border-slate-200 bg-white px-1 text-[11px] font-medium tabular-nums text-slate-600">
                {formatShortHour(hour)}
              </div>
              {rows.map((row) => {
                const cell = row.cells.find((entry) => entry.hour === hour);
                if (!cell) {
                  return <div key={row.date} className="h-10 bg-slate-50" />;
                }

                const cellKey = getTimeBandKey(row.date, cell.hour);
                const isHighlighted =
                  highlightedKey === cellKey ||
                  isCellWithinBand(row, cell.hour, selectedBand);

                return (
                  <button
                    key={row.date}
                    id={`time-band-mobile-${row.date}-${cell.hour}`}
                    type="button"
                    onClick={() => onSelectBand(getBandSegmentAtHour(row, cell.hour))}
                    className={cn(
                      "relative m-0.5 h-9 rounded border-2 border-transparent transition-all",
                      "focus-visible:z-10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/40",
                      getHeatmapCellClass(cell.count, participantCount),
                      isHighlighted && "z-10 ring-2 ring-blue-500 ring-offset-1"
                    )}
                    title={
                      cell.count > 0
                        ? `${format(dateOnlyToDate(row.date), "M/d (E)", { locale: ja })} ${formatHourRange(cell.hour, cell.hour + 1)}: ${cell.attendeeNames.join("、")}`
                        : `${format(dateOnlyToDate(row.date), "M/d (E)", { locale: ja })} ${formatHourRange(cell.hour, cell.hour + 1)}: 回答なし`
                    }
                  >
                    <span className="sr-only">
                      {format(dateOnlyToDate(row.date), "M/d (E)", { locale: ja })} {" "}
                      {formatHourRange(cell.hour, cell.hour + 1)} {" "}
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
          ))}

          <div
            className="grid gap-px bg-white"
            style={{ gridTemplateColumns }}
          >
            <div className="sticky left-0 z-10 flex h-8 items-center justify-center border-r-2 border-slate-200 bg-white px-1 text-[11px] font-medium tabular-nums text-slate-600">
              {formatShortHour(SCHEDULE_END_HOUR)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DesktopTimeBandHeatmap({
  rows,
  participantCount,
  highlightedKey,
  selectedBand,
  onSelectBand,
}: TimeBandHeatmapProps) {
  return (
    <div data-testid="desktop-time-band-heatmap" className="hidden lg:block">
      <div className="overflow-x-auto">
        <div className="min-w-[920px] space-y-2">
        <div className="grid items-center gap-1 text-xs font-medium text-slate-500" style={{ gridTemplateColumns: heatmapGridColumns }}>
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
                key={row.date}
                id={`time-band-desktop-${row.date}`}
                className="grid gap-1"
                style={{ gridTemplateColumns: heatmapGridColumns }}
              >
                <div className="sticky left-0 z-10 flex flex-col justify-center rounded-l-xl border-2 border-slate-200 bg-white px-4 py-3 shadow-[1px_0_0_0_#cbd5e1]">
                  <div className="text-sm font-semibold text-slate-800">
                    {format(dateOnlyToDate(row.date), "M/d (E)", { locale: ja })}
                  </div>
                  {row.bestSegment ? (
                    <div className="mt-1 text-xs text-slate-500">
                      最高 {row.bestSegment.count} 人 / {formatHourRange(row.bestSegment.startHour, row.bestSegment.endHour)}
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
                      key={`${row.date}-${cell.hour}`}
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
    </div>
  );
}

export function TimeBandHeatmap(props: TimeBandHeatmapProps) {
  if (props.rows.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
        まだ回答がありません。最初の回答を入力すると、候補時間の帯が表示されます。
      </div>
    );
  }

  return (
    <>
      <MobileTimeBandHeatmap {...props} />
      <DesktopTimeBandHeatmap {...props} />
    </>
  );
}

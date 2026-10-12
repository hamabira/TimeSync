"use client";

import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { CalendarDays, Copy, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { dateOnlyToDate, type DateOnly } from "@/lib/date-only";
import type { CopyState } from "../types";

type EventOverviewHeaderProps = {
  name: string;
  description: string | null;
  startDate: DateOnly;
  endDate: DateOnly;
  responseCount: number;
  copyState: CopyState;
  onCopyLink: () => void;
};

export function EventOverviewHeader({
  name,
  description,
  startDate,
  endDate,
  responseCount,
  copyState,
  onCopyLink,
}: EventOverviewHeaderProps) {
  const eventStartDate = dateOnlyToDate(startDate);
  const eventEndDate = dateOnlyToDate(endDate);

  return (
    <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between sm:p-5">
      <div className="min-w-0 space-y-2">
        <p className="text-xs font-semibold text-blue-800">日程調整</p>
        <h1 className="break-words text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
          {name}
        </h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays aria-hidden="true" className="h-4 w-4 text-slate-500" />
            {format(eventStartDate, "yyyy/MM/dd", { locale: ja })} 〜 {format(eventEndDate, "yyyy/MM/dd", { locale: ja })}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users aria-hidden="true" className="h-4 w-4 text-slate-500" />
            {responseCount}人が回答
          </span>
        </div>
        {description ? (
          <p className="max-w-3xl whitespace-pre-wrap text-sm leading-6 text-slate-600">{description}</p>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end">
        <Button variant="outline" onClick={onCopyLink} className="h-11 w-full bg-white sm:w-auto">
          <Copy aria-hidden="true" className="mr-2 h-4 w-4" />
          共有URLをコピー
        </Button>
        <span role="status" aria-live="polite" className="min-h-5 text-xs text-slate-500">
          {copyState === "copied"
            ? "URLをコピーしました。"
            : copyState === "error"
              ? "コピーに失敗しました。"
              : ""}
        </span>
      </div>
    </header>
  );
}

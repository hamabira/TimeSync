"use client";

import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Calendar as CalendarIcon, CalendarDays, Copy, Users } from "lucide-react";

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
    <section className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
            <CalendarDays className="h-4 w-4" />
            空き状況がすぐ分かる日程調整
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 lg:text-4xl">
              {name}
            </h1>
            {description ? (
              <p className="max-w-3xl whitespace-pre-wrap text-base leading-7 text-slate-600">
                {description}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600">
              <CalendarIcon className="h-4 w-4" />
              {format(eventStartDate, "yyyy/MM/dd", { locale: ja })} 〜{" "}
              {format(eventEndDate, "yyyy/MM/dd", { locale: ja })}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600">
              <Users className="h-4 w-4" />
              回答 {responseCount} 件
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onCopyLink} className="h-11">
            <Copy className="mr-2 h-4 w-4" />
            共有URLをコピー
          </Button>
          <div className="flex items-center text-xs text-slate-500">
            {copyState === "copied"
              ? "URL をコピーしました。"
              : copyState === "error"
                ? "コピーに失敗しました。"
                : "共有 URL をそのまま使えます。"}
          </div>
        </div>
      </div>
    </section>
  );
}

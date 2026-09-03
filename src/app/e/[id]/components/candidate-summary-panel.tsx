"use client";

import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Clock3, Copy, Link2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { dateOnlyToDate } from "@/lib/date-only";
import {
  formatBandSummary,
  formatHourRange,
  getTimeBandKey,
  type TimeBandSegment,
} from "@/lib/scheduling";
import { cn } from "@/lib/utils";
import type { CopyState } from "../types";

type AttendeeChipsProps = {
  names: string[];
  expanded: boolean;
  onToggle: () => void;
};

function AttendeeChips({ names, expanded, onToggle }: AttendeeChipsProps) {
  const preview = names.slice(0, 3);
  const overflow = names.length - preview.length;
  const visibleNames = expanded ? names : preview;

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">参加者</div>
      <div className="flex flex-wrap gap-2">
        {visibleNames.map((name) => (
          <span
            key={name}
            className="inline-flex items-center rounded-full border-2 border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
          >
            {name}
          </span>
        ))}
        {overflow > 0 ? (
          <button
            type="button"
            className="inline-flex items-center rounded-full border-2 border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-500 transition-colors hover:border-blue-300 hover:text-blue-700"
            onClick={(event) => {
              event.stopPropagation();
              onToggle();
            }}
          >
            {expanded ? "閉じる" : `+${overflow}人`}
          </button>
        ) : null}
      </div>
    </div>
  );
}

type CandidateSummaryPanelProps = {
  candidates: TimeBandSegment[];
  selectedBand: TimeBandSegment | null;
  expandedSelectedBand: boolean;
  expandedCandidateKey: string | null;
  bandCopyState: CopyState;
  onOpenBand: (band: TimeBandSegment) => void;
  onToggleCandidateExpansion: (candidateKey: string) => void;
  onToggleSelectedBandExpansion: () => void;
  onCopyBandSummary: () => void;
  onClearSelectedBand: () => void;
};

export function CandidateSummaryPanel({
  candidates,
  selectedBand,
  expandedSelectedBand,
  expandedCandidateKey,
  bandCopyState,
  onOpenBand,
  onToggleCandidateExpansion,
  onToggleSelectedBandExpansion,
  onCopyBandSummary,
  onClearSelectedBand,
}: CandidateSummaryPanelProps) {
  const selectedBandKey = selectedBand
    ? getTimeBandKey(selectedBand.date, selectedBand.startHour)
    : null;

  return (
    <Card className="h-fit shadow-sm ring-2 ring-slate-200 lg:sticky lg:top-24">
      <CardHeader className="border-b-2 border-slate-200 bg-slate-50/70 pb-4">
        <CardTitle className="text-xl font-bold text-slate-800">2. 候補を一目で見る</CardTitle>
        <CardDescription>
          参加可能人数が多い時間帯を、横バー型のヒートマップで表示します。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 pt-6">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Link2 className="h-4 w-4" />
          第一候補から第三候補を上に並べています。
        </div>

        {candidates.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
            まだ候補はありません。回答が入ると上位候補が表示されます。
          </div>
        ) : (
          <div className="space-y-3">
            {candidates.map((candidate, index) => {
              const candidateKey = getTimeBandKey(candidate.date, candidate.startHour);
              const isExpanded = expandedCandidateKey === candidateKey;

              return (
                <div
                  key={candidateKey}
                  className={cn(
                    "w-full rounded-xl border-2 p-4 text-left transition-all",
                    "cursor-pointer",
                    "hover:-translate-y-0.5 hover:shadow-md",
                    selectedBandKey === candidateKey
                      ? "border-blue-500 bg-blue-50/70"
                      : "border-slate-200 bg-white hover:border-blue-300"
                  )}
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenBand(candidate)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onOpenBand(candidate);
                    }
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div
                        className={cn(
                          "text-xs font-bold",
                          "text-slate-500"
                        )}
                      >
                        第{index + 1}候補
                      </div>
                      <div className="mt-1 text-lg font-bold text-slate-800">
                        {format(dateOnlyToDate(candidate.date), "M/d (E)", { locale: ja })}
                      </div>
                    </div>
                    <div
                      className={cn(
                        "rounded-full px-3 py-1 text-sm font-semibold",
                        "bg-slate-100 text-slate-700"
                      )}
                    >
                      {candidate.count} 人
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                    <Clock3 className="h-4 w-4" />
                    {formatHourRange(candidate.startHour, candidate.endHour)}
                  </div>
                  <div className="mt-3">
                    <AttendeeChips
                      names={candidate.attendeeNames}
                      expanded={isExpanded}
                      onToggle={() => onToggleCandidateExpansion(candidateKey)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="rounded-xl border-2 border-slate-200 bg-slate-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-700">選択中の帯</div>
              {selectedBand ? (
                <>
                  <div className="mt-2 text-sm text-slate-600">
                    {format(dateOnlyToDate(selectedBand.date), "M/d (E)", { locale: ja })}
                  </div>
                  <div className="mt-1 text-base font-bold text-slate-900">
                    {formatBandSummary(selectedBand)}
                  </div>
                  <div className="mt-3">
                    <AttendeeChips
                      names={selectedBand.attendeeNames}
                      expanded={expandedSelectedBand}
                      onToggle={onToggleSelectedBandExpansion}
                    />
                  </div>
                </>
              ) : (
                <div className="mt-2 text-sm text-slate-500">
                  帯を選ぶと詳細がここに表示されます。
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={onCopyBandSummary}
                disabled={!selectedBand}
              >
                <Copy className="mr-2 h-4 w-4" />
                コピー
              </Button>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={onClearSelectedBand}
                disabled={!selectedBand}
              >
                解除
              </Button>
            </div>
          </div>
          <div className="mt-3 text-xs text-slate-500">
            {bandCopyState === "copied"
              ? "候補文をコピーしました。"
              : bandCopyState === "error"
                ? "コピーに失敗しました。"
                : "候補文はそのままチャットに貼れます。"}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

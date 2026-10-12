"use client";

import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { ArrowDown, Clock3, Copy, Link2, Users } from "lucide-react";

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

function formatDate(date: TimeBandSegment["date"]) {
  return format(dateOnlyToDate(date), "M/d (E)", { locale: ja });
}

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
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold text-slate-500">参加者</span>
      {visibleNames.map((name) => (
        <span
          key={name}
          className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
        >
          {name}
        </span>
      ))}
      {overflow > 0 ? (
        <button
          type="button"
          className="min-h-9 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-blue-300 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          onClick={onToggle}
          aria-expanded={expanded}
        >
          {expanded ? "閉じる" : "ほか " + overflow + " 人"}
        </button>
      ) : null}
    </div>
  );
}

type BestCandidateSummaryProps = {
  candidate: TimeBandSegment | null;
  participantCount: number;
  onView: () => void;
};

export function BestCandidateSummary({
  candidate,
  participantCount,
  onView,
}: BestCandidateSummaryProps) {
  return (
    <section
      aria-label="いちばん集まりやすい時間"
      className="flex flex-col gap-4 rounded-2xl border border-blue-200 bg-blue-50/80 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
    >
      <div className="min-w-0">
        <p className="text-xs font-bold tracking-wide text-blue-800">いちばん集まりやすい時間</p>
        {candidate ? (
          <>
            <p className="mt-1 text-lg font-bold text-slate-900 sm:text-xl">
              {formatDate(candidate.date)}・{formatHourRange(candidate.startHour, candidate.endHour)}
            </p>
            <p className="mt-1 text-sm text-slate-700">
              {candidate.count}/{participantCount}人が参加できます
            </p>
          </>
        ) : (
          <p className="mt-1 text-sm text-slate-700">回答が集まると、ここに候補が表示されます。</p>
        )}
      </div>
      {candidate ? (
        <Button type="button" variant="outline" className="h-11 shrink-0 bg-white" onClick={onView}>
          この候補を見る <ArrowDown aria-hidden="true" />
        </Button>
      ) : null}
    </section>
  );
}

type CandidateSummaryPanelProps = {
  candidates: TimeBandSegment[];
  participantCount: number;
  selectedBand: TimeBandSegment | null;
  expandedCandidateKey: string | null;
  onOpenBand: (band: TimeBandSegment) => void;
  onToggleCandidateExpansion: (candidateKey: string) => void;
};

export function CandidateSummaryPanel({
  candidates,
  participantCount,
  selectedBand,
  expandedCandidateKey,
  onOpenBand,
  onToggleCandidateExpansion,
}: CandidateSummaryPanelProps) {
  const selectedBandKey = selectedBand
    ? getTimeBandKey(selectedBand.date, selectedBand.startHour)
    : null;

  return (
    <Card className="h-fit shadow-sm ring-1 ring-slate-200 lg:sticky lg:top-24">
      <CardHeader className="border-b border-slate-200 bg-slate-50/70 pb-4">
        <CardTitle className="text-lg font-bold text-slate-900">集まりやすい候補</CardTitle>
        <CardDescription>参加できる人数が多い上位3件です。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Link2 aria-hidden="true" className="h-4 w-4" />
          候補を押すと、全体の結果で詳しく確認できます。
        </div>

        {candidates.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-7 text-center text-sm leading-6 text-slate-600">
            まだ候補はありません。回答が届くと、上位の時間帯が表示されます。
          </div>
        ) : (
          <ol className="space-y-3">
            {candidates.map((candidate, index) => {
              const candidateKey = getTimeBandKey(candidate.date, candidate.startHour);
              const isExpanded = expandedCandidateKey === candidateKey;
              const isSelected = selectedBandKey === candidateKey;

              return (
                <li key={candidateKey}>
                  <article
                    className={cn(
                      "rounded-xl border transition-colors",
                      isSelected ? "border-blue-500 bg-blue-50/70" : "border-slate-200 bg-white"
                    )}
                  >
                    <button
                      type="button"
                      className="w-full rounded-xl p-4 text-left hover:bg-blue-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
                      onClick={() => onOpenBand(candidate)}
                      aria-pressed={isSelected}
                      aria-label={
                        "第" + (index + 1) + "候補 " + formatDate(candidate.date) + " " +
                        formatHourRange(candidate.startHour, candidate.endHour) + "、" +
                        candidate.count + "/" + participantCount + "人が参加可能。結果を見る"
                      }
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block text-xs font-semibold text-blue-800">第{index + 1}候補</span>
                          <span className="mt-1 block font-bold text-slate-900">{formatDate(candidate.date)}</span>
                          <span className="mt-2 flex items-center gap-2 text-sm text-slate-700">
                            <Clock3 aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-500" />
                            {formatHourRange(candidate.startHour, candidate.endHour)}
                          </span>
                        </span>
                        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-slate-700">
                          {candidate.count}/{participantCount}人
                        </span>
                      </span>
                    </button>
                    <div className="border-t border-slate-100 px-4 py-3">
                      <AttendeeChips
                        names={candidate.attendeeNames}
                        expanded={isExpanded}
                        onToggle={() => onToggleCandidateExpansion(candidateKey)}
                      />
                    </div>
                  </article>
                </li>
              );
            })}
          </ol>
        )}
        <a
          href="#results-section"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-blue-700 underline-offset-4 hover:bg-blue-50 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          すべての空き時間を見る <ArrowDown aria-hidden="true" className="h-4 w-4" />
        </a>
      </CardContent>
    </Card>
  );
}

type SelectedBandDetailsProps = {
  selectedBand: TimeBandSegment | null;
  participantCount: number;
  expanded: boolean;
  copyState: CopyState;
  onToggleExpansion: () => void;
  onCopy: () => void;
  onClear: () => void;
};

export function SelectedBandDetails({
  selectedBand,
  participantCount,
  expanded,
  copyState,
  onToggleExpansion,
  onCopy,
  onClear,
}: SelectedBandDetailsProps) {
  return (
    <section
      id="selected-band-details"
      aria-label="選択した時間帯の詳細"
      className="mb-5 scroll-mt-24 rounded-xl border border-blue-200 bg-blue-50/70 p-4 sm:p-5"
    >
      {selectedBand ? (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-blue-800">選択した時間帯</p>
              <h3 aria-live="polite" className="mt-1 text-lg font-bold text-slate-900">
                {formatDate(selectedBand.date)}・{formatHourRange(selectedBand.startHour, selectedBand.endHour)}
              </h3>
              <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-slate-700">
                <Users aria-hidden="true" className="h-4 w-4" />
                {selectedBand.count}/{participantCount}人が参加できます
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="h-11 bg-white" onClick={onCopy}>
                <Copy aria-hidden="true" /> 候補文をコピー
              </Button>
              <Button type="button" variant="ghost" className="h-11" onClick={onClear}>
                選択を解除
              </Button>
            </div>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            {selectedBand.attendeeNames.length === 0
              ? "参加できる人はいません"
              : (expanded ? selectedBand.attendeeNames : selectedBand.attendeeNames.slice(0, 3)).join("、")}
            {!expanded && selectedBand.attendeeNames.length > 3
              ? "、ほか " + (selectedBand.attendeeNames.length - 3) + " 人"
              : ""}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {selectedBand.attendeeNames.length > 3 ? (
              <Button
                type="button"
                variant="ghost"
                className="h-10 px-2 text-sm text-blue-800"
                onClick={onToggleExpansion}
                aria-expanded={expanded}
              >
                {expanded ? "参加者を短く表示" : "参加者をすべて表示"}
              </Button>
            ) : null}
            <p role="status" className="text-xs text-slate-600">
              {copyState === "copied"
                ? "候補文をコピーしました。"
                : copyState === "error"
                  ? "コピーに失敗しました。"
                  : "候補文はそのままチャットに貼れます。"}
            </p>
          </div>
          <span className="sr-only">{formatBandSummary(selectedBand)}</span>
        </>
      ) : (
        <p className="text-sm leading-6 text-slate-600">
          ヒートマップの帯や候補を選ぶと、日時と参加できる人をここで確認できます。
        </p>
      )}
    </section>
  );
}

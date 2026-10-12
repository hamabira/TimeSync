"use client";

import { useMemo, useState, type FormEventHandler } from "react";
import Link from "next/link";

import { CalendarAvailabilityHeatmap } from "@/components/calendar-availability-heatmap";
import { TimeBandHeatmap } from "@/components/time-band-heatmap";
import {
  dateOnlyToDate,
  dateToDateOnly,
  type DateOnly,
} from "@/lib/date-only";
import {
  buildTimeBandRows,
  buildTopSegments,
  MAX_RESPONSE_SLOTS,
  normalizeParticipantName,
  parseTimeRange,
  type EventRecord,
  type ParticipantRecord,
  type TimeBandSegment,
} from "@/lib/scheduling";
import { CandidateSummaryPanel } from "@/app/e/[id]/components/candidate-summary-panel";
import { EventOverviewHeader } from "@/app/e/[id]/components/event-overview-header";
import { ResponseForm } from "@/app/e/[id]/components/response-form";
import type {
  CopyState,
  NoticeState,
  TimeSlotDraft,
  TimeSlotField,
} from "@/app/e/[id]/types";

import { fixtureEvent, fixtureParticipants } from "../fixtures";

const defaultDraftSlots: TimeSlotDraft[] = [];

export type CurrentEventScreenProps = {
  event?: EventRecord;
  participants?: ParticipantRecord[];
  initialDraftSlots?: TimeSlotDraft[];
  initialNotice?: NoticeState;
};

export function CurrentEventScreen({
  event = fixtureEvent,
  participants: initialParticipants = fixtureParticipants,
  initialDraftSlots = defaultDraftSlots,
  initialNotice = null,
}: CurrentEventScreenProps = {}) {
  const [participants, setParticipants] = useState(() => [...initialParticipants]);
  const [userName, setUserName] = useState("");
  const [timeSlots, setTimeSlots] = useState(() => [...initialDraftSlots]);
  const [selectedBand, setSelectedBand] = useState<TimeBandSegment | null>(null);
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null);
  const [expandedSelectedBand, setExpandedSelectedBand] = useState(false);
  const [expandedCandidateKey, setExpandedCandidateKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeState>(initialNotice);
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [bandCopyState, setBandCopyState] = useState<CopyState>("idle");

  const selectedDateKeys = useMemo(
    () => [...new Set(timeSlots.map((slot) => slot.date))].sort(),
    [timeSlots]
  );
  const selectedDates = useMemo(
    () => selectedDateKeys.map((date) => dateOnlyToDate(date)),
    [selectedDateKeys]
  );
  const rows = useMemo(() => buildTimeBandRows(participants), [participants]);
  const candidates = useMemo(() => buildTopSegments(rows).slice(0, 3), [rows]);

  const handleSelectDates = (dates: Date[] | undefined) => {
    const nextDateKeys = [...new Set((dates ?? []).map(dateToDateOnly))].sort();
    const keptSlots = timeSlots.filter((slot) => nextDateKeys.includes(slot.date));
    const keptDates = new Set(keptSlots.map((slot) => slot.date));
    const additions = nextDateKeys
      .filter((date) => !keptDates.has(date))
      .slice(0, Math.max(0, MAX_RESPONSE_SLOTS - keptSlots.length))
      .map((date) => ({
        id: crypto.randomUUID(),
        date,
        startTime: "19:00",
        endTime: "21:00",
      }));

    setNotice(
      keptSlots.length + additions.length < nextDateKeys.length
        ? {
            type: "error",
            message: `時間帯は${MAX_RESPONSE_SLOTS.toLocaleString("ja-JP")}件以内で選択してください。`,
          }
        : null
    );
    setTimeSlots([...keptSlots, ...additions]);
  };

  const addTimeSlot = (date: DateOnly) => {
    if (timeSlots.length >= MAX_RESPONSE_SLOTS) {
      setNotice({
        type: "error",
        message: `時間帯は${MAX_RESPONSE_SLOTS.toLocaleString("ja-JP")}件以内で選択してください。`,
      });
      return;
    }

    setTimeSlots((previous) => [
      ...previous,
      {
        id: crypto.randomUUID(),
        date,
        startTime: "19:00",
        endTime: "21:00",
      },
    ]);
  };

  const updateTimeSlot = (id: string, field: TimeSlotField, value: string) => {
    setTimeSlots((previous) =>
      previous.map((slot) => (slot.id === id ? { ...slot, [field]: value } : slot))
    );
  };

  const removeTimeSlot = (id: string) => {
    setTimeSlots((previous) => previous.filter((slot) => slot.id !== id));
  };

  const handleSubmit: FormEventHandler<HTMLFormElement> = (formEvent) => {
    formEvent.preventDefault();
    const normalizedName = normalizeParticipantName(userName);

    if (!normalizedName) {
      setNotice({ type: "error", message: "お名前を入力してください。" });
      return;
    }

    if (timeSlots.length === 0) {
      setNotice({ type: "error", message: "時間帯を1件以上選択してください。" });
      return;
    }

    if (timeSlots.some((slot) => !parseTimeRange(slot.startTime, slot.endTime))) {
      setNotice({ type: "error", message: "開始時刻は終了時刻より前にしてください。" });
      return;
    }

    const response: ParticipantRecord = {
      id: `storybook-${normalizedName}`,
      name: normalizedName,
      timeSlots: timeSlots.map(({ date, startTime, endTime }) => ({
        date,
        startTime,
        endTime,
      })),
    };

    setParticipants((previous) => {
      const existingIndex = previous.findIndex((participant) => participant.name === normalizedName);
      if (existingIndex === -1) {
        return [...previous, response];
      }

      return previous.map((participant, index) =>
        index === existingIndex ? { ...response, id: participant.id } : participant
      );
    });
    setUserName("");
    setTimeSlots([]);
    setSelectedBand(null);
    setExpandedSelectedBand(false);
    setNotice({
      type: "success",
      message: `${normalizedName}さんの希望日程を保存しました。`,
    });
  };

  const openBand = (band: TimeBandSegment | null) => {
    if (!band) {
      return;
    }

    setSelectedBand(band);
    setExpandedSelectedBand(false);
    setHighlightedKey(`${band.date}-${band.startHour}`);
  };

  const handleCopyBandSummary = () => {
    if (selectedBand) {
      setBandCopyState("copied");
    }
  };

  return (
    <div
      className="flex min-h-screen flex-col bg-slate-50 text-slate-900"
      style={{
        fontFamily:
          'Inter, "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Noto Sans JP", system-ui, sans-serif',
      }}
    >
      <header className="sticky top-0 z-50 w-full border-b-2 border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-xl font-bold text-transparent">
            AkiMatch
          </span>
        </div>
      </header>

      <main className="container mx-auto flex-1 px-4 py-8">
        <div className="mx-auto max-w-6xl space-y-8 py-6">
          <EventOverviewHeader
            name={event.name}
            description={event.description}
            startDate={event.startDate}
            endDate={event.endDate}
            responseCount={participants.length}
            copyState={copyState}
            onCopyLink={() => setCopyState("copied")}
          />

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
            <ResponseForm
              eventStartDate={dateOnlyToDate(event.startDate)}
              eventEndDate={dateOnlyToDate(event.endDate)}
              selectedDates={selectedDates}
              selectedDateKeys={selectedDateKeys}
              timeSlots={timeSlots}
              userName={userName}
              notice={notice}
              isSubmitting={false}
              onSubmit={handleSubmit}
              onSelectDates={handleSelectDates}
              onAddTimeSlot={addTimeSlot}
              onUpdateTimeSlot={updateTimeSlot}
              onRemoveTimeSlot={removeTimeSlot}
              onUserNameChange={setUserName}
            />

            <CandidateSummaryPanel
              candidates={candidates}
              selectedBand={selectedBand}
              expandedSelectedBand={expandedSelectedBand}
              expandedCandidateKey={expandedCandidateKey}
              bandCopyState={bandCopyState}
              onOpenBand={openBand}
              onToggleCandidateExpansion={(candidateKey) =>
                setExpandedCandidateKey((current) =>
                  current === candidateKey ? null : candidateKey
                )
              }
              onToggleSelectedBandExpansion={() =>
                setExpandedSelectedBand((current) => !current)
              }
              onCopyBandSummary={handleCopyBandSummary}
              onClearSelectedBand={() => {
                setSelectedBand(null);
                setExpandedSelectedBand(false);
              }}
            />
          </div>

          <section className="rounded-xl bg-white shadow-sm ring-2 ring-slate-200">
            <div className="grid gap-1 border-b-2 border-slate-200 bg-slate-50/70 px-6 py-4">
              <h2 className="text-xl font-bold text-slate-800">みんなの回答状況</h2>
              <p className="text-sm text-slate-600">
                <span className="lg:hidden">
                  時刻を縦に並べた帯で、重なりやすい時間がすぐ分かります。
                </span>
                <span className="hidden lg:inline">
                  横に流れる時間帯の帯で、重なりやすい時間がすぐ分かります。
                </span>
              </p>
            </div>
            <div className="p-6">
              <TimeBandHeatmap
                rows={rows}
                participantCount={participants.length}
                highlightedKey={highlightedKey}
                selectedBand={selectedBand}
                onSelectBand={openBand}
              />
              <div className="mt-8 border-t-2 border-slate-200 pt-6">
                <CalendarAvailabilityHeatmap
                  startDate={event.startDate}
                  endDate={event.endDate}
                  rows={rows}
                  participantCount={participants.length}
                  selectedBand={selectedBand}
                  onSelectBand={openBand}
                />
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t-2 border-slate-200 bg-white py-6">
        <div className="container mx-auto flex flex-col items-center justify-center gap-3 px-4 text-center text-sm text-slate-500 sm:flex-row sm:justify-between">
          <div>© {new Date().getFullYear()} AkiMatch. All rights reserved.</div>
          <nav aria-label="法務リンク" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <Link className="font-medium text-slate-600 transition-colors hover:text-blue-700" href="/terms">
              利用規約
            </Link>
            <Link className="font-medium text-slate-600 transition-colors hover:text-blue-700" href="/privacy">
              プライバシーポリシー
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

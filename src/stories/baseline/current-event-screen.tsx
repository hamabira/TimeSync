"use client";

import { useMemo, useState, type FormEventHandler } from "react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarAvailabilityHeatmap } from "@/components/calendar-availability-heatmap";
import { TimeBandHeatmap } from "@/components/time-band-heatmap";
import { dateOnlyToDate, dateToDateOnly, type DateOnly } from "@/lib/date-only";
import {
  buildTimeBandRows,
  buildTopSegments,
  formatBandSummary,
  formatParticipantLine,
  getBandSegmentAtHour,
  MAX_RESPONSE_SLOTS,
  normalizeParticipantName,
  parseTimeRange,
  type EventRecord,
  type ParticipantRecord,
  type TimeBandSegment,
} from "@/lib/scheduling";
import { BestCandidateSummary, CandidateSummaryPanel, SelectedBandDetails } from "@/app/e/[id]/components/candidate-summary-panel";
import { EventOverviewHeader } from "@/app/e/[id]/components/event-overview-header";
import { ResponseForm } from "@/app/e/[id]/components/response-form";
import type { CopyState, NoticeState, TimeSlotDraft, TimeSlotField } from "@/app/e/[id]/types";

import { fixtureEvent, fixtureParticipants } from "../fixtures";

export type CurrentEventScreenProps = {
  event?: EventRecord;
  participants?: ParticipantRecord[];
  initialName?: string;
  initialDraftSlots?: TimeSlotDraft[];
  initialNotice?: NoticeState;
  initialSelectedBand?: TimeBandSegment | null;
  initialIsSubmitting?: boolean;
  submitBehavior?: "success" | "error" | "refresh-failure";
};

export function CurrentEventScreen({
  event = fixtureEvent,
  participants: initialParticipants = fixtureParticipants,
  initialName = "",
  initialDraftSlots = [],
  initialNotice = null,
  initialSelectedBand = null,
  initialIsSubmitting = false,
  submitBehavior = "success",
}: CurrentEventScreenProps = {}) {
  const [participants, setParticipants] = useState(() => [...initialParticipants]);
  const [userName, setUserName] = useState(initialName);
  const [timeSlots, setTimeSlots] = useState(() => [...initialDraftSlots]);
  const [selectedBandTarget, setSelectedBandTarget] = useState(() =>
    initialSelectedBand
      ? { date: initialSelectedBand.date, startHour: initialSelectedBand.startHour }
      : null
  );
  const [expandedSelectedBand, setExpandedSelectedBand] = useState(false);
  const [expandedCandidateKey, setExpandedCandidateKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeState>(initialNotice);
  const [slotErrors, setSlotErrors] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      initialDraftSlots
        .filter((slot) => !parseTimeRange(slot.startTime, slot.endTime))
        .map((slot) => [slot.id, "終了時刻は開始時刻より後にしてください。"])
    )
  );
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [bandCopyState, setBandCopyState] = useState<CopyState>("idle");
  const [hasSavedResponse, setHasSavedResponse] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(initialIsSubmitting);

  const selectedDateKeys = useMemo(
    () => [...new Set(timeSlots.map((slot) => slot.date))].sort(),
    [timeSlots]
  );
  const selectedDates = useMemo(
    () => selectedDateKeys.map((date) => dateOnlyToDate(date)),
    [selectedDateKeys]
  );
  const rows = useMemo(() => buildTimeBandRows(participants), [participants]);
  const selectedBand = useMemo(() => {
    if (!selectedBandTarget) {
      return null;
    }

    const row = rows.find((entry) => entry.date === selectedBandTarget.date);
    return row ? getBandSegmentAtHour(row, selectedBandTarget.startHour) : null;
  }, [rows, selectedBandTarget]);
  const candidates = useMemo(() => buildTopSegments(rows).slice(0, 3), [rows]);
  const normalizedName = normalizeParticipantName(userName);
  const existingParticipant = normalizedName
    ? participants.find((participant) => participant.name === normalizedName) ?? null
    : null;

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
    const nextSlots = [...keptSlots, ...additions];
    const retainedIds = new Set(nextSlots.map((slot) => slot.id));

    setTimeSlots(nextSlots);
    setHasSavedResponse(false);
    setSlotErrors((previous) =>
      Object.fromEntries(Object.entries(previous).filter(([slotId]) => retainedIds.has(slotId)))
    );
    setNotice(
      nextSlots.length < nextDateKeys.length
        ? { type: "error", message: `時間帯は${MAX_RESPONSE_SLOTS.toLocaleString("ja-JP")}件以内で選択してください。` }
        : null
    );
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
      { id: crypto.randomUUID(), date, startTime: "19:00", endTime: "21:00" },
    ]);
    setHasSavedResponse(false);
    setNotice(null);
  };

  const updateTimeSlot = (id: string, field: TimeSlotField, value: string) => {
    setTimeSlots((previous) =>
      previous.map((slot) => (slot.id === id ? { ...slot, [field]: value } : slot))
    );
    setHasSavedResponse(false);
    setSlotErrors((previous) => {
      const next = { ...previous };
      delete next[id];
      return next;
    });
    setNotice(null);
  };

  const removeTimeSlot = (id: string) => {
    setTimeSlots((previous) => previous.filter((slot) => slot.id !== id));
    setHasSavedResponse(false);
    setSlotErrors((previous) => {
      const next = { ...previous };
      delete next[id];
      return next;
    });
    setNotice(null);
  };

  const loadPreviousResponse = () => {
    if (!existingParticipant) {
      return;
    }

    setTimeSlots(
      existingParticipant.timeSlots.map((slot) => ({ ...slot, id: crypto.randomUUID() }))
    );
    setSlotErrors({});
    setHasSavedResponse(false);
    setNotice({ type: "success", message: "前回の回答を読み込みました。必要な変更を加えてから送信してください。" });
  };

  const handleSubmit: FormEventHandler<HTMLFormElement> = async (formEvent) => {
    formEvent.preventDefault();

    if (isSubmitting) {
      return;
    }

    const name = normalizeParticipantName(userName);
    const invalidSlots = timeSlots.filter((slot) => !parseTimeRange(slot.startTime, slot.endTime));
    setSlotErrors(
      Object.fromEntries(
        invalidSlots.map((slot) => [slot.id, "終了時刻は開始時刻より後にしてください。"])
      )
    );

    if (!name) {
      setNameError("お名前を入力してください。");
      setNotice(null);
      return;
    }

    setNameError(null);
    if (timeSlots.length === 0) {
      setNotice({ type: "error", message: "時間帯を1件以上選択してください。" });
      return;
    }
    if (invalidSlots.length > 0) {
      setNotice({ type: "error", message: "赤く表示した時間帯を確認してください。入力内容は残っています。" });
      return;
    }

    const submittedName = name;
    const submittedSlots = timeSlots.map(({ date, startTime, endTime }) => ({
      date,
      startTime,
      endTime,
    }));

    setIsSubmitting(true);
    setNotice(null);
    try {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 450));

      if (submitBehavior === "error") {
        setNotice({
          type: "error",
          message: "回答を保存できませんでした。入力内容は残っています。通信を確認してもう一度お試しください。",
        });
        return;
      }

      const response: ParticipantRecord = {
        id: existingParticipant?.id ?? "storybook-" + submittedName,
        name: submittedName,
        timeSlots: submittedSlots,
      };
      setParticipants((previous) => [
        ...previous.filter((participant) => participant.name !== submittedName),
        response,
      ]);
      setSelectedBandTarget(null);
      setExpandedSelectedBand(false);
      setBandCopyState("idle");
      setHasSavedResponse(true);
      setNotice({
        type: "success",
        message:
          submitBehavior === "refresh-failure"
            ? `${submittedName}さんの回答は保存済みです。最新の回答状況を読み込めませんでした。時間をおいて再読み込みしてください。`
            : `Storybook内の回答表示を${existingParticipant ? "更新" : "保存"}しました。入力内容は残っています。`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openBand = (band: TimeBandSegment | null) => {
    if (!band) {
      return;
    }

    setSelectedBandTarget({ date: band.date, startHour: band.startHour });
    setExpandedSelectedBand(false);
    setBandCopyState("idle");
    window.requestAnimationFrame(() => {
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      document.getElementById("selected-band-details")?.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "start",
      });

      if (window.matchMedia("(max-width: 1023px)").matches) {
        const scroller = document.querySelector<HTMLElement>("[data-testid='mobile-time-band-scroller']");
        const cell = document.getElementById(`time-band-mobile-${band.date}-${band.startHour}`);
        if (scroller && cell) {
          const scrollerRect = scroller.getBoundingClientRect();
          const cellRect = cell.getBoundingClientRect();
          const visibleTop = scrollerRect.top + 68;
          const visibleLeft = scrollerRect.left + 68;
          const top = scroller.scrollTop + cellRect.top - visibleTop;
          let left = scroller.scrollLeft;

          if (cellRect.left < visibleLeft) {
            left += cellRect.left - visibleLeft;
          } else if (cellRect.right > scrollerRect.right) {
            left += cellRect.right - scrollerRect.right;
          }

          scroller.scrollTo({
            top: Math.max(0, top),
            left: Math.max(0, left),
            behavior: prefersReducedMotion ? "auto" : "smooth",
          });
        }
      }
    });
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  };

  const handleCopyBandSummary = async () => {
    if (!selectedBand) {
      return;
    }

    const text = [
      `候補時間: ${formatBandSummary(selectedBand)}`,
      `日付: ${format(dateOnlyToDate(selectedBand.date), "yyyy/MM/dd (E)", { locale: ja })}`,
      formatParticipantLine(selectedBand.attendeeNames),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setBandCopyState("copied");
    } catch {
      setBandCopyState("error");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto w-full max-w-7xl space-y-5 px-4 py-5 sm:px-6 lg:space-y-6 lg:py-7">
        <p className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">
          Storybookプレビュー: 送信内容はこの画面の表示だけに反映されます。
        </p>
        <EventOverviewHeader
          name={event.name}
          description={event.description}
          startDate={event.startDate}
          endDate={event.endDate}
          responseCount={participants.length}
          copyState={copyState}
          onCopyLink={handleCopyLink}
        />
        <BestCandidateSummary
          candidate={candidates[0] ?? null}
          participantCount={participants.length}
          onView={() => openBand(candidates[0] ?? null)}
        />
        <nav aria-label="ページ内移動" className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-1.5 sm:w-fit">
          <a href="#answer-section" className="inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            あなたの回答
          </a>
          <a href="#results-section" className="inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold text-blue-800 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            みんなの結果 <span className="ml-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs">{participants.length}</span>
          </a>
        </nav>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6">
          <ResponseForm
            eventStartDate={dateOnlyToDate(event.startDate)}
            eventEndDate={dateOnlyToDate(event.endDate)}
            selectedDates={selectedDates}
            selectedDateKeys={selectedDateKeys}
            timeSlots={timeSlots}
            userName={userName}
            notice={notice}
            slotErrors={slotErrors}
            nameError={nameError}
            existingParticipant={existingParticipant}
            hasSavedResponse={hasSavedResponse}
            isSubmitting={isSubmitting}
            onSubmit={handleSubmit}
            onSelectDates={handleSelectDates}
            onAddTimeSlot={addTimeSlot}
            onUpdateTimeSlot={updateTimeSlot}
            onRemoveTimeSlot={removeTimeSlot}
            onUserNameChange={(value) => {
              setUserName(value);
              setNameError(null);
              setNotice(null);
              setHasSavedResponse(false);
            }}
            onLoadPreviousResponse={loadPreviousResponse}
          />
          <CandidateSummaryPanel
            candidates={candidates}
            participantCount={participants.length}
            selectedBand={selectedBand}
            expandedCandidateKey={expandedCandidateKey}
            onOpenBand={openBand}
            onToggleCandidateExpansion={(key) =>
              setExpandedCandidateKey((current) => (current === key ? null : key))
            }
          />
        </div>

        <Card id="results-section" className="scroll-mt-24 shadow-sm ring-1 ring-slate-200">
          <CardHeader className="border-b border-slate-200 bg-slate-50/70 pb-4">
            <CardTitle className="text-xl font-bold text-slate-900">空き時間の重なり</CardTitle>
            <CardDescription>日付ごとの帯で、参加できる人が重なる時間を確認できます。</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <SelectedBandDetails
              selectedBand={selectedBand}
              participantCount={participants.length}
              expanded={expandedSelectedBand}
              copyState={bandCopyState}
              onToggleExpansion={() => setExpandedSelectedBand((current) => !current)}
              onCopy={handleCopyBandSummary}
              onClear={() => {
                setSelectedBandTarget(null);
                setExpandedSelectedBand(false);
                setBandCopyState("idle");
              }}
            />
            <TimeBandHeatmap
              rows={rows}
              participantCount={participants.length}
              highlightedKey={selectedBand ? selectedBand.date + "-" + selectedBand.startHour : null}
              selectedBand={selectedBand}
              onSelectBand={openBand}
            />
            <details className="mt-6 border-t border-slate-200 pt-4">
              <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-blue-800">
                カレンダーで日付ごとの重なりを見る
              </summary>
              <div className="pt-3">
              <CalendarAvailabilityHeatmap
                startDate={event.startDate}
                endDate={event.endDate}
                rows={rows}
                participantCount={participants.length}
                selectedBand={selectedBand}
                onSelectBand={openBand}
              />
              </div>
            </details>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

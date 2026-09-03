"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CalendarAvailabilityHeatmap } from "@/components/calendar-availability-heatmap";
import { TimeBandHeatmap } from "@/components/time-band-heatmap";
import { getEventWithParticipants, submitResponse } from "@/app/actions";
import { CandidateSummaryPanel } from "./components/candidate-summary-panel";
import { EventOverviewHeader } from "./components/event-overview-header";
import { ResponseForm } from "./components/response-form";
import type { CopyState, NoticeState, TimeSlotDraft, TimeSlotField } from "./types";
import {
  dateOnlyToDate,
  dateToDateOnly,
  type DateOnly,
} from "@/lib/date-only";
import {
  buildTimeBandRows,
  buildTopSegments,
  formatBandSummary,
  formatParticipantLine,
  getTimeBandKey,
  MAX_RESPONSE_SLOTS,
  normalizeParticipantName,
  parseTimeRange,
  type EventWithParticipants,
  type TimeBandSegment,
} from "@/lib/scheduling";

type LoadState = "loading" | "loaded" | "not-found" | "error";

function hydrateEventData(data: EventWithParticipants) {
  return {
    event: {
      ...data.event,
      createdAt: new Date(data.event.createdAt),
    },
    participants: data.participants,
  } satisfies EventWithParticipants;
}

function createDefaultSlot(date: DateOnly): TimeSlotDraft {
  return {
    id: crypto.randomUUID(),
    date,
    startTime: "19:00",
    endTime: "21:00",
  };
}

export default function EventPage() {
  const params = useParams();
  const eventId = typeof params.id === "string" ? params.id : null;

  const [eventData, setEventData] = useState<EventWithParticipants["event"] | null>(null);
  const [participantsData, setParticipantsData] = useState<EventWithParticipants["participants"]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [userName, setUserName] = useState("");
  const [timeSlots, setTimeSlots] = useState<TimeSlotDraft[]>([]);
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null);
  const [selectedBand, setSelectedBand] = useState<TimeBandSegment | null>(null);
  const [expandedSelectedBand, setExpandedSelectedBand] = useState(false);
  const [expandedCandidateKey, setExpandedCandidateKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeState>(null);
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [bandCopyState, setBandCopyState] = useState<CopyState>("idle");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadEvent = useCallback(() => {
    if (!eventId) {
      return;
    }

    getEventWithParticipants(eventId)
      .then((data) => {
        if (!data) {
          setLoadState("not-found");
          return;
        }

        const hydrated = hydrateEventData(data);
        setEventData(hydrated.event);
        setParticipantsData(hydrated.participants);
        setLoadState("loaded");
      })
      .catch((error) => {
        console.error(error);
        setLoadState("error");
      });
  }, [eventId]);

  useEffect(() => {
    loadEvent();
  }, [loadEvent]);

  const retryLoadEvent = () => {
    setLoadState("loading");
    loadEvent();
  };

  const selectedDateKeys = useMemo(
    () => [...new Set(timeSlots.map((slot) => slot.date))].sort(),
    [timeSlots]
  );
  const selectedDates = useMemo(
    () => selectedDateKeys.map((date) => dateOnlyToDate(date)),
    [selectedDateKeys]
  );

  const rows = useMemo(() => buildTimeBandRows(participantsData), [participantsData]);
  const candidates = useMemo(() => buildTopSegments(rows).slice(0, 3), [rows]);

  const responseCount = participantsData.length;
  const openBand = (band: TimeBandSegment | null) => {
    if (!band) {
      return;
    }

    setSelectedBand(band);
    setExpandedSelectedBand(false);

    const bandKey = getTimeBandKey(band.date, band.startHour);
    const elementId = window.matchMedia("(min-width: 1024px)").matches
      ? `time-band-desktop-${band.date}`
      : `time-band-mobile-${band.date}-${band.startHour}`;
    const element = document.getElementById(elementId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    setHighlightedKey(bandKey);
    window.setTimeout(() => setHighlightedKey(null), 2000);
  };

  const handleSelectDates = (dates: Date[] | undefined) => {
    const nextDates = dates ?? [];
    const normalizedDateKeys = [...new Set(nextDates.map((date) => dateToDateOnly(date)))].sort();

    const kept = timeSlots.filter((slot) =>
      normalizedDateKeys.includes(slot.date)
    );

    const keptDates = new Set(kept.map((slot) => slot.date));
    const additions = normalizedDateKeys
      .filter((date) => !keptDates.has(date))
      .slice(0, Math.max(0, MAX_RESPONSE_SLOTS - kept.length))
      .map((date) => createDefaultSlot(date));

    if (kept.length + additions.length < normalizedDateKeys.length) {
      setNotice({
        type: "error",
        message: `時間帯は${MAX_RESPONSE_SLOTS.toLocaleString("ja-JP")}件以内で選択してください。`,
      });
    }

    setTimeSlots([...kept, ...additions]);
  };

  const addTimeSlot = (date: DateOnly) => {
    if (timeSlots.length >= MAX_RESPONSE_SLOTS) {
      setNotice({
        type: "error",
        message: `時間帯は${MAX_RESPONSE_SLOTS.toLocaleString("ja-JP")}件以内で選択してください。`,
      });
      return;
    }

    setTimeSlots((previous) => [...previous, createDefaultSlot(date)]);
  };

  const updateTimeSlot = (id: string, field: TimeSlotField, value: string) => {
    setTimeSlots((previous) =>
      previous.map((slot) => (slot.id === id ? { ...slot, [field]: value } : slot))
    );
  };

  const removeTimeSlot = (id: string) => {
    setTimeSlots((previous) => previous.filter((slot) => slot.id !== id));
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1800);
    } catch (error) {
      console.error(error);
      setCopyState("error");
      window.setTimeout(() => setCopyState("idle"), 1800);
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
      window.setTimeout(() => setBandCopyState("idle"), 1800);
    } catch (error) {
      console.error(error);
      setBandCopyState("error");
      window.setTimeout(() => setBandCopyState("idle"), 1800);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

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

    if (!eventId) {
      setNotice({ type: "error", message: "イベントが見つかりません。" });
      return;
    }

    setIsSubmitting(true);
    setNotice(null);

    try {
      const result = await submitResponse(eventId, normalizedName, timeSlots);

      if (!result.ok) {
        setNotice({ type: "error", message: result.error });
        return;
      }

      const data = await getEventWithParticipants(eventId);
      if (data) {
        const hydrated = hydrateEventData(data);
        setParticipantsData(hydrated.participants);
      }

      setUserName("");
      setTimeSlots([]);
      // 再集計後は選択中の帯が古い人数・参加者を指し得るため解除する
      setSelectedBand(null);
      setExpandedSelectedBand(false);
      setNotice({
        type: "success",
        message: `${normalizedName}さんの希望日程を保存しました。`,
      });
    } catch (error) {
      console.error(error);
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "エラーが発生しました。",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleCandidateExpansion = (candidateKey: string) => {
    setExpandedCandidateKey((current) => (current === candidateKey ? null : candidateKey));
  };

  const toggleSelectedBandExpansion = () => {
    setExpandedSelectedBand((current) => !current);
  };

  if (!eventId || loadState === "not-found") {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p className="text-slate-500">イベントが見つかりません。</p>
      </div>
    );
  }

  if (loadState === "loading") {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p className="animate-pulse font-medium text-slate-500">イベントを読み込み中...</p>
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
        <p className="text-slate-500">イベントの読み込みに失敗しました。通信環境を確認してください。</p>
        <Button variant="outline" onClick={retryLoadEvent}>
          再読み込み
        </Button>
      </div>
    );
  }

  if (!eventData) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p className="text-slate-500">イベントが見つかりません。</p>
      </div>
    );
  }

  const eventStartDate = dateOnlyToDate(eventData.startDate);
  const eventEndDate = dateOnlyToDate(eventData.endDate);

  return (
    <div className="mx-auto max-w-6xl space-y-8 py-6">
      <EventOverviewHeader
        name={eventData.name}
        description={eventData.description}
        startDate={eventData.startDate}
        endDate={eventData.endDate}
        responseCount={responseCount}
        copyState={copyState}
        onCopyLink={handleCopyLink}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <ResponseForm
          eventStartDate={eventStartDate}
          eventEndDate={eventEndDate}
          selectedDates={selectedDates}
          selectedDateKeys={selectedDateKeys}
          timeSlots={timeSlots}
          userName={userName}
          notice={notice}
          isSubmitting={isSubmitting}
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
          onToggleCandidateExpansion={toggleCandidateExpansion}
          onToggleSelectedBandExpansion={toggleSelectedBandExpansion}
          onCopyBandSummary={handleCopyBandSummary}
          onClearSelectedBand={() => {
            setSelectedBand(null);
            setExpandedSelectedBand(false);
          }}
        />
      </div>

      <Card className="shadow-sm ring-2 ring-slate-200">
        <CardHeader className="border-b-2 border-slate-200 bg-slate-50/70 pb-4">
          <CardTitle className="text-xl font-bold text-slate-800">みんなの回答状況</CardTitle>
          <CardDescription>
            <span className="lg:hidden">
              時刻を縦に並べた帯で、重なりやすい時間がすぐ分かります。
            </span>
            <span className="hidden lg:inline">
              横に流れる時間帯の帯で、重なりやすい時間がすぐ分かります。
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <TimeBandHeatmap
            rows={rows}
            participantCount={responseCount}
            highlightedKey={highlightedKey}
            selectedBand={selectedBand}
            onSelectBand={openBand}
          />
          <div className="mt-8 border-t-2 border-slate-200 pt-6">
            <CalendarAvailabilityHeatmap
              startDate={eventData.startDate}
              endDate={eventData.endDate}
              rows={rows}
              participantCount={responseCount}
              selectedBand={selectedBand}
              onSelectBand={openBand}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

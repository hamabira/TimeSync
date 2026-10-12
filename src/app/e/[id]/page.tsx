"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
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
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import { getEventWithParticipants, submitResponse } from "@/app/actions";
import { createResponseDraftKey, usePwaDraft } from "@/lib/pwa-draft-protection";
import {
  BestCandidateSummary,
  CandidateSummaryPanel,
  SelectedBandDetails,
} from "./components/candidate-summary-panel";
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
  getBandSegmentAtHour,
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
  const [selectedBandTarget, setSelectedBand] = useState<Pick<TimeBandSegment, "date" | "startHour"> | null>(null);
  const [expandedSelectedBand, setExpandedSelectedBand] = useState(false);
  const [expandedCandidateKey, setExpandedCandidateKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeState>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const [slotErrors, setSlotErrors] = useState<Record<string, string>>({});
  const [hasSavedResponse, setHasSavedResponse] = useState(false);
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [bandCopyState, setBandCopyState] = useState<CopyState>("idle");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedDraftKey, setSavedDraftKey] = useState(() => createResponseDraftKey("", []));

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
  // Resolve selected details from current rows, including concurrent replies in a refresh.
  const selectedBand = useMemo(() => {
    if (!selectedBandTarget) return null;
    const row = rows.find((entry) => entry.date === selectedBandTarget.date);
    return row ? getBandSegmentAtHour(row, selectedBandTarget.startHour) : null;
  }, [rows, selectedBandTarget]);

  const responseCount = participantsData.length;
  const normalizedName = normalizeParticipantName(userName);
  const currentDraftKey = createResponseDraftKey(normalizedName, timeSlots);
  usePwaDraft(currentDraftKey !== savedDraftKey, isSubmitting);
  const existingParticipant = normalizedName
    ? participantsData.find((participant) => participant.name === normalizedName) ?? null
    : null;
  const openBand = (band: TimeBandSegment | null) => {
    if (!band) {
      return;
    }

    setSelectedBand({ date: band.date, startHour: band.startHour });
    setExpandedSelectedBand(false);
    setBandCopyState("idle");

    const bandKey = getTimeBandKey(band.date, band.startHour);
    setHighlightedKey(bandKey);
    window.requestAnimationFrame(() => {
      document.getElementById("selected-band-details")?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
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
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
          });
        }
      }
    });
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
    const nextSlots = [...kept, ...additions];
    const retainedSlotIds = new Set(nextSlots.map((slot) => slot.id));
    setSlotErrors((previous) =>
      Object.fromEntries(Object.entries(previous).filter(([slotId]) => retainedSlotIds.has(slotId)))
    );

    if (nextSlots.length < normalizedDateKeys.length) {
      setNotice({
        type: "error",
        message: `時間帯は${MAX_RESPONSE_SLOTS.toLocaleString("ja-JP")}件以内で選択してください。`,
      });
    } else {
      setNotice(null);
    }

    setTimeSlots(nextSlots);
  };

  const addTimeSlot = (date: DateOnly) => {
    if (timeSlots.length >= MAX_RESPONSE_SLOTS) {
      setNotice({
        type: "error",
        message: `時間帯は${MAX_RESPONSE_SLOTS.toLocaleString("ja-JP")}件以内で選択してください。`,
      });
      return;
    }

    setNotice(null);
    setTimeSlots((previous) => [...previous, createDefaultSlot(date)]);
  };

  const updateTimeSlot = (id: string, field: TimeSlotField, value: string) => {
    setTimeSlots((previous) =>
      previous.map((slot) => (slot.id === id ? { ...slot, [field]: value } : slot))
    );
    setSlotErrors((previous) => {
      if (!previous[id]) {
        return previous;
      }

      const next = { ...previous };
      delete next[id];
      return next;
    });
    setNotice(null);
  };

  const removeTimeSlot = (id: string) => {
    setTimeSlots((previous) => previous.filter((slot) => slot.id !== id));
    setSlotErrors((previous) => {
      if (!previous[id]) {
        return previous;
      }

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

    const loadedSlots = existingParticipant.timeSlots.map((slot) => ({
      ...slot,
      id: crypto.randomUUID(),
    }));
    setTimeSlots(loadedSlots);
    setSavedDraftKey(createResponseDraftKey(userName, loadedSlots));
    setSlotErrors({});
    setHasSavedResponse(false);
    setNotice({
      type: "success",
      message: "前回の回答を読み込みました。必要な変更を加えてから提出してください。",
    });
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin + window.location.pathname);
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

    if (submittingRef.current) {
      return;
    }

    const normalizedName = normalizeParticipantName(userName);

    const invalidSlots = timeSlots.filter(
      (slot) => !parseTimeRange(slot.startTime, slot.endTime)
    );
    setSlotErrors(
      Object.fromEntries(
        invalidSlots.map((slot) => [slot.id, "終了時刻は開始時刻より後にしてください。"])
      )
    );

    if (!normalizedName) {
      setNameError("お名前を入力してください。");
      setNotice({ type: "error", message: "お名前を入力してください。" });
      return;
    }

    if (timeSlots.length === 0) {
      setNotice({ type: "error", message: "時間帯を1件以上選択してください。" });
      return;
    }

    if (invalidSlots.length > 0) {
      setNotice({ type: "error", message: "赤く表示した時間帯を確認してください。入力内容は残っています。" });
      return;
    }

    if (!eventId) {
      setNotice({ type: "error", message: "イベントが見つかりません。" });
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    setNameError(null);
    setNotice(null);

    try {
      const submittedSlots = timeSlots.map(({ date, startTime, endTime }) => ({
        date,
        startTime,
        endTime,
      }));
      const result = await submitResponse(eventId, normalizedName, submittedSlots);

      if (!result.ok) {
        setNotice({ type: "error", message: result.error });
        return;
      }

      setSavedDraftKey(createResponseDraftKey(normalizedName, submittedSlots));
      setHasSavedResponse(true);
      const submittedParticipant = {
        id: existingParticipant?.id ?? crypto.randomUUID(),
        name: normalizedName,
        timeSlots: submittedSlots,
      };
      setParticipantsData((previous) => [
        ...previous.filter((participant) => participant.name !== normalizedName),
        submittedParticipant,
      ]);
      setSelectedBand(null);
      setExpandedSelectedBand(false);
      setBandCopyState("idle");
      setNotice({
        type: "success",
        message: `${normalizedName}さんの回答を保存しました。入力内容はこのまま残っています。`,
      });

      try {
        const data = await getEventWithParticipants(eventId);
        if (data) {
          const hydrated = hydrateEventData(data);
          setParticipantsData(hydrated.participants);
        } else {
          setNotice({
            type: "success",
            message: `${normalizedName}さんの回答は保存済みです。最新の回答状況を読み込めませんでした。時間をおいて再読み込みしてください。`,
          });
        }
      } catch (refreshError) {
        console.error(refreshError);
        setNotice({
          type: "success",
          message: `${normalizedName}さんの回答は保存済みです。最新の回答状況を読み込めませんでした。時間をおいて再読み込みしてください。`,
        });
      }
    } catch (error) {
      console.error(error);
      setNotice({
        type: "error",
        message: "回答を保存できませんでした。入力内容は残っています。通信を確認してもう一度お試しください。",
      });
    } finally {
      submittingRef.current = false;
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
    <div className="mx-auto w-full max-w-7xl space-y-5 py-2 lg:space-y-6 lg:py-4">
      <EventOverviewHeader
        name={eventData.name}
        description={eventData.description}
        startDate={eventData.startDate}
        endDate={eventData.endDate}
        responseCount={responseCount}
        copyState={copyState}
        onCopyLink={handleCopyLink}
      />

      <PwaInstallPrompt />

      <BestCandidateSummary
        candidate={candidates[0] ?? null}
        participantCount={responseCount}
        onView={() => {
          if (candidates[0]) {
            openBand(candidates[0]);
          }
        }}
      />

      <nav aria-label="ページ内移動" className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-1.5 sm:w-fit">
        <a
          href="#answer-section"
          className="inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          あなたの回答
        </a>
        <a
          href="#results-section"
          className="inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold text-blue-800 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          みんなの結果 <span className="ml-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs">{responseCount}</span>
        </a>
      </nav>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6">
        <ResponseForm
          eventStartDate={eventStartDate}
          eventEndDate={eventEndDate}
          selectedDates={selectedDates}
          selectedDateKeys={selectedDateKeys}
          timeSlots={timeSlots}
          userName={userName}
          notice={notice}
          nameError={nameError}
          slotErrors={slotErrors}
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
          participantCount={responseCount}
          selectedBand={selectedBand}
          expandedCandidateKey={expandedCandidateKey}
          onOpenBand={openBand}
          onToggleCandidateExpansion={toggleCandidateExpansion}
        />
      </div>

      <Card id="results-section" className="scroll-mt-24 shadow-sm ring-1 ring-slate-200">
        <CardHeader className="border-b border-slate-200 bg-slate-50/70 pb-4">
          <CardTitle className="text-xl font-bold text-slate-900">空き時間の重なり</CardTitle>
          <CardDescription>
            日付ごとの帯で、参加できる人が重なる時間を確認できます。
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <SelectedBandDetails
            selectedBand={selectedBand}
            participantCount={responseCount}
            expanded={expandedSelectedBand}
            copyState={bandCopyState}
            onToggleExpansion={toggleSelectedBandExpansion}
            onCopy={handleCopyBandSummary}
            onClear={() => {
              setSelectedBand(null);
              setExpandedSelectedBand(false);
              setBandCopyState("idle");
            }}
          />
          <TimeBandHeatmap
            rows={rows}
            participantCount={responseCount}
            highlightedKey={highlightedKey}
            selectedBand={selectedBand}
            onSelectBand={openBand}
          />
          <details className="mt-6 border-t border-slate-200 pt-4">
            <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-blue-800">
              カレンダーで日付ごとの重なりを見る
            </summary>
            <div className="pt-3">
            <CalendarAvailabilityHeatmap
              startDate={eventData.startDate}
              endDate={eventData.endDate}
              rows={rows}
              participantCount={responseCount}
              selectedBand={selectedBand}
              onSelectBand={openBand}
            />
            </div>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}

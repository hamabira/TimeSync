"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import {
  Calendar as CalendarIcon,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Copy,
  Link2,
  Trash2,
  Users,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TimeBandHeatmap } from "@/components/time-band-heatmap";
import { getEventWithParticipants, submitResponse } from "@/app/actions";
import {
  buildTimeBandRows,
  buildTopSegments,
  formatBandSummary,
  formatHourRange,
  formatParticipantLine,
  getTimeBandKey,
  MAX_RESPONSE_SLOTS,
  normalizeParticipantName,
  normalizeDateOnly,
  parseTimeRange,
  type EventWithParticipants,
  type TimeBandSegment,
} from "@/lib/scheduling";
import { cn } from "@/lib/utils";

type TimeSlotDraft = {
  id: string;
  date: Date;
  startTime: string;
  endTime: string;
};

type NoticeState =
  | {
      type: "success" | "error";
      message: string;
    }
  | null;

type CopyState = "idle" | "copied" | "error";

type LoadState = "loading" | "loaded" | "not-found" | "error";

function hydrateEventData(data: EventWithParticipants) {
  return {
    event: {
      ...data.event,
      startDate: normalizeDateOnly(new Date(data.event.startDate)),
      endDate: normalizeDateOnly(new Date(data.event.endDate)),
      createdAt: new Date(data.event.createdAt),
    },
    participants: data.participants.map((participant) => ({
      ...participant,
      timeSlots: participant.timeSlots.map((slot) => ({
        ...slot,
        date: normalizeDateOnly(new Date(slot.date)),
      })),
    })),
  } satisfies EventWithParticipants;
}

function createDefaultSlot(date: Date): TimeSlotDraft {
  return {
    id: crypto.randomUUID(),
    date: normalizeDateOnly(date),
    startTime: "19:00",
    endTime: "21:00",
  };
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

  const selectedDates = useMemo(() => {
    const unique = new Map<number, Date>();

    timeSlots.forEach((slot) => {
      unique.set(slot.date.getTime(), slot.date);
    });

    return [...unique.values()].sort((left, right) => left.getTime() - right.getTime());
  }, [timeSlots]);

  const rows = useMemo(() => buildTimeBandRows(participantsData), [participantsData]);
  const candidates = useMemo(() => buildTopSegments(rows).slice(0, 3), [rows]);

  const responseCount = participantsData.length;
  const selectedBandKey = selectedBand ? getTimeBandKey(selectedBand.date, selectedBand.startHour) : null;

  const openBand = (band: TimeBandSegment | null) => {
    if (!band) {
      return;
    }

    setSelectedBand(band);
    setExpandedSelectedBand(false);

    const bandKey = getTimeBandKey(band.date, band.startHour);
    const element = document.getElementById(`time-band-${band.date.getTime()}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    setHighlightedKey(bandKey);
    window.setTimeout(() => setHighlightedKey(null), 2000);
  };

  const handleSelectDates = (dates: Date[] | undefined) => {
    const nextDates = dates ?? [];
    const normalizedDates = nextDates.map((date) => normalizeDateOnly(date));

    const kept = timeSlots.filter((slot) =>
      normalizedDates.some((date) => date.getTime() === slot.date.getTime())
    );

    const keptDates = new Set(kept.map((slot) => slot.date.getTime()));
    const additions = normalizedDates
      .filter((date) => !keptDates.has(date.getTime()))
      .slice(0, Math.max(0, MAX_RESPONSE_SLOTS - kept.length))
      .map((date) => createDefaultSlot(date));

    if (kept.length + additions.length < normalizedDates.length) {
      setNotice({ type: "error", message: "時間帯は20件以内で選択してください。" });
    }

    setTimeSlots([...kept, ...additions]);
  };

  const addTimeSlot = (date: Date) => {
    if (timeSlots.length >= MAX_RESPONSE_SLOTS) {
      setNotice({ type: "error", message: "時間帯は20件以内で選択してください。" });
      return;
    }

    setTimeSlots((previous) => [...previous, createDefaultSlot(date)]);
  };

  const updateTimeSlot = (id: string, field: "startTime" | "endTime", value: string) => {
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
      `日付: ${format(selectedBand.date, "yyyy/MM/dd (E)", { locale: ja })}`,
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

  const handleSubmit = async (event: FormEvent) => {
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

  return (
    <div className="mx-auto max-w-6xl space-y-8 py-6">
      <section className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
              <CalendarDays className="h-4 w-4" />
              空き状況がすぐ分かる日程調整
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 lg:text-4xl">
                {eventData.name}
              </h1>
              {eventData.description ? (
                <p className="max-w-3xl whitespace-pre-wrap text-base leading-7 text-slate-600">
                  {eventData.description}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600">
                <CalendarIcon className="h-4 w-4" />
                {format(eventData.startDate, "yyyy/MM/dd", { locale: ja })} 〜{" "}
                {format(eventData.endDate, "yyyy/MM/dd", { locale: ja })}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600">
                <Users className="h-4 w-4" />
                回答 {responseCount} 件
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleCopyLink} className="h-11">
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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <Card className="shadow-sm ring-2 ring-slate-200">
          <CardHeader className="border-b-2 border-slate-200 bg-slate-50/70 pb-4">
            <CardTitle className="text-xl font-bold text-slate-800">
              1. 空いている日を選ぶ
            </CardTitle>
            <CardDescription>
              対象期間の中で、参加できる日をカレンダーから選んでください。
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-8 pt-6">
              {notice ? (
                <div
                  className={cn(
                    "rounded-lg border px-4 py-3 text-sm",
                    notice.type === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-rose-200 bg-rose-50 text-rose-800"
                  )}
                >
                  {notice.message}
                </div>
              ) : null}

              <div className="flex justify-center">
                <Calendar
                  mode="multiple"
                  selected={selectedDates}
                  onSelect={handleSelectDates}
                  defaultMonth={eventData.startDate}
                  startMonth={eventData.startDate}
                  endMonth={eventData.endDate}
                  disabled={[
                    { before: eventData.startDate },
                    { after: eventData.endDate },
                  ]}
                  numberOfMonths={1}
                  showOutsideDays={true}
                  fixedWeeks={true}
                  captionLayout="dropdown"
                  locale={ja}
                  className="border-0"
                />
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <Label className="text-base font-semibold text-slate-700">選択した日程</Label>
                  <p className="text-xs text-slate-500">
                    集計は1時間単位です。1時間にフルで参加できる時間帯だけがヒートマップに反映されます。
                    終了時刻の00:00は日末として扱います。
                  </p>
                </div>
                {selectedDates.length === 0 ? (
                  <div className="rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-400">
                    左のカレンダーから日付を選んでください
                  </div>
                ) : (
                  <div className="space-y-4">
                    {selectedDates.map((date) => {
                      const slotsForDate = timeSlots.filter(
                        (slot) => slot.date.getTime() === date.getTime()
                      );

                      return (
                        <div
                          key={date.toISOString()}
                          className="rounded-xl border-2 border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
                        >
                          <div className="flex items-center justify-between border-b-2 border-slate-200 px-4 py-3">
                            <div className="font-semibold text-slate-800">
                              {format(date, "M月d日(E)", { locale: ja })}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              type="button"
                              className="text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                              onClick={() => addTimeSlot(date)}
                              disabled={timeSlots.length >= MAX_RESPONSE_SLOTS}
                            >
                              + 時間を追加
                            </Button>
                          </div>

                          <div className="space-y-3 px-4 py-4">
                            {slotsForDate.length === 0 ? (
                              <div className="text-sm text-slate-400">
                                時間が指定されていません。時間を追加してください。
                              </div>
                            ) : (
                              slotsForDate.map((slot) => (
                                <div key={slot.id} className="flex flex-wrap items-center gap-2">
                                  <Clock3 className="h-4 w-4 shrink-0 text-slate-400" />
                                  <Input
                                    type="time"
                                    value={slot.startTime}
                                    onChange={(event) =>
                                      updateTimeSlot(slot.id, "startTime", event.target.value)
                                    }
                                    className="h-9 w-28"
                                  />
                                  <span className="shrink-0 text-slate-500">〜</span>
                                  <Input
                                    type="time"
                                    value={slot.endTime}
                                    onChange={(event) =>
                                      updateTimeSlot(slot.id, "endTime", event.target.value)
                                    }
                                    className="h-9 w-28"
                                  />
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    type="button"
                                    className="ml-auto text-slate-400 hover:bg-rose-50 hover:text-rose-500"
                                    onClick={() => removeTimeSlot(slot.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-3 border-t-2 border-slate-200 pt-6">
                <div className="flex items-center justify-between max-w-sm">
                  <Label htmlFor="userName" className="text-base font-semibold text-slate-700">
                    お名前 <span className="text-red-500">*</span>
                  </Label>
                  <span className="text-xs text-slate-400">{userName.length}/20</span>
                </div>
                <Input
                  id="userName"
                  placeholder="例: 山田太郎"
                  value={userName}
                  maxLength={20}
                  onChange={(event) => setUserName(event.target.value)}
                  className="h-12 max-w-sm"
                  required
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4 border-t-2 border-slate-200 bg-slate-50/70 p-6">
              <p className="text-sm leading-6 text-slate-500">
                回答した名前と空き時間は、このイベント URL を知る人に表示されます。{" "}
                <Link className="font-semibold text-blue-700 underline-offset-4 hover:underline" href="/terms">
                  利用規約
                </Link>
                と{" "}
                <Link className="font-semibold text-blue-700 underline-offset-4 hover:underline" href="/privacy">
                  プライバシーポリシー
                </Link>
                を確認してください。
              </p>
              <Button
                type="submit"
                className="h-12 w-full px-8 text-base font-bold"
                disabled={
                  !normalizeParticipantName(userName) || timeSlots.length === 0 || isSubmitting
                }
              >
                <CheckCircle2 className="mr-2 h-5 w-5" />
                {isSubmitting ? "保存中..." : "この内容で提出する"}
              </Button>
            </CardFooter>
          </form>
        </Card>

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
                  const candidateKey = `${candidate.date.getTime()}-${candidate.startHour}`;
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
                      onClick={() => openBand(candidate)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openBand(candidate);
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
                            {format(candidate.date, "M/d (E)", { locale: ja })}
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
                          onToggle={() => toggleCandidateExpansion(candidateKey)}
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
                        {format(selectedBand.date, "M/d (E)", { locale: ja })}
                      </div>
                      <div className="mt-1 text-base font-bold text-slate-900">
                        {formatBandSummary(selectedBand)}
                      </div>
                      <div className="mt-3">
                        <AttendeeChips
                          names={selectedBand.attendeeNames}
                          expanded={expandedSelectedBand}
                          onToggle={toggleSelectedBandExpansion}
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
                    onClick={handleCopyBandSummary}
                    disabled={!selectedBand}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    コピー
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={() => {
                      setSelectedBand(null);
                      setExpandedSelectedBand(false);
                    }}
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
      </div>

        <Card className="shadow-sm ring-2 ring-slate-200">
          <CardHeader className="border-b-2 border-slate-200 bg-slate-50/70 pb-4">
            <CardTitle className="text-xl font-bold text-slate-800">みんなの回答状況</CardTitle>
            <CardDescription>
              横に流れる時間帯の帯で、重なりやすい時間がすぐ分かります。
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
        </CardContent>
      </Card>
    </div>
  );
}

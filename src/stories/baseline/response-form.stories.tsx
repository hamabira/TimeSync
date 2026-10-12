import { useMemo, useState, type FormEventHandler } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ResponseForm } from "@/app/e/[id]/components/response-form";
import type { NoticeState, TimeSlotDraft, TimeSlotField } from "@/app/e/[id]/types";
import { dateOnlyToDate, dateToDateOnly } from "@/lib/date-only";
import { MAX_RESPONSE_SLOTS, normalizeParticipantName, parseTimeRange } from "@/lib/scheduling";
import { fixtureEvent, fixtureParticipants } from "../fixtures";

type ResponseFormReviewProps = {
  state: "success" | "error";
};

function ResponseFormReview({ state }: ResponseFormReviewProps) {
  const demoDate = "2026-10-14";
  const [userName, setUserName] = useState("さくら");
  const [timeSlots, setTimeSlots] = useState<TimeSlotDraft[]>(
    [
      {
        id: "response-form-review-slot",
        date: demoDate,
        startTime: state === "success" ? "19:00" : "21:00",
        endTime: state === "success" ? "21:00" : "19:00",
      },
    ]
  );
  const [notice, setNotice] = useState<NoticeState>(
    state === "success"
      ? { type: "success", message: "Storybook内の回答表示を保存しました。入力内容は残っています。" }
      : { type: "error", message: "赤く表示した時間帯を確認してください。入力内容は残っています。" }
  );
  const existingParticipant = fixtureParticipants.find((participant) => participant.name === userName) ?? null;
  const [slotErrors, setSlotErrors] = useState<Record<string, string>>(
    state === "success" ? {} : { "response-form-review-slot": "終了時刻は開始時刻より後にしてください。" }
  );
  const [hasSavedResponse, setHasSavedResponse] = useState(state === "success");
  const [nameError, setNameError] = useState<string | null>(null);

  const selectedDateKeys = useMemo(
    () => [...new Set(timeSlots.map((slot) => slot.date))].sort(),
    [timeSlots]
  );
  const selectedDates = useMemo(
    () => selectedDateKeys.map(dateOnlyToDate),
    [selectedDateKeys]
  );

  const handleSelectDates = (dates: Date[] | undefined) => {
    const nextDateKeys = [...new Set((dates ?? []).map(dateToDateOnly))].sort();
    const keptSlots = timeSlots.filter((slot) => nextDateKeys.includes(slot.date));
    const existingDates = new Set(keptSlots.map((slot) => slot.date));
    const additions = nextDateKeys
      .filter((date) => !existingDates.has(date))
      .slice(0, Math.max(0, MAX_RESPONSE_SLOTS - keptSlots.length))
      .map((date) => ({
        id: crypto.randomUUID(),
        date,
        startTime: "19:00",
        endTime: "21:00",
      }));

    setTimeSlots([...keptSlots, ...additions]);
    setNotice(null);
  };

  const handleAddTimeSlot = (date: TimeSlotDraft["date"]) => {
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
  };

  const handleUpdateTimeSlot = (id: string, field: TimeSlotField, value: string) => {
    setTimeSlots((previous) =>
      previous.map((slot) => (slot.id === id ? { ...slot, [field]: value } : slot))
    );
    setSlotErrors((previous) => {
      const next = { ...previous };
      delete next[id];
      return next;
    });
    setNotice(null);
  };

  const handleRemoveTimeSlot = (id: string) => {
    setTimeSlots((previous) => previous.filter((slot) => slot.id !== id));
    setSlotErrors((previous) => {
      const next = { ...previous };
      delete next[id];
      return next;
    });
    setNotice(null);
  };

  const handleSubmit: FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    const normalizedName = normalizeParticipantName(userName);
    const invalidSlots = timeSlots.filter((slot) => !parseTimeRange(slot.startTime, slot.endTime));
    setSlotErrors(Object.fromEntries(invalidSlots.map((slot) => [slot.id, "終了時刻は開始時刻より後にしてください。"])));

    if (!normalizedName) {
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

    setHasSavedResponse(true);
    setNotice({ type: "success", message: `Storybook内の${normalizedName}さんの回答表示を保存しました。入力内容は残っています。` });
  };

  const handleLoadPreviousResponse = () => {
    if (!existingParticipant) return;
    setTimeSlots(existingParticipant.timeSlots.map((slot) => ({ ...slot, id: crypto.randomUUID() })));
    setSlotErrors({});
    setHasSavedResponse(false);
    setNotice({ type: "success", message: "前回の回答を読み込みました。入力内容が置き換わりました。" });
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <p className="mb-4 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">
          Storybookプレビュー: 送信内容はこの画面の表示だけに反映されます。
        </p>
        <ResponseForm
          eventStartDate={dateOnlyToDate(fixtureEvent.startDate)}
          eventEndDate={dateOnlyToDate(fixtureEvent.endDate)}
          selectedDates={selectedDates}
          selectedDateKeys={selectedDateKeys}
          timeSlots={timeSlots}
          userName={userName}
          notice={notice}
          slotErrors={slotErrors}
          nameError={nameError}
          existingParticipant={existingParticipant}
          hasSavedResponse={hasSavedResponse}
          isSubmitting={false}
          onSubmit={handleSubmit}
          onSelectDates={handleSelectDates}
          onAddTimeSlot={handleAddTimeSlot}
          onUpdateTimeSlot={handleUpdateTimeSlot}
          onRemoveTimeSlot={handleRemoveTimeSlot}
          onUserNameChange={(value) => {
            setUserName(value);
            setNameError(null);
            setNotice(null);
            setHasSavedResponse(false);
          }}
          onLoadPreviousResponse={handleLoadPreviousResponse}
        />
      </div>
    </div>
  );
}

const meta = {
  title: "Review/Response form",
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Success: Story = {
  render: () => <ResponseFormReview state="success" />,
};

export const Error: Story = {
  render: () => <ResponseFormReview state="error" />,
};

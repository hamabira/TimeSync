import { useMemo, useState, type FormEventHandler } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ResponseForm } from "@/app/e/[id]/components/response-form";
import type { NoticeState, TimeSlotDraft, TimeSlotField } from "@/app/e/[id]/types";
import { dateOnlyToDate, dateToDateOnly } from "@/lib/date-only";
import { MAX_RESPONSE_SLOTS, normalizeParticipantName, parseTimeRange } from "@/lib/scheduling";
import { fixtureEvent } from "../fixtures";

type ResponseFormReviewProps = {
  state: "success" | "error";
};

function ResponseFormReview({ state }: ResponseFormReviewProps) {
  const demoDate = "2026-10-14";
  const [userName, setUserName] = useState(state === "success" ? "" : "さくら");
  const [selectedDates, setSelectedDates] = useState(
    state === "success" ? [] : [dateOnlyToDate(demoDate)]
  );
  const [timeSlots, setTimeSlots] = useState<TimeSlotDraft[]>(
    state === "success"
      ? []
      : [
          {
            id: "response-form-error-slot",
            date: demoDate,
            startTime: "21:00",
            endTime: "19:00",
          },
        ]
  );
  const [notice, setNotice] = useState<NoticeState>(
    state === "success"
      ? { type: "success", message: "さくらさんの希望日程を保存しました。" }
      : { type: "error", message: "開始時刻は終了時刻より前にしてください。" }
  );

  const selectedDateKeys = useMemo(
    () => [...new Set(timeSlots.map((slot) => slot.date))].sort(),
    [timeSlots]
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
    setSelectedDates(dates ?? []);
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
  };

  const handleRemoveTimeSlot = (id: string) => {
    setTimeSlots((previous) => previous.filter((slot) => slot.id !== id));
  };

  const handleSubmit: FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
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

    setNotice({ type: "success", message: `${normalizedName}さんの希望日程を保存しました。` });
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <ResponseForm
          eventStartDate={dateOnlyToDate(fixtureEvent.startDate)}
          eventEndDate={dateOnlyToDate(fixtureEvent.endDate)}
          selectedDates={selectedDates}
          selectedDateKeys={selectedDateKeys}
          timeSlots={timeSlots}
          userName={userName}
          notice={notice}
          isSubmitting={false}
          onSubmit={handleSubmit}
          onSelectDates={handleSelectDates}
          onAddTimeSlot={handleAddTimeSlot}
          onUpdateTimeSlot={handleUpdateTimeSlot}
          onRemoveTimeSlot={handleRemoveTimeSlot}
          onUserNameChange={setUserName}
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

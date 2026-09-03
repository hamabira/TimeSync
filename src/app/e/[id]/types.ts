import type { DateOnly } from "@/lib/date-only";

export type TimeSlotDraft = {
  id: string;
  date: DateOnly;
  startTime: string;
  endTime: string;
};

export type TimeSlotField = "startTime" | "endTime";

export type NoticeState =
  | {
      type: "success" | "error";
      message: string;
    }
  | null;

export type CopyState = "idle" | "copied" | "error";

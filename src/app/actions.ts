"use server";

import { getDb } from "@/db";
import { getEventParticipants } from "@/db/event";
import { events } from "@/db/schema";
import {
  isEventResponseLimitError,
  persistParticipantResponse,
} from "@/db/response";
import { eq } from "drizzle-orm";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { MAX_RESPONSE_SLOTS } from "@/lib/limits";
import {
  getTokyoDateKey,
  normalizeParticipantName,
  parseTimeRange,
  timeStringToMinutes,
} from "@/lib/scheduling";

type CreateEventInput = {
  name: string;
  description: string;
  startDate: Date;
  endDate: Date;
};

type SubmitResponseInput = {
  date: Date;
  startTime: string;
  endTime: string;
};

const MAX_EVENT_RANGE_DAYS = 93;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getDbFromRequest() {
  return getDb(getCloudflareContext().env);
}

function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function assertValidEventId(eventId: string) {
  if (!UUID_PATTERN.test(eventId)) {
    throw new Error("イベントが見つかりません。");
  }
}

export async function createEvent(data: CreateEventInput) {
  if (!data || typeof data.name !== "string" || typeof data.description !== "string") {
    throw new Error("イベント情報の形式が正しくありません。");
  }

  const name = data.name.trim();
  const description = data.description.trim();

  if (!name) {
    throw new Error("イベント名を入力してください。");
  }

  if (name.length > 50) {
    throw new Error("イベント名は50文字以内で入力してください。");
  }

  if (description.length > 200) {
    throw new Error("メモ・詳細は200文字以内で入力してください。");
  }

  if (!isValidDate(data.startDate) || !isValidDate(data.endDate)) {
    throw new Error("対象期間の日付が正しくありません。");
  }

  if (data.startDate.getTime() > data.endDate.getTime()) {
    throw new Error("対象期間の終了日は開始日より後にしてください。");
  }

  const rangeDays = Math.round(
    (data.endDate.getTime() - data.startDate.getTime()) / (24 * 60 * 60 * 1000)
  );

  if (rangeDays > MAX_EVENT_RANGE_DAYS) {
    throw new Error("対象期間は3か月以内で指定してください。");
  }

  const db = getDbFromRequest();
  const eventId = crypto.randomUUID();

  await db.insert(events).values({
    id: eventId,
    name,
    description: description || null,
    startDate: data.startDate,
    endDate: data.endDate,
    createdAt: new Date(),
  });

  return eventId;
}

export async function getEventWithParticipants(eventId: string) {
  if (typeof eventId !== "string" || !UUID_PATTERN.test(eventId)) {
    return null;
  }

  const db = getDbFromRequest();

  // イベント情報を取得
  const eventResult = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (eventResult.length === 0) return null;

  const event = eventResult[0];

  const participantsWithSlots = await getEventParticipants(db, eventId);

  return {
    event,
    participants: participantsWithSlots,
  };
}

export async function submitResponse(
  eventId: string,
  userName: string,
  slots: SubmitResponseInput[]
) {
  if (typeof eventId !== "string" || typeof userName !== "string" || !Array.isArray(slots)) {
    throw new Error("回答内容の形式が正しくありません。");
  }

  assertValidEventId(eventId);

  const normalizedName = normalizeParticipantName(userName);

  if (!normalizedName) {
    throw new Error("お名前を入力してください。");
  }

  if (normalizedName.length > 20) {
    throw new Error("お名前は20文字以内で入力してください。");
  }

  if (slots.length === 0) {
    throw new Error("時間帯を1件以上選択してください。");
  }

  if (slots.length > MAX_RESPONSE_SLOTS) {
    throw new Error("時間帯は20件以内で選択してください。");
  }

  const uniqueSlots = new Map<string, SubmitResponseInput>();

  for (const slot of slots) {
    if (
      typeof slot !== "object" ||
      slot === null ||
      typeof slot.startTime !== "string" ||
      typeof slot.endTime !== "string"
    ) {
      throw new Error("回答内容の形式が正しくありません。");
    }

    if (!isValidDate(slot.date)) {
      throw new Error("日付が正しくありません。");
    }

    const startMinutes = timeStringToMinutes(slot.startTime);
    const endMinutes = timeStringToMinutes(slot.endTime);

    if (startMinutes === null || endMinutes === null) {
      throw new Error("時間帯の形式が正しくありません。");
    }

    if (!parseTimeRange(slot.startTime, slot.endTime)) {
      throw new Error("開始時刻は終了時刻より前にしてください。");
    }

    const slotKey = `${getTokyoDateKey(slot.date)}-${slot.startTime}-${slot.endTime}`;
    uniqueSlots.set(slotKey, slot);
  }

  const validatedSlots = [...uniqueSlots.values()].map((slot) => {
    return {
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
    };
  });

  const db = getDbFromRequest();
  const eventResult = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (eventResult.length === 0) {
    throw new Error("イベントが見つかりません。");
  }

  const event = eventResult[0];
  const eventStartKey = getTokyoDateKey(event.startDate);
  const eventEndKey = getTokyoDateKey(event.endDate);

  for (const slot of validatedSlots) {
    const slotKey = getTokyoDateKey(slot.date);

    if (slotKey < eventStartKey || slotKey > eventEndKey) {
      throw new Error("日付が対象期間の範囲外です。");
    }
  }

  try {
    await persistParticipantResponse(db, eventId, normalizedName, validatedSlots);
  } catch (error) {
    if (isEventResponseLimitError(error)) {
      return { ok: false as const, error: error.message };
    }

    throw error;
  }

  return { ok: true as const };
}

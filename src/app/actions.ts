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
  compareDateOnly,
  isDateOnly,
  storedDateToDateOnly,
  validateDateOnlyRange,
  type DateOnly,
} from "@/lib/date-only";
import {
  normalizeParticipantName,
  parseTimeRange,
  timeStringToMinutes,
} from "@/lib/scheduling";

type CreateEventInput = {
  name: string;
  description: string;
  startDate: DateOnly;
  endDate: DateOnly;
};

type SubmitResponseInput = {
  date: DateOnly;
  startTime: string;
  endTime: string;
};

const MAX_EVENT_RANGE_DAYS = 93;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getDbFromRequest() {
  return getDb(getCloudflareContext().env);
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

  const validatedDateRange = validateDateOnlyRange(
    data.startDate,
    data.endDate,
    MAX_EVENT_RANGE_DAYS
  );

  const db = getDbFromRequest();
  const eventId = crypto.randomUUID();

  await db.insert(events).values({
    id: eventId,
    name,
    description: description || null,
    startDate: validatedDateRange.startDate,
    endDate: validatedDateRange.endDate,
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

  const event = {
    ...eventResult[0],
    startDate: storedDateToDateOnly(eventResult[0].startDate),
    endDate: storedDateToDateOnly(eventResult[0].endDate),
  };

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
    throw new Error(
      `時間帯は${MAX_RESPONSE_SLOTS.toLocaleString("ja-JP")}件以内で選択してください。`
    );
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

    if (!isDateOnly(slot.date)) {
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

    const slotKey = `${slot.date}-${slot.startTime}-${slot.endTime}`;
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

  const eventStartKey = storedDateToDateOnly(eventResult[0].startDate);
  const eventEndKey = storedDateToDateOnly(eventResult[0].endDate);

  for (const slot of validatedSlots) {
    const slotKey = slot.date;

    if (
      compareDateOnly(slotKey, eventStartKey) < 0 ||
      compareDateOnly(slotKey, eventEndKey) > 0
    ) {
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

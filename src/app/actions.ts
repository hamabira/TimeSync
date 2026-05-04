"use server";

import { getDb } from "@/db";
import { events, participants, timeSlots } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";

import { getRequestContext } from "@cloudflare/next-on-pages";
import {
  EventWithParticipants,
  normalizeParticipantName,
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

function getDbFromRequest() {
  return getDb(getRequestContext().env);
}

export async function createEvent(data: CreateEventInput) {
  const db = getDbFromRequest();
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

  if (data.startDate.getTime() > data.endDate.getTime()) {
    throw new Error("対象期間の終了日は開始日より後にしてください。");
  }

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
  const db = getDbFromRequest();

  // イベント情報を取得
  const eventResult = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (eventResult.length === 0) return null;

  const event = eventResult[0];

  // 参加者と回答を取得
  const participantsResult = await db.select().from(participants).where(eq(participants.eventId, eventId));

  const participantIds = participantsResult.map((participant) => participant.id);
  const allTimeSlots =
    participantIds.length > 0
      ? await db
          .select()
          .from(timeSlots)
          .where(inArray(timeSlots.participantId, participantIds))
      : [];

  const participantsWithSlots: EventWithParticipants["participants"] = participantsResult.map(
    (participant) => ({
      id: participant.id,
      name: participant.name,
      timeSlots: allTimeSlots
        .filter((slot) => slot.participantId === participant.id)
        .map((slot) => ({
          date: slot.date,
          startTime: slot.startTime,
          endTime: slot.endTime,
        })),
    })
  );

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
  const db = getDbFromRequest();
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

  const validatedSlots = slots.map((slot) => {
    const startMinutes = timeStringToMinutes(slot.startTime);
    const endMinutes = timeStringToMinutes(slot.endTime);

    if (startMinutes === null || endMinutes === null) {
      throw new Error("時間帯の形式が正しくありません。");
    }

    if (startMinutes >= endMinutes) {
      throw new Error("開始時刻は終了時刻より前にしてください。");
    }

    if (!(slot.date instanceof Date) || Number.isNaN(slot.date.getTime())) {
      throw new Error("日付が正しくありません。");
    }

    return {
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
    };
  });

  const eventResult = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (eventResult.length === 0) {
    throw new Error("イベントが見つかりません。");
  }

  await db.transaction(async (tx) => {
    const existingParticipants = await tx
      .select({ id: participants.id })
      .from(participants)
      .where(and(eq(participants.eventId, eventId), eq(participants.name, normalizedName)));

    const existingParticipantIds = existingParticipants.map((participant) => participant.id);

    if (existingParticipantIds.length > 0) {
      await tx.delete(timeSlots).where(inArray(timeSlots.participantId, existingParticipantIds));
      await tx.delete(participants).where(inArray(participants.id, existingParticipantIds));
    }

    const participantId = crypto.randomUUID();

    await tx.insert(participants).values({
      id: participantId,
      eventId,
      name: normalizedName,
    });

    await tx.insert(timeSlots).values(
      validatedSlots.map((slot) => ({
        id: crypto.randomUUID(),
        participantId,
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
      }))
    );
  });

  return true;
}

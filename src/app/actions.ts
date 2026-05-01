"use server";

import { getDb } from "@/db";
import { events, participants, timeSlots } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";

import { getRequestContext } from "@cloudflare/next-on-pages";

export async function createEvent(data: { name: string; description: string; startDate: Date; endDate: Date }) {
  const db = getDb(getRequestContext().env); 

  const eventId = crypto.randomUUID();
  
  await db.insert(events).values({
    id: eventId,
    name: data.name,
    description: data.description,
    startDate: data.startDate,
    endDate: data.endDate,
    createdAt: new Date(),
  });

  return eventId;
}

export async function getEventWithParticipants(eventId: string) {
  const db = getDb(getRequestContext().env);

  // イベント情報を取得
  const eventResult = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (eventResult.length === 0) return null;

  const event = eventResult[0];

  // 参加者と回答を取得
  const participantsResult = await db.select().from(participants).where(eq(participants.eventId, eventId));
  
  let allTimeSlots: any[] = [];
  if (participantsResult.length > 0) {
    allTimeSlots = await db.select().from(timeSlots).where(inArray(timeSlots.participantId, participantsResult.map(p => p.id)));
  }
  
  // ネストした形式に整形
  const participantsWithSlots = participantsResult.map(p => ({
    ...p,
    timeSlots: allTimeSlots.filter(s => s.participantId === p.id),
  }));

  return { event, participants: participantsWithSlots };
}

export async function submitResponse(eventId: string, userName: string, slots: { date: Date; startTime: string; endTime: string }[]) {
  const db = getDb(getRequestContext().env);
  const participantId = crypto.randomUUID();

  await db.insert(participants).values({
    id: participantId,
    eventId,
    name: userName,
  });

  if (slots.length > 0) {
    const timeSlotsData = slots.map(slot => ({
      id: crypto.randomUUID(),
      participantId,
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
    }));

    await db.insert(timeSlots).values(timeSlotsData);
  }

  return true;
}

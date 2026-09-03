import { asc, eq, inArray } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";

import { MAX_EVENT_PARTICIPANTS, MAX_EVENT_SLOTS } from "../lib/limits.ts";
import type { EventWithParticipants, TimeSlotRecord } from "../lib/scheduling.ts";
import * as schema from "./schema.ts";

type AppDb = DrizzleD1Database<typeof schema>;

type ParticipantQueryRow = {
  id: string;
  name: string;
};

type TimeSlotQueryRow = {
  participantId: string;
  date: Date;
  startTime: string;
  endTime: string;
};

/**
 * Group slots once and then attach each participant's list once: O(P + S),
 * where P is the participant row count and S is the slot row count.
 */
export function formatParticipantsWithSlots(
  participantsResult: readonly ParticipantQueryRow[],
  allTimeSlots: readonly TimeSlotQueryRow[]
): EventWithParticipants["participants"] {
  const slotsByParticipant = new Map<string, TimeSlotRecord[]>();

  for (const slot of allTimeSlots) {
    const list = slotsByParticipant.get(slot.participantId) ?? [];
    list.push({ date: slot.date, startTime: slot.startTime, endTime: slot.endTime });
    slotsByParticipant.set(slot.participantId, list);
  }

  return participantsResult.map((participant) => ({
    id: participant.id,
    name: participant.name,
    timeSlots: slotsByParticipant.get(participant.id) ?? [],
  }));
}

/**
 * Read the event's participant data with hard row bounds. The ORDER BY clauses
 * make the bounded result deterministic even when legacy data exceeds a limit.
 */
export async function getEventParticipants(db: AppDb, eventId: string) {
  const participantsResult = await db
    .select()
    .from(schema.participants)
    .where(eq(schema.participants.eventId, eventId))
    .orderBy(asc(schema.participants.name), asc(schema.participants.id))
    .limit(MAX_EVENT_PARTICIPANTS);

  const participantIds = participantsResult.map((participant) => participant.id);
  const allTimeSlots =
    participantIds.length > 0
      ? await db
          .select()
          .from(schema.timeSlots)
          .where(inArray(schema.timeSlots.participantId, participantIds))
          .orderBy(
            asc(schema.timeSlots.participantId),
            asc(schema.timeSlots.date),
            asc(schema.timeSlots.startTime),
            asc(schema.timeSlots.endTime),
            asc(schema.timeSlots.id)
          )
          .limit(MAX_EVENT_SLOTS)
      : [];

  return formatParticipantsWithSlots(participantsResult, allTimeSlots);
}

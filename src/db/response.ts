import { and, eq, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";

import * as schema from "./schema.ts";

const { participants, timeSlots } = schema;

type AppDb = DrizzleD1Database<typeof schema>;

export type ParticipantResponseSlot = {
  date: Date;
  startTime: string;
  endTime: string;
};

/**
 * Replace one participant's complete response in a single D1 batch.
 *
 * The participant upsert is deliberately the first statement. The two following
 * statements resolve the participant ID from the unique (event_id, name) key in
 * SQL, so no participant ID read can become stale between requests. D1 executes
 * the batch as one transaction, so a failed slot insert also rolls back the
 * participant upsert and slot deletion.
 */
export async function persistParticipantResponse(
  db: AppDb,
  eventId: string,
  participantName: string,
  slots: readonly ParticipantResponseSlot[]
) {
  if (slots.length === 0) {
    throw new Error("回答には時間帯が1件以上必要です。");
  }

  const participantIdForResponse = sql<string>`(
    select ${participants.id}
    from ${participants}
    where ${and(eq(participants.eventId, eventId), eq(participants.name, participantName))}
    limit 1
  )`;

  const upsertParticipant = db
    .insert(participants)
    .values({
      id: crypto.randomUUID(),
      eventId,
      name: participantName,
    })
    .onConflictDoUpdate({
      target: [participants.eventId, participants.name],
      set: { name: participantName },
    });

  const deleteExistingSlots = db
    .delete(timeSlots)
    .where(eq(timeSlots.participantId, participantIdForResponse));

  const insertNewSlots = db.insert(timeSlots).values(
    slots.map((slot) => ({
      id: crypto.randomUUID(),
      participantId: participantIdForResponse,
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
    }))
  );

  await db.batch([upsertParticipant, deleteExistingSlots, insertNewSlots]);
}

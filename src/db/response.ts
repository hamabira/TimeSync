import { and, eq, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";

import {
  MAX_EVENT_PARTICIPANTS,
  MAX_EVENT_SLOTS,
} from "../lib/limits.ts";
import * as schema from "./schema.ts";

const { participants, timeSlots } = schema;

type AppDb = DrizzleD1Database<typeof schema>;

const PARTICIPANT_LIMIT_ERROR_CODE = "AKIMATCH_EVENT_PARTICIPANTS_LIMIT";
const SLOT_LIMIT_ERROR_CODE = "AKIMATCH_EVENT_SLOTS_LIMIT";

export class EventResponseLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EventResponseLimitError";
  }
}

export function isEventResponseLimitError(
  error: unknown
): error is EventResponseLimitError {
  return error instanceof EventResponseLimitError;
}

export type ParticipantResponseSlot = {
  date: Date;
  startTime: string;
  endTime: string;
};

function getDatabaseErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const message = error.message;
    return typeof message === "string" ? message : null;
  }

  return null;
}

function getUserFacingLimitError(error: unknown) {
  const message = getDatabaseErrorMessage(error);

  if (message?.includes(PARTICIPANT_LIMIT_ERROR_CODE)) {
    return new EventResponseLimitError(
      `このイベントは参加者数の上限（${MAX_EVENT_PARTICIPANTS}人）に達しています。`
    );
  }

  if (message?.includes(SLOT_LIMIT_ERROR_CODE)) {
    return new EventResponseLimitError(
      `このイベントの回答枠が上限（${MAX_EVENT_SLOTS.toLocaleString("ja-JP")}件）に達しています。`
    );
  }

  return null;
}

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

  try {
    await db.batch([upsertParticipant, deleteExistingSlots, insertNewSlots]);
  } catch (error) {
    const userFacingError = getUserFacingLimitError(error);

    if (userFacingError) {
      throw userFacingError;
    }

    throw error;
  }
}

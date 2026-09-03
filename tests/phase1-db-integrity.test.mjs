import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

import * as schema from "../src/db/schema.ts";
import { persistParticipantResponse } from "../src/db/response.ts";

const baseMigration = readFileSync(
  new URL("../drizzle/0000_ancient_sentinels.sql", import.meta.url),
  "utf8"
);
const phase1Migration = readFileSync(
  new URL("../drizzle/20260903165745_ancient_leo.sql", import.meta.url),
  "utf8"
);

const eventId = "11111111-1111-4111-8111-111111111111";
const secondEventId = "22222222-2222-4222-8222-222222222222";

class LocalD1Statement {
  constructor(database, query) {
    this.database = database;
    this.query = query;
    this.parameters = [];
  }

  bind(...parameters) {
    this.parameters = parameters;
    return this;
  }

  run() {
    const result = this.database.prepare(this.query).run(...this.parameters);
    return Promise.resolve({
      success: true,
      results: [],
      meta: {
        changes: Number(result.changes),
        last_row_id: Number(result.lastInsertRowid),
      },
    });
  }

  all() {
    const results = this.database.prepare(this.query).all(...this.parameters);
    return Promise.resolve({ success: true, results, meta: {} });
  }

  raw() {
    const results = this.database
      .prepare(this.query)
      .all(...this.parameters)
      .map((row) => Object.values(row));
    return Promise.resolve(results);
  }

  first() {
    return this.all().then((result) => result.results[0] ?? null);
  }
}

class LocalD1Database {
  constructor() {
    this.database = new DatabaseSync(":memory:");
    this.database.exec("PRAGMA foreign_keys = ON");
    this.batchQueue = Promise.resolve();
  }

  prepare(query) {
    return new LocalD1Statement(this.database, query);
  }

  batch(statements) {
    const operation = this.batchQueue.then(async () => {
      this.database.exec("BEGIN");

      try {
        const results = [];
        for (const statement of statements) {
          results.push(await statement.run());
        }
        this.database.exec("COMMIT");
        return results;
      } catch (error) {
        this.database.exec("ROLLBACK");
        throw error;
      }
    });

    this.batchQueue = operation.catch(() => undefined);
    return operation;
  }
}

function createDatabase({ applyPhase1 = true } = {}) {
  const local = new LocalD1Database();
  local.database.exec(baseMigration);
  if (applyPhase1) {
    local.database.exec(phase1Migration);
  }
  return local;
}

function seedEvent(local, id = eventId) {
  local.database
    .prepare(
      "INSERT INTO events (id, name, start_date, end_date, created_at) VALUES (?, ?, ?, ?, ?)"
    )
    .run(id, "Event", 1780000000, 1781000000, 1780000000);
}

function createAppDb(local) {
  return drizzle(local, { schema });
}

function responseFingerprint(rows) {
  return rows
    .map((row) => [row.date.toISOString(), row.startTime, row.endTime])
    .sort((left, right) => left.join(" ").localeCompare(right.join(" ")));
}

async function getParticipantRows(db) {
  return db.select().from(schema.participants).where(eq(schema.participants.eventId, eventId));
}

async function getSlotsForParticipant(db, participantId) {
  const rows = await db
    .select()
    .from(schema.timeSlots)
    .where(eq(schema.timeSlots.participantId, participantId));
  return responseFingerprint(rows);
}

function explainDetails(local, query, parameters) {
  return local.database
    .prepare(`EXPLAIN QUERY PLAN ${query}`)
    .all(...parameters)
    .map((row) => row.detail);
}

test("a response overwrite keeps the participant ID and replaces all slots", async () => {
  const local = createDatabase();
  seedEvent(local);
  const db = createAppDb(local);

  await persistParticipantResponse(db, eventId, "Alice", [
    { date: new Date("2026-08-13T00:00:00.000Z"), startTime: "09:00", endTime: "10:00" },
    { date: new Date("2026-08-14T00:00:00.000Z"), startTime: "11:00", endTime: "12:00" },
  ]);

  const [firstParticipant] = await getParticipantRows(db);
  assert.ok(firstParticipant);
  assert.deepEqual(await getSlotsForParticipant(db, firstParticipant.id), [
    ["2026-08-13T00:00:00.000Z", "09:00", "10:00"],
    ["2026-08-14T00:00:00.000Z", "11:00", "12:00"],
  ]);

  await persistParticipantResponse(db, eventId, "Alice", [
    { date: new Date("2026-08-15T00:00:00.000Z"), startTime: "13:00", endTime: "14:00" },
  ]);

  const participants = await getParticipantRows(db);
  assert.equal(participants.length, 1);
  assert.equal(participants[0].id, firstParticipant.id);
  assert.deepEqual(await getSlotsForParticipant(db, participants[0].id), [
    ["2026-08-15T00:00:00.000Z", "13:00", "14:00"],
  ]);
});

test("concurrent same-name submissions leave one complete response set", async () => {
  const local = createDatabase();
  seedEvent(local);
  const db = createAppDb(local);

  await persistParticipantResponse(db, eventId, "Alice", [
    { date: new Date("2026-08-12T00:00:00.000Z"), startTime: "08:00", endTime: "09:00" },
  ]);
  const [initialParticipant] = await getParticipantRows(db);

  const responseA = [
    { date: new Date("2026-08-13T00:00:00.000Z"), startTime: "09:00", endTime: "11:00" },
    { date: new Date("2026-08-14T00:00:00.000Z"), startTime: "12:00", endTime: "13:00" },
  ];
  const responseB = [
    { date: new Date("2026-08-15T00:00:00.000Z"), startTime: "18:00", endTime: "20:00" },
  ];

  await Promise.all([
    persistParticipantResponse(db, eventId, "Alice", responseA),
    persistParticipantResponse(db, eventId, "Alice", responseB),
  ]);

  const participants = await getParticipantRows(db);
  assert.equal(participants.length, 1);
  assert.equal(participants[0].id, initialParticipant.id);

  const actualSlots = await getSlotsForParticipant(db, participants[0].id);
  const completeResponses = [responseA, responseB].map(responseFingerprint);
  assert.ok(
    completeResponses.some((response) => JSON.stringify(actualSlots) === JSON.stringify(response)),
    `unexpected mixed response: ${JSON.stringify(actualSlots)}`
  );
  assert.notDeepEqual(actualSlots, [
    ["2026-08-12T00:00:00.000Z", "08:00", "09:00"],
  ]);
});

test("the phase 1 migration deterministically keeps only the max-rowid participant slots", () => {
  const local = createDatabase({ applyPhase1: false });
  seedEvent(local);
  seedEvent(local, secondEventId);

  const insertParticipant = local.database.prepare(
    "INSERT INTO participants (id, event_id, name) VALUES (?, ?, ?)"
  );
  insertParticipant.run("alice-old", eventId, "Alice");
  insertParticipant.run("alice-middle", eventId, "Alice");
  insertParticipant.run("alice-survivor", eventId, "Alice");
  insertParticipant.run("bob", eventId, "Bob");
  insertParticipant.run("alice-other-event", secondEventId, "Alice");

  const insertSlot = local.database.prepare(
    "INSERT INTO time_slots (id, participant_id, date, start_time, end_time) VALUES (?, ?, ?, ?, ?)"
  );
  insertSlot.run("old-slot", "alice-old", 1780000000, "08:00", "09:00");
  insertSlot.run("middle-slot", "alice-middle", 1780000000, "10:00", "11:00");
  insertSlot.run("survivor-slot-1", "alice-survivor", 1780000000, "12:00", "13:00");
  insertSlot.run("survivor-slot-2", "alice-survivor", 1780086400, "14:00", "15:00");

  assert.doesNotThrow(() => local.database.exec(phase1Migration));

  const remainingParticipants = local.database
    .prepare("SELECT id, event_id, name FROM participants ORDER BY id")
    .all()
    .map((row) => ({ ...row }));
  assert.deepEqual(remainingParticipants, [
    { id: "alice-other-event", event_id: secondEventId, name: "Alice" },
    { id: "alice-survivor", event_id: eventId, name: "Alice" },
    { id: "bob", event_id: eventId, name: "Bob" },
  ]);

  const remainingSlots = local.database
    .prepare("SELECT id, participant_id, start_time, end_time FROM time_slots ORDER BY id")
    .all()
    .map((row) => ({ ...row }));
  assert.deepEqual(remainingSlots, [
    { id: "survivor-slot-1", participant_id: "alice-survivor", start_time: "12:00", end_time: "13:00" },
    { id: "survivor-slot-2", participant_id: "alice-survivor", start_time: "14:00", end_time: "15:00" },
  ]);

  assert.throws(
    () => insertParticipant.run("alice-duplicate", eventId, "Alice"),
    /UNIQUE constraint failed/
  );
});

test("participant and time slot lookups use SEARCH plans", () => {
  const local = createDatabase();
  const participantDetails = explainDetails(
    local,
    "SELECT id FROM participants WHERE event_id = ?",
    [eventId]
  );
  const timeSlotDetails = explainDetails(
    local,
    "SELECT id FROM time_slots WHERE participant_id = ?",
    ["alice-survivor"]
  );

  assert.ok(
    participantDetails.some(
      (detail) =>
        /\bSEARCH\b/.test(detail) && detail.includes("participants_event_id_name_unique")
    ),
    participantDetails
  );
  assert.ok(
    timeSlotDetails.some(
      (detail) => /\bSEARCH\b/.test(detail) && detail.includes("time_slots_participant_id_idx")
    ),
    timeSlotDetails
  );
  assert.ok(!participantDetails.some((detail) => /\bSCAN\b/.test(detail)), participantDetails);
  assert.ok(!timeSlotDetails.some((detail) => /\bSCAN\b/.test(detail)), timeSlotDetails);
});

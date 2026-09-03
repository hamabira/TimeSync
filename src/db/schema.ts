import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const events = sqliteTable("events", {
  id: text("id").primaryKey(), // 予測不可能なURLにするためのUUID等
  name: text("name").notNull(),
  description: text("description"),
  startDate: text("start_date").notNull(), // YYYY-MM-DD の date-only 値
  endDate: text("end_date").notNull(), // YYYY-MM-DD の date-only 値
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const participants = sqliteTable(
  "participants",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
  },
  (table) => [uniqueIndex("participants_event_id_name_unique").on(table.eventId, table.name)]
);

export const timeSlots = sqliteTable(
  "time_slots",
  {
    id: text("id").primaryKey(),
    participantId: text("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
    date: text("date").notNull(), // YYYY-MM-DD の date-only 値
    startTime: text("start_time").notNull(), // "HH:MM" 形式
    endTime: text("end_time").notNull(),
  },
  (table) => [index("time_slots_participant_id_idx").on(table.participantId)]
);

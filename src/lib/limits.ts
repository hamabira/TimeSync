/**
 * Event-wide limits are enforced again by the SQLite triggers in
 * drizzle/20260904120000_event_limits.sql. Keep those SQL literals in sync
 * with these constants when either limit changes.
 */
export const MAX_RESPONSE_SLOTS = 20;
export const MAX_EVENT_PARTICIPANTS = 100;
export const MAX_EVENT_SLOTS = MAX_RESPONSE_SLOTS * MAX_EVENT_PARTICIPANTS;

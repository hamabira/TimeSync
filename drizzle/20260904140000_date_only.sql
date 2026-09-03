-- Calendar dates are date-only values. The legacy schema stored them as
-- Drizzle's `timestamp` integer (Unix seconds) representing Tokyo midnight.
-- Convert those values explicitly in SQLite before replacing the columns.
CREATE TABLE `__akimatch_events_date_only` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__akimatch_events_date_only` (`id`, `name`, `description`, `start_date`, `end_date`, `created_at`)
SELECT
	`id`,
	`name`,
	`description`,
	CASE
		WHEN typeof(`start_date`) IN ('integer', 'real')
			THEN strftime('%Y-%m-%d', `start_date`, 'unixepoch', '+9 hours')
		ELSE `start_date`
	END,
	CASE
		WHEN typeof(`end_date`) IN ('integer', 'real')
			THEN strftime('%Y-%m-%d', `end_date`, 'unixepoch', '+9 hours')
		ELSE `end_date`
	END,
	`created_at`
FROM `events`;
--> statement-breakpoint
CREATE TABLE `__akimatch_participants_date_only` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__akimatch_participants_date_only` (`id`, `event_id`, `name`)
SELECT `id`, `event_id`, `name`
FROM `participants`;
--> statement-breakpoint
CREATE TABLE `__akimatch_time_slots_date_only` (
	`id` text PRIMARY KEY NOT NULL,
	`participant_id` text NOT NULL,
	`date` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__akimatch_time_slots_date_only` (`id`, `participant_id`, `date`, `start_time`, `end_time`)
SELECT
	`id`,
	`participant_id`,
	CASE
		WHEN typeof(`date`) IN ('integer', 'real')
			THEN strftime('%Y-%m-%d', `date`, 'unixepoch', '+9 hours')
		ELSE `date`
	END,
	`start_time`,
	`end_time`
FROM `time_slots`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `participants_event_limit_before_insert`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `time_slots_event_limit_before_insert`;
--> statement-breakpoint
DROP INDEX IF EXISTS `participants_event_id_name_unique`;
--> statement-breakpoint
DROP INDEX IF EXISTS `time_slots_participant_id_idx`;
--> statement-breakpoint
DROP TABLE `time_slots`;
--> statement-breakpoint
DROP TABLE `participants`;
--> statement-breakpoint
DROP TABLE `events`;
--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `events` (`id`, `name`, `description`, `start_date`, `end_date`, `created_at`)
SELECT `id`, `name`, `description`, `start_date`, `end_date`, `created_at`
FROM `__akimatch_events_date_only`;
--> statement-breakpoint
CREATE TABLE `participants` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`name` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `participants` (`id`, `event_id`, `name`)
SELECT `id`, `event_id`, `name`
FROM `__akimatch_participants_date_only`;
--> statement-breakpoint
CREATE TABLE `time_slots` (
	`id` text PRIMARY KEY NOT NULL,
	`participant_id` text NOT NULL,
	`date` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `time_slots` (`id`, `participant_id`, `date`, `start_time`, `end_time`)
SELECT `id`, `participant_id`, `date`, `start_time`, `end_time`
FROM `__akimatch_time_slots_date_only`;
--> statement-breakpoint
DROP TABLE `__akimatch_time_slots_date_only`;
--> statement-breakpoint
DROP TABLE `__akimatch_participants_date_only`;
--> statement-breakpoint
DROP TABLE `__akimatch_events_date_only`;
--> statement-breakpoint
CREATE UNIQUE INDEX `participants_event_id_name_unique` ON `participants` (`event_id`,`name`);
--> statement-breakpoint
CREATE INDEX `time_slots_participant_id_idx` ON `time_slots` (`participant_id`);
--> statement-breakpoint
CREATE TRIGGER `participants_event_limit_before_insert`
BEFORE INSERT ON `participants`
WHEN NOT EXISTS (
	SELECT 1
	FROM `participants`
	WHERE `event_id` = NEW.`event_id`
		AND `name` = NEW.`name`
)
	AND (
		SELECT COUNT(*)
		FROM `participants`
		WHERE `event_id` = NEW.`event_id`
	) >= 100
BEGIN
	SELECT RAISE(ABORT, 'AKIMATCH_EVENT_PARTICIPANTS_LIMIT');
END;
--> statement-breakpoint
CREATE TRIGGER `time_slots_event_limit_before_insert`
BEFORE INSERT ON `time_slots`
WHEN (
	SELECT COUNT(*)
	FROM `time_slots` AS existing_slot
	INNER JOIN `participants` AS participant
		ON participant.`id` = existing_slot.`participant_id`
	WHERE participant.`event_id` = (
		SELECT `event_id`
		FROM `participants`
		WHERE `id` = NEW.`participant_id`
		LIMIT 1
	)
) >= 2000
BEGIN
	SELECT RAISE(ABORT, 'AKIMATCH_EVENT_SLOTS_LIMIT');
END;

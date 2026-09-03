-- Compatibility cleanup for databases created before the participant identity constraint.
-- There is no response timestamp, so the participant with the greatest implicit rowid
-- for each (event_id, name) pair is the deterministic survivor. Delete every duplicate's
-- slots first, then delete the duplicate participant itself; only the survivor's complete
-- slot set is retained, and slot sets are never merged across participants.
DELETE FROM `time_slots`
WHERE `participant_id` IN (
	SELECT duplicate.`id`
	FROM `participants` AS duplicate
	WHERE EXISTS (
		SELECT 1
		FROM `participants` AS survivor
		WHERE survivor.`event_id` = duplicate.`event_id`
			AND survivor.`name` = duplicate.`name`
			AND survivor.`rowid` > duplicate.`rowid`
	)
);--> statement-breakpoint
DELETE FROM `participants`
WHERE EXISTS (
	SELECT 1
	FROM `participants` AS survivor
	WHERE survivor.`event_id` = `participants`.`event_id`
		AND survivor.`name` = `participants`.`name`
		AND survivor.`rowid` > `participants`.`rowid`
);--> statement-breakpoint
CREATE UNIQUE INDEX `participants_event_id_name_unique` ON `participants` (`event_id`,`name`);--> statement-breakpoint
CREATE INDEX `time_slots_participant_id_idx` ON `time_slots` (`participant_id`);

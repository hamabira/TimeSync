-- Event-wide limits are also defined in src/lib/limits.ts:
-- MAX_EVENT_PARTICIPANTS = 100 and MAX_EVENT_SLOTS = 2000.
-- Keep these SQL literals synchronized with those TypeScript constants.
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
END;--> statement-breakpoint
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

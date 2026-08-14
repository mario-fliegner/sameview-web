--
-- docs/JOOMLA_INTEGRATION.md "Storage Model": Comparison metadata (identity,
-- Outcome Fingerprint, and the allowlisted manifest content) is stored in a
-- dedicated database table owned by com_sameviewcomparisons.
--
-- Phase 19 scope (docs/IMPLEMENTATION_PLAN_V1.md): the table exists and is
-- exercised by a manually inserted test row; no import/lifecycle code reads
-- or writes it yet (that is Phase 21).
--
CREATE TABLE IF NOT EXISTS `#__sameview_comparisons` (
	`id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
	`session_id` VARCHAR(190) NOT NULL,
	`outcome_fingerprint` VARCHAR(190) NOT NULL DEFAULT '',
	`title` VARCHAR(255) NOT NULL DEFAULT '',
	`manifest_json` LONGTEXT NOT NULL,
	`created` DATETIME NOT NULL,
	`modified` DATETIME NOT NULL,
	PRIMARY KEY (`id`),
	UNIQUE KEY `idx_sameview_comparisons_session_id` (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

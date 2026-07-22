CREATE TABLE `comparisons` (
	`id` char(36) NOT NULL,
	`public_id` varchar(24) NOT NULL,
	`management_token_hash` varchar(255) NOT NULL,
	`title` varchar(255),
	`description` text,
	`reference_label` varchar(255),
	`capture_label` varchar(255),
	`reference_path` varchar(500) NOT NULL,
	`capture_path` varchar(500) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `comparisons_id` PRIMARY KEY(`id`),
	CONSTRAINT `comparisons_public_id_unique` UNIQUE(`public_id`),
	CONSTRAINT `comparisons_management_token_hash_unique` UNIQUE(`management_token_hash`)
);

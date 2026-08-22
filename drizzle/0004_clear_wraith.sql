CREATE TABLE `project_access_settings` (
	`id` int NOT NULL,
	`loginRequired` int NOT NULL DEFAULT 1,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `project_access_settings_id` PRIMARY KEY(`id`)
);

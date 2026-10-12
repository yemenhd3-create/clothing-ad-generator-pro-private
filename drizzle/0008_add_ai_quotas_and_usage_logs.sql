ALTER TABLE `access_codes` ADD `aiCreditsTotal` int NOT NULL DEFAULT 100;
ALTER TABLE `access_codes` ADD `aiCreditsUsed` int NOT NULL DEFAULT 0;
ALTER TABLE `access_codes` ADD `aiDailyLimit` int NOT NULL DEFAULT 20;
ALTER TABLE `access_codes` ADD `aiDailyUsed` int NOT NULL DEFAULT 0;
ALTER TABLE `access_codes` ADD `aiDailyResetAt` timestamp NOT NULL DEFAULT (now());

CREATE TABLE IF NOT EXISTS `ai_usage_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`accessCodeId` int,
	`feature` varchar(64) NOT NULL,
	`provider` varchar(64) NOT NULL,
	`model` varchar(120) NOT NULL,
	`status` varchar(32) NOT NULL,
	`responseTimeMs` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_usage_logs_id` PRIMARY KEY(`id`)
);

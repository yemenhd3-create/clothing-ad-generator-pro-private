CREATE TABLE IF NOT EXISTS `access_codes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`codeHash` varchar(64) NOT NULL,
	`sessionOpenId` varchar(96) NOT NULL,
	`label` varchar(120) NOT NULL,
	`expiresAt` timestamp,
	`maxUses` int,
	`useCount` int NOT NULL DEFAULT 0,
	`isRevoked` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`lastUsedAt` timestamp,
	CONSTRAINT `access_codes_id` PRIMARY KEY(`id`),
	CONSTRAINT `access_codes_codeHash_unique` UNIQUE(`codeHash`),
	CONSTRAINT `access_codes_sessionOpenId_unique` UNIQUE(`sessionOpenId`)
);

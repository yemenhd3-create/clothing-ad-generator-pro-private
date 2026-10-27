CREATE TABLE `credit_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accessCodeId` int NOT NULL,
	`kind` varchar(16) NOT NULL,
	`tool` varchar(64),
	`amount` int NOT NULL,
	`balanceAfter` int NOT NULL,
	`operationId` varchar(96),
	`note` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `credit_transactions_id` PRIMARY KEY(`id`),
	CONSTRAINT `credit_transactions_operationId_unique` UNIQUE(`operationId`)
);
--> statement-breakpoint
CREATE INDEX `credit_transactions_accessCodeId_idx` ON `credit_transactions` (`accessCodeId`);
--> statement-breakpoint
CREATE TABLE `ai_tool_prices` (
	`toolKey` varchar(64) NOT NULL,
	`label` varchar(120),
	`cost` int NOT NULL,
	`enabled` int NOT NULL DEFAULT 1,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_tool_prices_toolKey` PRIMARY KEY(`toolKey`)
);

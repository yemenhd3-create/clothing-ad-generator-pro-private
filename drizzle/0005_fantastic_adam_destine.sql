ALTER TABLE `project_access_settings` ADD `registrationOpen` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `project_access_settings` ADD `offlineGraceHours` int DEFAULT 72 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `lastSeenAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `lastAppVersion` varchar(32);
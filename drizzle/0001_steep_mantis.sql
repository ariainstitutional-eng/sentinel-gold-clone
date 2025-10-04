ALTER TABLE `models` ADD `strategy` text NOT NULL;--> statement-breakpoint
ALTER TABLE `models` ADD `symbol` text DEFAULT 'XAUUSD' NOT NULL;--> statement-breakpoint
ALTER TABLE `models` ADD `timeframe` text NOT NULL;--> statement-breakpoint
ALTER TABLE `models` ADD `accuracy` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `models` ADD `training_data` text;--> statement-breakpoint
ALTER TABLE `models` ADD `is_active` integer DEFAULT false NOT NULL;
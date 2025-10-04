ALTER TABLE `signals` ADD `action` text NOT NULL;--> statement-breakpoint
ALTER TABLE `signals` ADD `entry_price` real NOT NULL;--> statement-breakpoint
ALTER TABLE `signals` ADD `stop_loss` real;--> statement-breakpoint
ALTER TABLE `signals` ADD `take_profit` real;--> statement-breakpoint
ALTER TABLE `signals` ADD `reason` text NOT NULL;--> statement-breakpoint
ALTER TABLE `signals` ADD `status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `signals` ADD `created_at` integer NOT NULL;
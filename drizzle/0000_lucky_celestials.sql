CREATE TABLE `accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`broker` text NOT NULL,
	`server` text NOT NULL,
	`login` text NOT NULL,
	`alias` text,
	`balance` real NOT NULL,
	`equity` real NOT NULL,
	`margin_level` real,
	`status` text DEFAULT 'disconnected' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`timestamp` integer NOT NULL,
	`category` text NOT NULL,
	`action` text NOT NULL,
	`details` text NOT NULL,
	`ref_type` text,
	`ref_id` integer,
	`level` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `fused_signals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`timestamp` integer NOT NULL,
	`symbol` text DEFAULT 'XAUUSD' NOT NULL,
	`direction` text NOT NULL,
	`score` real NOT NULL,
	`confidence` real NOT NULL,
	`primary_id` integer,
	`sequential_id` integer,
	`contextual_id` integer,
	`rationale` text,
	`seed` integer DEFAULT 42 NOT NULL,
	FOREIGN KEY (`primary_id`) REFERENCES `signals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sequential_id`) REFERENCES `signals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`contextual_id`) REFERENCES `signals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `models` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`provider` text NOT NULL,
	`version` text NOT NULL,
	`description` text,
	`hyperparams` text,
	`status` text DEFAULT 'standby' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `models_name_unique` ON `models` (`name`);--> statement-breakpoint
CREATE TABLE `news_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`published_at` integer NOT NULL,
	`source` text NOT NULL,
	`title` text NOT NULL,
	`url` text,
	`priority` text NOT NULL,
	`sentiment` text NOT NULL,
	`summary` text
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer,
	`symbol` text DEFAULT 'XAUUSD' NOT NULL,
	`side` text NOT NULL,
	`volume` real NOT NULL,
	`type` text NOT NULL,
	`price` real,
	`sl` real,
	`tp` real,
	`placed_at` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`mt5_order_id` text,
	`fused_signal_id` integer,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`fused_signal_id`) REFERENCES `fused_signals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `positions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer,
	`symbol` text DEFAULT 'XAUUSD' NOT NULL,
	`side` text NOT NULL,
	`volume` real NOT NULL,
	`entry_price` real NOT NULL,
	`sl` real,
	`tp` real,
	`opened_at` integer NOT NULL,
	`closed_at` integer,
	`pnl` real,
	`status` text DEFAULT 'open' NOT NULL,
	`fused_signal_id` integer,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`fused_signal_id`) REFERENCES `fused_signals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `risk_limits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`max_daily_loss` real NOT NULL,
	`max_drawdown_pct` real NOT NULL,
	`max_risk_per_trade_pct` real NOT NULL,
	`max_concurrent_positions` integer NOT NULL,
	`capital_protection_enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `signals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`timestamp` integer NOT NULL,
	`symbol` text DEFAULT 'XAUUSD' NOT NULL,
	`layer` text NOT NULL,
	`direction` text NOT NULL,
	`strength` real NOT NULL,
	`confidence` real NOT NULL,
	`features` text,
	`model_id` integer,
	`seed` integer DEFAULT 42 NOT NULL,
	FOREIGN KEY (`model_id`) REFERENCES `models`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `system_status` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mt5_connected` integer DEFAULT false NOT NULL,
	`ai_active` integer DEFAULT false NOT NULL,
	`risk_monitor_active` integer DEFAULT true NOT NULL,
	`degraded_mode` integer DEFAULT false NOT NULL,
	`last_heartbeat` integer NOT NULL
);

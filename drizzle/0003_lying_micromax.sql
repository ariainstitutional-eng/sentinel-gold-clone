CREATE TABLE `auto_trading_config` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`max_daily_trades` integer DEFAULT 10 NOT NULL,
	`max_daily_loss` real DEFAULT 500 NOT NULL,
	`max_position_size` real DEFAULT 1 NOT NULL,
	`emergency_stop_loss` integer DEFAULT true NOT NULL,
	`trading_hours_start` text DEFAULT '00:00' NOT NULL,
	`trading_hours_end` text DEFAULT '23:59' NOT NULL,
	`allowed_symbols` text DEFAULT '["XAUUSD"]' NOT NULL,
	`min_confidence_threshold` real DEFAULT 0.7 NOT NULL,
	`risk_per_trade` real DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `drawdown_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`timestamp` integer NOT NULL,
	`equity_peak` real NOT NULL,
	`current_equity` real NOT NULL,
	`drawdown_pct` real NOT NULL,
	`drawdown_amount` real NOT NULL,
	`recovered` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `performance_metrics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` integer NOT NULL,
	`total_trades` integer DEFAULT 0 NOT NULL,
	`winning_trades` integer DEFAULT 0 NOT NULL,
	`losing_trades` integer DEFAULT 0 NOT NULL,
	`total_pnl` real DEFAULT 0 NOT NULL,
	`win_rate` real DEFAULT 0 NOT NULL,
	`avg_win` real DEFAULT 0 NOT NULL,
	`avg_loss` real DEFAULT 0 NOT NULL,
	`profit_factor` real DEFAULT 0 NOT NULL,
	`sharpe_ratio` real DEFAULT 0 NOT NULL,
	`max_drawdown` real DEFAULT 0 NOT NULL,
	`equity` real DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `trade_journal` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`position_id` integer,
	`symbol` text DEFAULT 'XAUUSD' NOT NULL,
	`side` text NOT NULL,
	`entry_price` real NOT NULL,
	`exit_price` real,
	`volume` real NOT NULL,
	`pnl` real,
	`duration` integer,
	`strategy` text,
	`notes` text,
	`sentiment` text DEFAULT 'neutral' NOT NULL,
	`opened_at` integer NOT NULL,
	`closed_at` integer,
	FOREIGN KEY (`position_id`) REFERENCES `positions`(`id`) ON UPDATE no action ON DELETE no action
);

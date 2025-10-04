import { sqliteTable, integer, text, real } from 'drizzle-orm/sqlite-core';

// AI Models for signal generation
export const models = sqliteTable('models', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  provider: text('provider').notNull(),
  version: text('version').notNull(),
  description: text('description'),
  hyperparams: text('hyperparams', { mode: 'json' }),
  status: text('status').notNull().default('standby'), // active, standby, training
  strategy: text('strategy').notNull(), // scalping, swing, trend, mean_reversion
  symbol: text('symbol').notNull().default('XAUUSD'),
  timeframe: text('timeframe').notNull(), // M1, M5, M15, H1, etc.
  accuracy: real('accuracy').notNull().default(0.0), // Model accuracy percentage
  trainingData: text('training_data', { mode: 'json' }), // Training metadata
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

// Individual AI signals from each layer
export const signals = sqliteTable('signals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  timestamp: integer('timestamp').notNull(),
  symbol: text('symbol').notNull().default('XAUUSD'),
  layer: text('layer').notNull(), // primary, sequential, contextual
  direction: text('direction').notNull(), // buy, sell, neutral
  strength: real('strength').notNull(), // 0..1
  confidence: real('confidence').notNull(), // 0..1
  features: text('features', { mode: 'json' }),
  seed: integer('seed').notNull().default(42),
  action: text('action').notNull(), // buy, sell, hold
  entryPrice: real('entry_price').notNull(),
  stopLoss: real('stop_loss'),
  takeProfit: real('take_profit'),
  reason: text('reason').notNull(),
  modelId: integer('model_id').references(() => models.id),
  status: text('status').notNull().default('pending'), // pending, executed, cancelled
  createdAt: integer('created_at').notNull(),
});

// Fused signals from three-layer fusion
export const fusedSignals = sqliteTable('fused_signals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  timestamp: integer('timestamp').notNull(),
  symbol: text('symbol').notNull().default('XAUUSD'),
  direction: text('direction').notNull(),
  score: real('score').notNull(),
  confidence: real('confidence').notNull(),
  primaryId: integer('primary_id').references(() => signals.id),
  sequentialId: integer('sequential_id').references(() => signals.id),
  contextualId: integer('contextual_id').references(() => signals.id),
  rationale: text('rationale'),
  seed: integer('seed').notNull().default(42),
});

// Risk management limits and controls
export const riskLimits = sqliteTable('risk_limits', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  maxDailyLoss: real('max_daily_loss').notNull(),
  maxDrawdownPct: real('max_drawdown_pct').notNull(),
  maxRiskPerTradePct: real('max_risk_per_trade_pct').notNull(),
  maxConcurrentPositions: integer('max_concurrent_positions').notNull(),
  capitalProtectionEnabled: integer('capital_protection_enabled', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

// Trading accounts
export const accounts = sqliteTable('accounts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  broker: text('broker').notNull(),
  server: text('server').notNull(),
  login: text('login').notNull(),
  alias: text('alias'),
  balance: real('balance').notNull(),
  equity: real('equity').notNull(),
  marginLevel: real('margin_level'),
  status: text('status').notNull().default('disconnected'), // disconnected, connected
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

// Open and closed positions
export const positions = sqliteTable('positions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  accountId: integer('account_id').references(() => accounts.id),
  symbol: text('symbol').notNull().default('XAUUSD'),
  side: text('side').notNull(), // buy, sell
  volume: real('volume').notNull(),
  entryPrice: real('entry_price').notNull(),
  sl: real('sl'),
  tp: real('tp'),
  openedAt: integer('opened_at').notNull(),
  closedAt: integer('closed_at'),
  pnl: real('pnl'),
  status: text('status').notNull().default('open'), // open, closed
  fusedSignalId: integer('fused_signal_id').references(() => fusedSignals.id),
});

// Order management
export const orders = sqliteTable('orders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  accountId: integer('account_id').references(() => accounts.id),
  symbol: text('symbol').notNull().default('XAUUSD'),
  side: text('side').notNull(),
  volume: real('volume').notNull(),
  type: text('type').notNull(), // market, limit, stop
  price: real('price'),
  sl: real('sl'),
  tp: real('tp'),
  placedAt: integer('placed_at').notNull(),
  status: text('status').notNull().default('pending'), // pending, filled, rejected, canceled
  mt5OrderId: text('mt5_order_id'),
  fusedSignalId: integer('fused_signal_id').references(() => fusedSignals.id),
});

// Market news and sentiment
export const newsItems = sqliteTable('news_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  publishedAt: integer('published_at').notNull(),
  source: text('source').notNull(),
  title: text('title').notNull(),
  url: text('url'),
  priority: text('priority').notNull(), // high, medium, low
  sentiment: text('sentiment').notNull(), // bullish, bearish, neutral
  summary: text('summary'),
});

// Comprehensive audit logging
export const auditLogs = sqliteTable('audit_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  timestamp: integer('timestamp').notNull(),
  category: text('category').notNull(), // execution, risk, model, system
  action: text('action').notNull(),
  details: text('details').notNull(),
  refType: text('ref_type'), // order, position, model, etc
  refId: integer('ref_id'),
  level: text('level').notNull(), // info, warn, error
});

// System health and status monitoring
export const systemStatus = sqliteTable('system_status', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  mt5Connected: integer('mt5_connected', { mode: 'boolean' }).notNull().default(false),
  aiActive: integer('ai_active', { mode: 'boolean' }).notNull().default(false),
  riskMonitorActive: integer('risk_monitor_active', { mode: 'boolean' }).notNull().default(true),
  degradedMode: integer('degraded_mode', { mode: 'boolean' }).notNull().default(false),
  lastHeartbeat: integer('last_heartbeat').notNull(),
});
import { db } from '@/db';
import { models } from '@/db/schema';

async function main() {
    const sampleModels = [
        {
            name: 'Aggressive Scalper',
            provider: 'gemini',
            version: 'v1.2',
            description: 'High-frequency scalping model optimized for XAUUSD with rapid entry/exit signals. Uses advanced pattern recognition to identify micro-trends and momentum shifts in 1-5 minute timeframes. Designed for maximum profit capture during volatile market conditions.',
            hyperparams: JSON.stringify({
                learning_rate: 0.001,
                batch_size: 64,
                sequence_length: 50,
                hidden_layers: 3,
                neurons_per_layer: 128,
                dropout_rate: 0.2,
                lookback_periods: 100,
                signal_threshold: 0.75,
                risk_tolerance: 0.15,
                max_position_time: 15,
                timeframe: '1m',
                technical_indicators: ['RSI', 'MACD', 'Bollinger_Bands', 'EMA_9', 'EMA_21'],
                stop_loss_pips: 5,
                take_profit_pips: 8
            }),
            status: 'active',
            createdAt: Date.now() - (7 * 24 * 60 * 60 * 1000),
            updatedAt: Date.now() - (1 * 24 * 60 * 60 * 1000)
        },
        {
            name: 'Conservative Trend',
            provider: 'openai',
            version: 'v2.1',
            description: 'Trend-following model with conservative risk management and lower drawdown targets. Focuses on identifying strong directional moves in XAUUSD using multi-timeframe analysis. Prioritizes capital preservation over aggressive profit maximization.',
            hyperparams: JSON.stringify({
                learning_rate: 0.0005,
                batch_size: 32,
                sequence_length: 200,
                hidden_layers: 4,
                neurons_per_layer: 256,
                dropout_rate: 0.1,
                lookback_periods: 500,
                signal_threshold: 0.85,
                risk_tolerance: 0.05,
                max_position_time: 240,
                timeframe: '15m',
                technical_indicators: ['SMA_50', 'SMA_200', 'ADX', 'Stochastic', 'CCI'],
                stop_loss_pips: 15,
                take_profit_pips: 45,
                trend_confirmation_periods: 3
            }),
            status: 'standby',
            createdAt: Date.now() - (14 * 24 * 60 * 60 * 1000),
            updatedAt: Date.now() - (3 * 24 * 60 * 60 * 1000)
        },
        {
            name: 'Balanced Momentum',
            provider: 'local',
            version: 'v3.0',
            description: 'Hybrid model combining scalping precision with trend-following stability. Adapts strategy based on market volatility and momentum indicators. Balances frequent trading opportunities with risk-adjusted returns for consistent performance.',
            hyperparams: JSON.stringify({
                learning_rate: 0.0008,
                batch_size: 48,
                sequence_length: 120,
                hidden_layers: 5,
                neurons_per_layer: 192,
                dropout_rate: 0.15,
                lookback_periods: 300,
                signal_threshold: 0.80,
                risk_tolerance: 0.10,
                max_position_time: 60,
                timeframe: '5m',
                technical_indicators: ['RSI', 'MACD', 'SMA_20', 'ATR', 'Volume_MA'],
                stop_loss_pips: 10,
                take_profit_pips: 20,
                volatility_adjustment: true,
                momentum_factor: 1.2,
                adaptive_thresholds: true
            }),
            status: 'standby',
            createdAt: Date.now() - (21 * 24 * 60 * 60 * 1000),
            updatedAt: Date.now() - (2 * 24 * 60 * 60 * 1000)
        }
    ];

    await db.insert(models).values(sampleModels);
    
    console.log('✅ AI models seeder completed successfully');
}

main().catch((error) => {
    console.error('❌ Seeder failed:', error);
});
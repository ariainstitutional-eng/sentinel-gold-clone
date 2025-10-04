import { db } from '@/db';
import { signals } from '@/db/schema';

async function main() {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    const sampleSignals = [
        // Primary Layer Signals
        {
            timestamp: Math.floor(oneHourAgo + (5 * 60 * 1000)),
            symbol: 'XAUUSD',
            layer: 'primary',
            direction: 'buy',
            strength: 0.75,
            confidence: 0.82,
            features: JSON.stringify({
                rsi: 68.5,
                macd: 0.45,
                ema20: 2045.32,
                ema50: 2038.67,
                volume: 125000,
                atr: 12.4,
                support: 2040.15,
                resistance: 2055.80
            }),
            modelId: 1,
            seed: 42,
        },
        {
            timestamp: Math.floor(oneHourAgo + (15 * 60 * 1000)),
            symbol: 'XAUUSD',
            layer: 'primary',
            direction: 'sell',
            strength: 0.68,
            confidence: 0.76,
            features: JSON.stringify({
                rsi: 74.2,
                macd: -0.32,
                ema20: 2048.91,
                ema50: 2041.23,
                volume: 98000,
                atr: 11.8,
                support: 2035.40,
                resistance: 2052.10
            }),
            modelId: 1,
            seed: 42,
        },
        {
            timestamp: Math.floor(oneHourAgo + (25 * 60 * 1000)),
            symbol: 'XAUUSD',
            layer: 'primary',
            direction: 'neutral',
            strength: 0.45,
            confidence: 0.65,
            features: JSON.stringify({
                rsi: 52.1,
                macd: 0.08,
                ema20: 2046.78,
                ema50: 2046.45,
                volume: 87500,
                atr: 10.9,
                support: 2042.30,
                resistance: 2050.65
            }),
            modelId: 1,
            seed: 42,
        },
        // Sequential Layer Signals
        {
            timestamp: Math.floor(oneHourAgo + (10 * 60 * 1000)),
            symbol: 'XAUUSD',
            layer: 'sequential',
            direction: 'buy',
            strength: 0.72,
            confidence: 0.79,
            features: JSON.stringify({
                trend_momentum: 0.68,
                price_velocity: 1.34,
                pattern_score: 0.71,
                sequence_strength: 0.82,
                breakout_probability: 0.65,
                volume_trend: 1.12,
                volatility_ratio: 0.89
            }),
            modelId: 1,
            seed: 42,
        },
        {
            timestamp: Math.floor(oneHourAgo + (20 * 60 * 1000)),
            symbol: 'XAUUSD',
            layer: 'sequential',
            direction: 'buy',
            strength: 0.80,
            confidence: 0.85,
            features: JSON.stringify({
                trend_momentum: 0.84,
                price_velocity: 1.89,
                pattern_score: 0.77,
                sequence_strength: 0.91,
                breakout_probability: 0.78,
                volume_trend: 1.45,
                volatility_ratio: 0.76
            }),
            modelId: 1,
            seed: 42,
        },
        {
            timestamp: Math.floor(oneHourAgo + (35 * 60 * 1000)),
            symbol: 'XAUUSD',
            layer: 'sequential',
            direction: 'sell',
            strength: 0.70,
            confidence: 0.77,
            features: JSON.stringify({
                trend_momentum: -0.73,
                price_velocity: -1.56,
                pattern_score: 0.69,
                sequence_strength: 0.85,
                breakout_probability: 0.72,
                volume_trend: 0.94,
                volatility_ratio: 1.23
            }),
            modelId: 1,
            seed: 42,
        },
        // Contextual Layer Signals
        {
            timestamp: Math.floor(oneHourAgo + (8 * 60 * 1000)),
            symbol: 'XAUUSD',
            layer: 'contextual',
            direction: 'neutral',
            strength: 0.55,
            confidence: 0.68,
            features: JSON.stringify({
                market_sentiment: 0.12,
                fed_impact: 0.34,
                gold_demand: 0.67,
                dollar_strength: -0.23,
                inflation_pressure: 0.45,
                geopolitical_risk: 0.28,
                economic_outlook: 0.15,
                correlation_analysis: 0.52
            }),
            modelId: 1,
            seed: 42,
        },
        {
            timestamp: Math.floor(oneHourAgo + (30 * 60 * 1000)),
            symbol: 'XAUUSD',
            layer: 'contextual',
            direction: 'buy',
            strength: 0.65,
            confidence: 0.73,
            features: JSON.stringify({
                market_sentiment: 0.71,
                fed_impact: 0.58,
                gold_demand: 0.82,
                dollar_strength: -0.45,
                inflation_pressure: 0.67,
                geopolitical_risk: 0.74,
                economic_outlook: 0.39,
                correlation_analysis: 0.68
            }),
            modelId: 1,
            seed: 42,
        },
        {
            timestamp: Math.floor(oneHourAgo + (45 * 60 * 1000)),
            symbol: 'XAUUSD',
            layer: 'contextual',
            direction: 'sell',
            strength: 0.63,
            confidence: 0.71,
            features: JSON.stringify({
                market_sentiment: -0.58,
                fed_impact: -0.42,
                gold_demand: 0.35,
                dollar_strength: 0.69,
                inflation_pressure: 0.21,
                geopolitical_risk: 0.18,
                economic_outlook: -0.33,
                correlation_analysis: 0.44
            }),
            modelId: 1,
            seed: 42,
        }
    ];

    await db.insert(signals).values(sampleSignals);
    
    console.log('✅ Signals seeder completed successfully');
}

main().catch((error) => {
    console.error('❌ Seeder failed:', error);
});
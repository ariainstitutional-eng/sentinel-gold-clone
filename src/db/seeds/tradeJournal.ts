import { db } from '@/db';
import { tradeJournal } from '@/db/schema';

async function main() {
    const currentTime = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const oneHour = 60 * 60 * 1000;
    const oneMinute = 60 * 1000;

    const sampleTrades = [
        {
            positionId: 1,
            symbol: 'XAUUSD',
            side: 'buy',
            entryPrice: 2045.50,
            exitPrice: 2052.25,
            volume: 0.5,
            pnl: 337.5, // (2052.25 - 2045.50) * 0.5 * 100
            duration: 2 * oneHour,
            strategy: 'Trend Following',
            notes: 'Strong bullish momentum after Fed announcement. Clear breakout above resistance.',
            sentiment: 'positive',
            openedAt: currentTime - (6 * oneDay),
            closedAt: currentTime - (6 * oneDay) + (2 * oneHour),
        },
        {
            positionId: 2,
            symbol: 'XAUUSD',
            side: 'sell',
            entryPrice: 2048.75,
            exitPrice: 2051.20,
            volume: 0.3,
            pnl: -73.5, // (2048.75 - 2051.20) * 0.3 * 100
            duration: 45 * oneMinute,
            strategy: 'Mean Reversion',
            notes: 'Failed reversal at resistance. Market continued higher than expected.',
            sentiment: 'negative',
            openedAt: currentTime - (5 * oneDay),
            closedAt: currentTime - (5 * oneDay) + (45 * oneMinute),
        },
        {
            positionId: 3,
            symbol: 'EURUSD',
            side: 'buy',
            entryPrice: 1.0875,
            exitPrice: 1.0874,
            volume: 1.0,
            pnl: -10.0, // (1.0874 - 1.0875) * 1.0 * 100000
            duration: 15 * oneMinute,
            strategy: 'Scalping',
            notes: 'Quick scalp attempt. Market choppy, minimal movement.',
            sentiment: 'neutral',
            openedAt: currentTime - (4 * oneDay),
            closedAt: currentTime - (4 * oneDay) + (15 * oneMinute),
        },
        {
            positionId: 4,
            symbol: 'XAUUSD',
            side: 'sell',
            entryPrice: 2055.80,
            exitPrice: 2041.25,
            volume: 0.8,
            pnl: 1164.0, // (2055.80 - 2041.25) * 0.8 * 100
            duration: 4 * oneHour,
            strategy: 'Reversal Pattern',
            notes: 'Perfect double top reversal. Strong bearish momentum on high volume.',
            sentiment: 'positive',
            openedAt: currentTime - (3 * oneDay),
            closedAt: currentTime - (3 * oneDay) + (4 * oneHour),
        },
        {
            positionId: 5,
            symbol: 'GBPUSD',
            side: 'buy',
            entryPrice: 1.2650,
            exitPrice: 1.2635,
            volume: 0.6,
            pnl: -90.0, // (1.2635 - 1.2650) * 0.6 * 100000
            duration: 8 * oneMinute,
            strategy: 'News Trading',
            notes: 'UK GDP data worse than expected. Immediate reversal.',
            sentiment: 'negative',
            openedAt: currentTime - (2 * oneDay),
            closedAt: currentTime - (2 * oneDay) + (8 * oneMinute),
        },
        {
            positionId: 6,
            symbol: 'XAUUSD',
            side: 'buy',
            entryPrice: 2049.30,
            exitPrice: null,
            volume: 0.4,
            pnl: null,
            duration: null,
            strategy: 'Weekly Trend',
            notes: 'Long-term bullish setup. Weekly support holding strong.',
            sentiment: 'positive',
            openedAt: currentTime - oneDay,
            closedAt: null,
        },
        {
            positionId: 7,
            symbol: 'USDJPY',
            side: 'sell',
            entryPrice: 149.85,
            exitPrice: 148.92,
            volume: 0.7,
            pnl: 651.0, // (149.85 - 148.92) * 0.7 * 1000
            duration: Math.floor(1.5 * oneHour),
            strategy: 'Support Break',
            notes: 'Clean break below daily support. Good follow-through.',
            sentiment: 'positive',
            openedAt: currentTime - oneDay - (12 * oneHour),
            closedAt: currentTime - oneDay - (12 * oneHour) + Math.floor(1.5 * oneHour),
        },
        {
            positionId: 8,
            symbol: 'XAUUSD',
            side: 'buy',
            entryPrice: 2043.50,
            exitPrice: 2038.75,
            volume: 0.3,
            pnl: -142.5, // (2038.75 - 2043.50) * 0.3 * 100
            duration: 25 * oneMinute,
            strategy: 'Momentum',
            notes: 'Hit stop loss. False breakout, should have waited for confirmation.',
            sentiment: 'negative',
            openedAt: currentTime - oneDay - (6 * oneHour),
            closedAt: currentTime - oneDay - (6 * oneHour) + (25 * oneMinute),
        },
        {
            positionId: 9,
            symbol: 'EURUSD',
            side: 'sell',
            entryPrice: 1.0892,
            exitPrice: 1.0878,
            volume: 0.9,
            pnl: 1260.0, // (1.0892 - 1.0878) * 0.9 * 100000
            duration: 3 * oneHour,
            strategy: 'ECB Reaction',
            notes: 'ECB dovish tone as expected. EUR weakness continued.',
            sentiment: 'positive',
            openedAt: currentTime - oneDay - (3 * oneHour),
            closedAt: currentTime - oneDay,
        },
        {
            positionId: 10,
            symbol: 'XAUUSD',
            side: 'buy',
            entryPrice: 2047.15,
            exitPrice: 2050.80,
            volume: 0.5,
            pnl: 182.5, // (2050.80 - 2047.15) * 0.5 * 100
            duration: 90 * oneMinute,
            strategy: 'Intraday Trend',
            notes: 'Clean trend continuation. Good risk-reward ratio achieved.',
            sentiment: 'positive',
            openedAt: currentTime - (12 * oneHour),
            closedAt: currentTime - (12 * oneHour) + (90 * oneMinute),
        }
    ];

    await db.insert(tradeJournal).values(sampleTrades);
    
    console.log('✅ Trade journal seeder completed successfully');
}

main().catch((error) => {
    console.error('❌ Seeder failed:', error);
});